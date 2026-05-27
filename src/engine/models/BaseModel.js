import { toolDefinitions, dispatchTool } from '../tools/index.js';
import { logger } from '../../utils/logger.js';
import { ui } from '../../utils/ui.js';
import { outputFormatted } from '../../utils/outputFormatter.js';

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
   * @param {string|null} systemPrompt Optional system-level instructions.
   */
  async run(query, systemPrompt = null) {
    if (systemPrompt) {
      this.addMessage('system', systemPrompt);
    }
    this.addMessage('user', query);
    
    let turn = 0;
    while (turn < this.maxTurns) {
      turn++;
      
      try {
        ui.think();
        const response = await this._getCompletion();
        ui.stop();

        const message = response.choices[0].message;

        // Let subclasses handle/format the response (e.g. Gemini thought signatures)
        await this.handleResponse(message);

        // Exit loop if no tool calls are requested (Final Answer)
        if (!message.tool_calls || message.tool_calls.length === 0) {
          if (message.content) {
            const formatted = outputFormatted(message.content);
            process.stdout.write(formatted);
            if (!formatted.endsWith('\n')) {
              process.stdout.write("\n");
            }
          }
          return;
        }

        // Execute and record tool calls
        await this._processToolCalls(message.tool_calls);

      } catch (err) {
        ui.stop();
        // Deep error logging for API failures
        if (err.status) {
          logger.error(`[API Error] Status: ${err.status}`);
          if (err.response?.data) {
             logger.error(`[API Error] Details: ${JSON.stringify(err.response.data)}`);
          }
        } else if (err.name === 'AbortError' || err.message.includes('timeout')) {
          logger.error(`[Timeout Error]: The AI took too long to respond (60s).`);
        } else {
          logger.error(`[Error]: ${err.message}`);
        }
        throw err;
      }
    }

    logger.secondary("[System]: Reached maximum conversation turns. Ending session.");
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

          ui.update(`Error ${err.status}. Retrying in ${(finalDelay/1000).toFixed(1)}s`);
          await new Promise(resolve => setTimeout(resolve, finalDelay));
          ui.update('Thinking');
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

        // Semantic Tool Logging
        const toolLabels = {
          readFile: 'reading',
          readDir: 'listing',
          projectTree: 'mapping',
          readFileChunk: 'peeking',
          searchText: 'searching',
          webFetch: 'fetching',
          findFile: 'finding',
          findDir: 'finding',
          listTools: 'listing'
        };

        const label = toolLabels[name] || name;
        let displayArg = "";

        if (name === 'searchText') displayArg = `'${args.pattern}' in ${args.path}`;
        else if (name === 'findFile' || name === 'findDir') displayArg = `'${args.pattern}' in ${args.dirPath || '.'}`;
        else if (name === 'readFileChunk') displayArg = `${args.filePath} [L${args.startLine}-${args.endLine}]`;
        else displayArg = args.url || args.filePath || args.dirPath || args.path || args.pattern || JSON.stringify(args);

        // ui.start() handles terminal-aware truncation internally.
        if (name !== 'askUser' && name !== 'askConfirm') {
          ui.start(label, displayArg);
        }
        
        const result = await dispatchTool(name, args);
        
        if (name !== 'askUser' && name !== 'askConfirm') {
          ui.stop();
        }

        this.addMessage('tool', result, { tool_call_id: toolCall.id });

      } catch (err) {
        ui.stop();
        const errorMsg = err.message;
        logger.error(`[FAILED] ${name}: ${errorMsg}`);
        
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
