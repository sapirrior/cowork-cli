import { toolDefinitions, dispatchTool } from '../tools/index.js';
import { logger } from '../../utils/logger.js';
import { spinner } from '../../utils/ui.js';

/**
 * Base class for AI model interaction handlers.
 * Encapsulates message history, API calling with retries, and robust tool execution.
 */
export default class BaseModel {
  /**
   * @param {import('openai').OpenAI} client Initialized OpenAI client.
   * @param {string} model Model identifier.
   */
  constructor(client, model) {
    this.client = client;
    this.model = model;
    this.messages = [];
    this.maxTurns = 15; // Safeguard against infinite tool-calling loops
    this.lastRequestTime = 0; // For proactive throttling
  }

  /**
   * Adds a message to the conversation history.
   * @param {string} role 'user', 'assistant', 'system', or 'tool'.
   * @param {string} content Message content.
   * @param {Object} extra Additional fields (e.g., tool_call_id).
   */
  addMessage(role, content, extra = {}) {
    this.messages.push({ role, content, ...extra });
  }

  /**
   * Main execution loop for the model query.
   * @param {string} query The user input.
   */
  async run(query) {
    this.addMessage('user', query);
    
    let turn = 0;
    while (turn < this.maxTurns) {
      turn++;
      
      try {
        spinner.start("Thinking");
        const response = await this._getCompletion();
        spinner.stop();

        const message = response.choices[0].message;

        // Let subclasses handle/format the response (e.g. Gemini thought signatures)
        await this.handleResponse(message);

        // Output model's text content to terminal
        if (message.content) {
          process.stdout.write(message.content);
        }

        // Exit loop if no tool calls are requested
        if (!message.tool_calls || message.tool_calls.length === 0) {
          process.stdout.write("\n\n");
          return;
        }

        // Add a newline if content was printed but tool calls follow
        if (message.content && !message.content.endsWith('\n')) {
          process.stdout.write('\n');
        }

        // Execute and record tool calls
        await this._processToolCalls(message.tool_calls);

      } catch (err) {
        spinner.stop();
        // Deep error logging for API failures
        if (err.status) {
          logger.error(`\n[API Error] Status: ${err.status}`);
          if (err.response?.data) {
             logger.error(`[API Error] Details: ${JSON.stringify(err.response.data)}`);
          }
        } else if (err.name === 'AbortError' || err.message.includes('timeout')) {
          logger.error(`\n[Timeout Error]: The AI took too long to respond (60s).`);
        } else {
          logger.error(`\n[Error]: ${err.message}`);
        }
        throw err;
      }
    }

    logger.secondary("\n[System]: Reached maximum conversation turns. Ending session.");
  }

  /**
   * Private method to fetch completion with exponential backoff for transient errors.
   * @private
   */
  async _getCompletion() {
    let retries = 0;
    const maxRetries = 5;
    const minDelayBetweenRequests = 1000; // 1s proactive throttle
    
    while (retries <= maxRetries) {
      try {
        // 1. Proactive Throttling
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < minDelayBetweenRequests) {
          const waitTime = minDelayBetweenRequests - timeSinceLastRequest;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: this.messages,
          tools: toolDefinitions,
          tool_choice: "auto"
        });

        // Update last request time on successful response
        this.lastRequestTime = Date.now();
        return response;

      } catch (err) {
        const isTransient = [429, 500, 502, 503, 504].includes(err.status);
        if (isTransient && retries < maxRetries) {
          retries++;
          
          let delay = Math.pow(2, retries) * 1000;
          
          // 2. Adhere to Retry-After header if present
          const retryAfter = err.headers?.['retry-after'];
          if (retryAfter) {
            const seconds = parseInt(retryAfter);
            if (!isNaN(seconds)) {
              delay = seconds * 1000;
            } else {
              // Handle Date string
              const retryDate = new Date(retryAfter);
              if (!isNaN(retryDate.getTime())) {
                delay = Math.max(0, retryDate.getTime() - Date.now());
              }
            }
          }

          // 3. Apply Jitter (randomness to prevent thundering herd)
          const jitter = Math.random() * 500;
          const finalDelay = delay + jitter;

          spinner.update(`Error ${err.status}. Retrying in ${(finalDelay/1000).toFixed(1)}s`);
          await new Promise(resolve => setTimeout(resolve, finalDelay));
          spinner.update("Thinking");
          continue;
        }
        throw err;
      }
    }
  }

  /**
   * Private method to handle tool calls with deep error recovery.
   * @private
   */
  async _processToolCalls(toolCalls) {
    for (const toolCall of toolCalls) {
      const name = toolCall.function.name;
      let args;
      
      try {
        // 1. Robust Argument Parsing
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch (parseErr) {
          throw new Error(`Invalid JSON arguments provided for tool '${name}': ${parseErr.message}`);
        }

        // Clean tool logging: Extract primary arguments for better readability
        let displayArg = "";
        if (name === 'searchText') displayArg = `'${args.pattern}' in ${args.path}`;
        else if (name === 'readFileChunk') displayArg = `${args.filePath} [${args.startLine}-${args.endLine}]`;
        else if (args.url) displayArg = args.url;
        else if (args.filePath) displayArg = args.filePath;
        else if (args.dirPath) displayArg = args.dirPath;
        else if (args.path) displayArg = args.path;
        else if (args.pattern) displayArg = args.pattern;
        else displayArg = JSON.stringify(args);

        const displayStr = displayArg.length > 60 ? displayArg.slice(0, 57) + "..." : displayArg;
        logger.secondary(`  [${name}] ${displayStr}`);
        
        // 2. Safe Dispatch & Execution with Spinner
        spinner.start(`  [${name}] Executing`);
        const result = await dispatchTool(name, args);
        spinner.stop();

        this.addMessage('tool', result, { tool_call_id: toolCall.id });

      } catch (err) {
        spinner.stop();
        const errorMsg = err.message;
        logger.error(`  [FAILED] ${name}: ${errorMsg}`);
        
        // 3. Model Recovery: Feed the error back to the model
        this.addMessage('tool', `Error: ${errorMsg}`, { tool_call_id: toolCall.id });
      }
    }
  }

  /**
   * Overridden by subclasses to handle provider-specific message formatting.
   * @param {Object} message The message object from the API.
   */
  async handleResponse(message) {
    this.messages.push(message);
  }
}
