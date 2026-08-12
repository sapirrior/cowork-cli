import { toolDefinitions, dispatchTool, isInteractiveTool, isKnownTool } from '../../agent/index.js';
import { logger, formatMain, formatDim } from '../../utils/index.js';
import { ui, outputFormatted, formatPromptQuery, extractThinking, formatThinkingOnly, StreamingText } from '../../tui/index.js';
import { getLogoLines } from '../../../assets/logo.js';
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
  writeFile:      'writing file',
  editFile:       'editing file',
  deleteFile:     'deleting file',
  executeCommand: 'running command',
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

    // Print the ANSI logo in blue with yellow eyes (alternate screen only)
    ui.logo(getLogoLines());
    ui.logo(['']);

    // Print the user prompt with proper word wrapping and hanging left margin indent (alternate screen only)
    ui.prompt(formatPromptQuery(query));
    ui.prompt('');
    
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

        // Extract and display thinking segments and final response
        if (message.content && message.content.trim().length > 0) {
          const { thinking, response } = extractThinking(message.content);
          
          if (thinking.trim().length > 0) {
            ui.stop(); // Stop thinking spinner before printing thinking
            const formattedThinking = formatThinkingOnly(thinking);
            ui.log(formattedThinking);
          }

          const hasResponse = response.trim().length > 0;
          const hasTools = Array.isArray(message.tool_calls) && message.tool_calls.length > 0;

          if (!hasTools) {
            ui.stop(); // Ensure thinking spinner is stopped
            if (hasResponse) {
              if (thinking.trim().length > 0) {
                // Keep a one line space gap between thinking and response
                ui.log('');
              }
              const formattedResponse = outputFormatted(response);
              ui.log(formattedResponse);
            } else if (thinking.trim().length === 0) {
              logger.error('[System]: Model returned an empty final response.');
            }
            this._printStats();
            await ui.waitForExit();
            return;
          }
        } else {
          const hasTools = Array.isArray(message.tool_calls) && message.tool_calls.length > 0;
          if (!hasTools) {
            ui.stop();
            logger.error('[System]: Model returned an empty final response.');
            this._printStats();
            await ui.waitForExit();
            return;
          }
        }

        // Execute and record tool calls (spinner transition handled inside)
        await this._processToolCalls(message.tool_calls);

      } catch (err: any) {
        // Use ui.fail() (red dot) instead of ui.stop() (green dot) so the
        // terminal reflects that the turn ended in error. fail() is a no-op when IDLE.
        ui.fail();
        const errStr = (err.message || '').toLowerCase();
        // Deep error logging for API failures
        if (err.status) {
          logger.error(`[API Error] Status: ${err.status}`);
          if (err.response?.data) {
             logger.error(`[API Error] Details: ${JSON.stringify(err.response.data)}`);
          }
        } else if (err.name === 'AbortError' || errStr.includes('timeout')) {
          logger.error(`[Timeout Error]: The AI took too long to respond (60s).`);
        } else {
          logger.error(`[Error]: ${err.message || err}`);
        }
        throw err;
      }
    }

    this._printStats();
    logger.secondary("[System]: Reached maximum conversation turns. Ending session.");
    await ui.waitForExit();
  }

  async _getCompletion(): Promise<any> {
    let attempt = 0;
    const maxAttempts = 6;
    const minDelayBetweenRequests = 1000;

    while (attempt < maxAttempts) {
      try {
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
          tool_choice: 'auto',
          stream: true,
        });

        this.lastRequestTime = Date.now();

        let fullContent = '';
        const toolCallsAccumulator: any[] = [];
        let streamingComponent: StreamingText | null = null;
        let finishReason = 'stop';

        for await (const chunk of response as any) {
          const choice = chunk.choices?.[0];
          if (!choice) continue;

          if (choice.finish_reason) {
            finishReason = choice.finish_reason;
          }

          // 1. Accumulate and live render text content
          if (choice.delta?.content) {
            const text = choice.delta.content;
            fullContent += text;
            
            if (!streamingComponent) {
              ui.stop(); // Stop thinking spinner
              streamingComponent = new StreamingText();
              ui.engine.mount(streamingComponent);
            }
            streamingComponent.setRawText(fullContent);
          }

          // 2. Accumulate tool calls
          if (choice.delta?.tool_calls) {
            if (!streamingComponent) {
              ui.stop(); // Stop thinking spinner
            }
            for (let i = 0; i < choice.delta.tool_calls.length; i++) {
              const tc = choice.delta.tool_calls[i];
              const idx = tc.index !== undefined ? tc.index : i;
              
              if (!toolCallsAccumulator[idx]) {
                toolCallsAccumulator[idx] = {
                  id: '',
                  type: 'function',
                  function: { name: '', arguments: '' }
                };
              }
              // Copy all provider-specific custom properties (like extra_content containing thought_signature)
              for (const [key, val] of Object.entries(tc)) {
                if (key !== 'index' && key !== 'function') {
                  toolCallsAccumulator[idx][key] = val;
                }
              }
              if (tc.function?.name) {
                toolCallsAccumulator[idx].function.name = tc.function.name;
              }
              if (tc.function?.arguments) {
                toolCallsAccumulator[idx].function.arguments += tc.function.arguments;
              }
            }
          }
        }

        // Clean up live rendering component if it was mounted
        if (streamingComponent) {
          ui.engine.unmount(streamingComponent);
        }

        const tool_calls = toolCallsAccumulator
          .filter((tc: any) => tc && tc.function?.name && tc.function.name.trim().length > 0 && tc.id)
          .map((tc: any) => {
            const { ...rest } = tc;
            if (!rest.function.arguments) {
              rest.function.arguments = '{}';
            }
            return rest;
          });

        return {
          choices: [
            {
              finish_reason: tool_calls.length > 0 ? 'tool_calls' : finishReason,
              message: {
                role: 'assistant',
                content: fullContent,
                ...(tool_calls.length > 0 ? { tool_calls } : {}),
              }
            }
          ]
        };

      } catch (err: any) {
        const isHttpTransient = [429, 500, 502, 503, 504].includes(err.status);
        const isNetTransient = TRANSIENT_NET_CODES.has(err.code);
        const isTransient = isHttpTransient || isNetTransient;

        attempt++;
        if (isTransient && attempt < maxAttempts) {
          let delay = Math.min(Math.pow(2, attempt) * 1000, MAX_BACKOFF_MS);
          const jitter = Math.random() * 500;
          const finalDelay = delay + jitter;

          const errLabel = err.status ?? err.code ?? 'Network error';
          ui.update(`${errLabel}. Retrying in ${(finalDelay/1000).toFixed(1)}s`);
          await new Promise(resolve => setTimeout(resolve, finalDelay));
          ui.update('Thinking');
          continue;
        }
        throw err;
      }
    }

    throw new Error('_getCompletion: retry loop exhausted without returning a response.');
  }

  /**
   * Private method to handle tool calls with deep error recovery and parallel execution.
   */
  async _processToolCalls(toolCalls: any[]): Promise<void> {
    // Unmount thinking spinner so interactive tools and stdin prompts run cleanly
    ui.stop();

    const parsedCalls = [];
    for (const toolCall of toolCalls) {
      const name = toolCall.function?.name;
      if (!name || typeof name !== 'string' || name.trim() === '') {
        parsedCalls.push({
          toolCall,
          name: name || '(unknown)',
          args: null,
          error: new Error(`Tool call arrived with missing or empty function name — skipped.`)
        });
        continue;
      }

      if (!isKnownTool(name)) {
        parsedCalls.push({
          toolCall,
          name,
          args: null,
          error: new Error(`Unknown tool '${name}' requested by model.`)
        });
        continue;
      }

      let args;
      try {
        args = JSON.parse(toolCall.function.arguments || '{}');
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

    // Use centralized isInteractiveTool helper
    const interactiveCalls = parsedCalls.filter(c => isInteractiveTool(c.name));
    const nonInteractiveCalls = parsedCalls.filter(c => !isInteractiveTool(c.name));

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

    // 2. Process interactive calls sequentially (no blank lines between tools)
    for (const c of interactiveCalls) {
      try {
        if (c.error) throw c.error;
        const result = await dispatchTool(c.name, c.args);
        this.addMessage('tool', result, { tool_call_id: c.toolCall.id });
      } catch (err: any) {
        const errorMsg = err.message;
        logger.error(`[FAILED] ${c.name}: ${errorMsg}`);
        this.addMessage('tool', `Error: ${errorMsg}`, { tool_call_id: c.toolCall.id });
      }
    }

    // Single blank line spacer between tool output batch and the next response
    ui.log('');
  }

  /**
   * Overridden by subclasses to handle provider-specific message formatting.
   */
  async handleResponse(message: any): Promise<void> {
    const clean: any = {
      role: 'assistant',
      content: typeof message.content === 'string' ? message.content : '',
    };
    if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
      clean.tool_calls = message.tool_calls;
    }
    this.messages.push(clean);
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
