import { toolDefinitions, dispatchTool } from '../../agent/index.js';
import { logger, formatMain, formatDim } from '../../utils/index.js';
import { ui, outputFormatted } from '../../tui/index.js';
import { OpenAI } from 'openai';

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

// Defined at module scope to avoid re-allocating on every tool call.
const TOOL_LABELS: Record<string, string> = {
  readFile: 'reading',
  readDir: 'listing',
  projectTree: 'mapping',
  readFileChunk: 'peeking',
  searchText: 'searching',
  webFetch: 'fetching',
  webSearch: 'searching web',
  findFile: 'finding',
  findDir: 'finding',
  gitDiff: 'git diff',
  gitLog: 'git log',
  gitStatus: 'git status',
  readManyFiles: 'loading files',
};

/**
 * Resolves standard display arguments for logging tool executions.
 */
function getDisplayArg(name: string, args: any): string {
  if (name === 'searchText') {
    const ctx = (args.context != null && args.context !== 2) ? ` [C${args.context}]` : '';
    return `'${args.pattern}' in ${args.path}${ctx}`;
  }
  if (name === 'webSearch') return `'${args.query}'`;
  if (name === 'findFile' || name === 'findDir') return `'${args.pattern}' in ${args.dirPath || '.'}`;
  if (name === 'readFileChunk') return `${args.filePath} [L${args.startLine}-${args.endLine}]`;
  if (name === 'gitDiff') {
    const scope = args.staged ? 'staged' : 'unstaged';
    return args.filePath ? `${scope} · ${args.filePath}` : scope;
  }
  if (name === 'gitLog') return `last ${args.limit ?? 10} commits`;
  return args.url || args.filePath || args.dirPath || args.path || args.pattern || JSON.stringify(args);
}

/**
 * Base class for AI model interaction handlers.
 * Encapsulates message history, API calling with retries, and robust tool execution.
 */
export default class BaseModel {
  client: OpenAI;
  model: string;
  messages: any[];
  maxTurns: number;
  lastRequestTime: number;
  _runStartTime: number;
  _runUsage: { prompt: number; completion: number; total: number };

  constructor(client: OpenAI, model: string) {
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
   */
  addMessage(role: string, content: string, extra: Record<string, any> = {}): void {
    this.messages.push({ role, content, ...extra });
  }

  /**
   * Main execution loop for the model query.
   */
  async run(query: string, systemPrompt: string | null = null): Promise<void> {
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

        // Guard against empty/null choices (content filter, provider quirks).
        const choice = response.choices?.[0];
        if (!choice?.message) {
          ui.stop(); // Stop thinking spinner
          logger.error("[API Error] Received empty or malformed response (no choices).");
          return;
        }
        const message = choice.message;
        const finishReason = choice.finish_reason;

        // Surface meaningful finish reasons to the user instead of silent behaviour.
        if (finishReason === 'content_filter') {
          ui.stop(); // Stop thinking spinner
          logger.secondary("[System]: Response was blocked by the provider's content filter.");
          this._printStats();
          return;
        }
        if (finishReason === 'length') {
          logger.secondary("[System]: Response was truncated due to token limits.");
        }

        // Let subclasses handle/format the response (e.g. Gemini thought signatures)
        await this.handleResponse(message);

        // Exit loop if no tool calls are requested (Final Answer)
        if (!message.tool_calls || message.tool_calls.length === 0) {
          ui.stop(); // Stop thinking spinner with green dot (Thought)
          if (message.content) {
            const formatted = outputFormatted(message.content);
            ui.log(formatted);
          }
          this._printStats();
          return;
        }

        // Execute and record tool calls (spinner transition handled inside)
        await this._processToolCalls(message.tool_calls);

      } catch (err: any) {
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
   */
  async _getCompletion(): Promise<any> {
    let attempt = 0;
    const maxAttempts = 6; // 1 initial attempt + 5 retries
    const minDelayBetweenRequests = 1000; // 1s proactive throttle
    
    while (attempt < maxAttempts) {
      try {
        // 1. Proactive Throttling (only on the first attempt of a query)
        if (attempt === 0) {
          const now = Date.now();
          const timeSinceLastRequest = now - this.lastRequestTime;
          if (timeSinceLastRequest < minDelayBetweenRequests) {
            const waitTime = minDelayBetweenRequests - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }

        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: this.messages,
          tools: toolDefinitions as any,
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

      } catch (err: any) {
        // Transient HTTP status codes (rate-limit, server errors)
        const isHttpTransient = [429, 500, 502, 503, 504].includes(err.status);
        const isNetTransient = TRANSIENT_NET_CODES.has(err.code);
        const isTransient = isHttpTransient || isNetTransient;

        attempt++;
        if (isTransient && attempt < maxAttempts) {
          // Cap exponential delay at MAX_BACKOFF_MS to prevent unbounded wait times.
          let delay = Math.min(Math.pow(2, attempt) * 1000, MAX_BACKOFF_MS);

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

    // Exhaustion guard
    throw new Error('_getCompletion: retry loop exhausted without returning a response.');
  }

  /**
   * Private method to handle tool calls with deep error recovery and parallel execution.
   */
  async _processToolCalls(toolCalls: any[]): Promise<void> {
    const parsedCalls = [];
    for (const toolCall of toolCalls) {
      const name = toolCall.function.name;
      let args;
      try {
        args = JSON.parse(toolCall.function.arguments);
        parsedCalls.push({ toolCall, name, args, error: null });
      } catch (parseErr: any) {
        parsedCalls.push({
          toolCall,
          name,
          args: null,
          error: new Error(`Invalid JSON arguments provided for tool '${name}': ${parseErr.message}`)
        });
      }
    }

    // Interactive tools (like askUser, askConfirm) must be run sequentially.
    // Non-interactive tools can run in parallel.
    const interactiveCalls = parsedCalls.filter(c => c.name === 'askUser' || c.name === 'askConfirm');
    const nonInteractiveCalls = parsedCalls.filter(c => c.name !== 'askUser' && c.name !== 'askConfirm');

    // 1. Process non-interactive calls in parallel
    if (nonInteractiveCalls.length > 0) {
      let anyFailed = false;
      
      if (nonInteractiveCalls.length === 1) {
        const c = nonInteractiveCalls[0];
        const label = TOOL_LABELS[c.name] || c.name;
        const displayArg = c.error ? 'error' : getDisplayArg(c.name, c.args);
        ui.start(label, displayArg);
      } else {
        const names = nonInteractiveCalls.map(c => c.name).join(', ');
        ui.start('executing', `${nonInteractiveCalls.length} tools in parallel (${names})`);
      }

      await Promise.all(nonInteractiveCalls.map(async (c) => {
        try {
          if (c.error) throw c.error;
          const result = await dispatchTool(c.name, c.args);
          this.addMessage('tool', result, { tool_call_id: c.toolCall.id });
        } catch (err: any) {
          anyFailed = true;
          const errorMsg = err.message;
          logger.error(`[FAILED] ${c.name}: ${errorMsg}`);
          this.addMessage('tool', `Error: ${errorMsg}`, { tool_call_id: c.toolCall.id });
        }
      }));

      if (anyFailed) {
        ui.fail();
      } else {
        ui.stop();
      }
    }

    // 2. Process interactive calls sequentially
    for (const c of interactiveCalls) {
      try {
        if (c.error) throw c.error;
        // Interactive tools handle their own prompting and do not require ui.start/ui.stop spinners
        const result = await dispatchTool(c.name, c.args);
        this.addMessage('tool', result, { tool_call_id: c.toolCall.id });
      } catch (err: any) {
        const errorMsg = err.message;
        logger.error(`[FAILED] ${c.name}: ${errorMsg}`);
        this.addMessage('tool', `Error: ${errorMsg}`, { tool_call_id: c.toolCall.id });
      }
    }
  }

  /**
   * Overridden by subclasses to handle provider-specific message formatting.
   */
  async handleResponse(message: any): Promise<void> {
    this.messages.push(message);
  }

  /**
   * Prints a compact stats line: elapsed time and cumulative token usage.
   * Only printed on clean exits (final answer or max-turns). Skipped on errors.
   * Token counts are omitted silently if the provider did not return usage data.
   */
  _printStats(): void {
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
