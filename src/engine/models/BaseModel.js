import { toolDefinitions, dispatchTool } from '../tools/index.js';
import { logger, formatMain, formatDim } from '../../utils/logger.js';
import { ui } from '../../utils/ui.js';
import { outputFormatted } from '../../utils/outputFormatter.js';

// Defined at module scope: avoid re-allocating on every caught error.
// Transient Node.js-level network error codes that warrant an automatic retry.
const TRANSIENT_NET_CODES = new Set([
  'ECONNRESET',    // Connection forcibly closed by the remote side
  'ETIMEDOUT',     // Connection or operation timed out
  'ECONNREFUSED',  // Remote host actively refused the connection
  'EAI_AGAIN',     // Temporary DNS resolution failure
  'ENETUNREACH',   // Network is unreachable
  'EHOSTUNREACH',  // Host is unreachable
]);

// Maximum delay (ms) the backoff is allowed to reach, regardless of retry count.
const MAX_BACKOFF_MS = 30000;

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
    this._runStartTime = 0;
    this._runUsage = { prompt: 0, completion: 0, total: 0 };
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
    // Reset per-run tracking state
    this._runStartTime = performance.now();
    this._runUsage = { prompt: 0, completion: 0, total: 0 };

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

        // Guard against empty/null choices (content filter, provider quirks).
        const choice = response.choices?.[0];
        if (!choice?.message) {
          logger.error("[API Error] Received empty or malformed response (no choices).");
          return;
        }
        const message = choice.message;
        const finishReason = choice.finish_reason;

        // Surface meaningful finish reasons to the user instead of silent behaviour.
        if (finishReason === 'content_filter') {
          logger.secondary("[System]: Response was blocked by the provider's content filter.");
          return;
        }
        if (finishReason === 'length') {
          logger.secondary("[System]: Response was truncated due to token limits.");
        }

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
          this._printStats();
          return;
        }

        // Execute and record tool calls
        await this._processToolCalls(message.tool_calls);

      } catch (err) {
        // Use ui.fail() (red dot) instead of ui.stop() (green dot) so the
        // terminal reflects that the turn ended in error. fail() is a no-op when IDLE.
        ui.fail();
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

    this._printStats();
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

        // Accumulate token usage across all turns (usage may be absent on some providers)
        const u = response.usage;
        if (u) {
          this._runUsage.prompt     += u.prompt_tokens     ?? 0;
          this._runUsage.completion += u.completion_tokens ?? 0;
          this._runUsage.total      += u.total_tokens      ?? 0;
        }

        return response;

      } catch (err) {
        // Transient HTTP status codes (rate-limit, server errors)
        const isHttpTransient = [429, 500, 502, 503, 504].includes(err.status);
        const isNetTransient = TRANSIENT_NET_CODES.has(err.code);
        const isTransient = isHttpTransient || isNetTransient;

        if (isTransient && retries < maxRetries) {
          retries++;

          // Cap exponential delay at MAX_BACKOFF_MS to prevent unbounded wait times.
          let delay = Math.min(Math.pow(2, retries) * 1000, MAX_BACKOFF_MS);

          // 2. Adhere to Retry-After header if present (HTTP errors only)
          const retryAfter = err.headers?.['retry-after'];
          if (retryAfter) {
            const seconds = parseInt(retryAfter);
            if (!isNaN(seconds)) {
              // Clamp to [1s, MAX_BACKOFF_MS] so a zero/negative header cannot bypass throttling
              // and an absurd value cannot hang the process.
              delay = Math.min(Math.max(seconds * 1000, 1000), MAX_BACKOFF_MS);
            } else {
              // Handle Date string format
              const retryDate = new Date(retryAfter);
              if (!isNaN(retryDate.getTime())) {
                // Clamp — past dates become 1s, far-future dates are capped at MAX_BACKOFF_MS
                // so the process can never hang indefinitely.
                delay = Math.min(Math.max(retryDate.getTime() - Date.now(), 1000), MAX_BACKOFF_MS);
              }
            }
          }

          // 3. Apply Jitter (randomness to prevent thundering herd)
          const jitter = Math.random() * 500;
          const finalDelay = delay + jitter;

          // Show a meaningful label: HTTP status or Node error code
          const errLabel = err.status ?? err.code ?? 'Network error';
          ui.update(`${errLabel}. Retrying in ${(finalDelay/1000).toFixed(1)}s`);
          await new Promise(resolve => setTimeout(resolve, finalDelay));
          ui.update('Thinking');
          continue;
        }
        throw err;
      }
    }

    // Exhaustion guard — the while loop should always return or throw before
    // reaching here. If it doesn't (e.g. a future refactor breaks the invariant),
    // surface an explicit error rather than returning undefined to the caller.
    throw new Error('_getCompletion: retry loop exhausted without returning a response.');
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
          webSearch: 'searching web',
          findFile: 'finding',
          findDir: 'finding',
          listTools: 'listing',
          gitDiff: 'git diff',
          gitLog: 'git log',
          gitStatus: 'git status',
        };

        const label = toolLabels[name] || name;
        let displayArg = "";

        if (name === 'searchText') {
          const ctx = (args.context != null && args.context !== 2) ? ` [C${args.context}]` : '';
          displayArg = `'${args.pattern}' in ${args.path}${ctx}`;
        }
        else if (name === 'webSearch') displayArg = `'${args.query}'`;
        else if (name === 'findFile' || name === 'findDir') displayArg = `'${args.pattern}' in ${args.dirPath || '.'}`;
        else if (name === 'readFileChunk') displayArg = `${args.filePath} [L${args.startLine}-${args.endLine}]`;
        else if (name === 'gitDiff') {
          const scope = args.staged ? 'staged' : 'unstaged';
          displayArg = args.filePath ? `${scope} · ${args.filePath}` : scope;
        }
        else if (name === 'gitLog') displayArg = `last ${args.limit ?? 10} commits`;
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

  /**
   * Prints a compact stats line: elapsed time and cumulative token usage.
   * Only printed on clean exits (final answer or max-turns). Skipped on errors.
   * Token counts are omitted silently if the provider did not return usage data.
   * @private
   */
  _printStats() {
    const elapsed = ((performance.now() - this._runStartTime) / 1000).toFixed(2);
    const { prompt, completion, total } = this._runUsage;

    const timeStr  = `${formatDim('time')} ${formatMain(elapsed + 's')}`;

    // Only append token info when the provider actually returned usage data
    const tokenStr = total > 0
      ? ` ${formatDim('·')} ${formatDim('tokens')} ${formatMain(String(total))} ${formatDim(`(${prompt}p/${completion}c)`)}`
      : '';

    ui.log(timeStr + tokenStr);
  }
}
