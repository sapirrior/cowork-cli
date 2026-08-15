import { toolDefinitions, dispatchTool, isInteractiveTool, isKnownTool } from '../../agent/index.js';
import { logger, formatMain, formatDim } from '../../utils/index.js';
import { ui, outputFormatted, formatPromptQuery, extractThinking, formatThinkingOnly, StreamingText, isPromptActive } from '../../tui/index.js';
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

/** Rough token estimate: ~4 chars/token. No tokenizer dependency by design
 *  (matches the existing character-based approximation used elsewhere in
 *  this codebase, e.g. webFetch.ts truncation). */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function estimateMessagesTokens(messages: any[]): number {
  let total = 0;
  for (const m of messages) {
    if (m && typeof m.content === 'string') {
      total += estimateTokens(m.content);
    }
    if (m && Array.isArray(m.tool_calls)) {
      for (const tc of m.tool_calls) {
        total += estimateTokens(JSON.stringify(tc.function?.arguments || ''));
      }
    }
  }
  return total;
}

const DEFAULT_CONTEXT_BUDGET_TOKENS = 100000;
const COMPACTION_TRIGGER_RATIO = 0.75;

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
  _interrupted: boolean;
  _abortController: AbortController | null;
  _didEmergencyPrune: boolean;
  _cumulativePrunedExchanges: number;

  constructor(client: OpenAI, model: string) {
    this.client = client;
    this.model = model;
    this.messages = [];
    this.maxTurns = 15; // Safeguard against infinite tool-calling loops
    this.lastRequestTime = 0; // For proactive throttling
    this._runStartTime = 0;
    this._runUsage = { prompt: 0, completion: 0, total: 0 };
    this._interrupted = false;
    this._abortController = null;
    this._didEmergencyPrune = false;
    this._cumulativePrunedExchanges = 0;
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
    this._interrupted = false;
    this._abortController = null;
    this._didEmergencyPrune = false;

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

    // Override process-level SIGINT handlers globally for the turn session
    const sigintListeners = process.listeners('SIGINT');
    for (const listener of sigintListeners) {
      process.off('SIGINT', listener as any);
    }

    const localSigint = () => {
      this._interrupted = true;
      if (this._abortController) {
        this._abortController.abort();
      }
      ui.stop();
    };
    process.on('SIGINT', localSigint);

    // Raw key listener on stdin to catch Ctrl+C (\u0003) while raw mode is active (TUI spinning/streaming)
    const onRawInput = (data: Buffer) => {
      if (data.toString() === '\u0003') {
        if (isPromptActive()) {
          return;
        }
        localSigint();
      }
    };
    if (process.stdin.isTTY) {
      process.stdin.on('data', onRawInput);
    }

    try {
      while (true) {
        if (this._interrupted) {
          break;
        }

        let turn = 0;
        let loopFinishedCleanly = false;

        while (turn < this.maxTurns) {
          if (this._interrupted) {
            break;
          }
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

            if (this._interrupted) {
              ui.stop();
              if (message.content && message.content.trim().length > 0) {
                const { thinking, response: responseText } = extractThinking(message.content);
                if (thinking.trim().length > 0) {
                  ui.log(formatThinkingOnly(thinking));
                }
                if (responseText.trim().length > 0) {
                  if (thinking.trim().length > 0) ui.log('');
                  ui.log(outputFormatted(responseText));
                }
              }
              break;
            }

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
              const { thinking, response: responseText } = extractThinking(message.content);
              
              if (thinking.trim().length > 0) {
                ui.stop(); // Stop thinking spinner before printing thinking
                const formattedThinking = formatThinkingOnly(thinking);
                ui.log(formattedThinking);
              }

              const hasResponse = responseText.trim().length > 0;
              const hasTools = Array.isArray(message.tool_calls) && message.tool_calls.length > 0;

              if (!hasTools) {
                ui.stop(); // Ensure thinking spinner is stopped
                if (hasResponse) {
                  if (thinking.trim().length > 0) {
                    // Keep a one line space gap between thinking and response
                    ui.log('');
                  }
                  const formattedResponse = outputFormatted(responseText);
                  ui.log(formattedResponse);
                } else if (thinking.trim().length === 0) {
                  logger.error('[System]: Model returned an empty final response.');
                }
                loopFinishedCleanly = true;
                break;
              }
            } else {
              const hasTools = Array.isArray(message.tool_calls) && message.tool_calls.length > 0;
              if (!hasTools) {
                ui.stop();
                logger.error('[System]: Model returned an empty final response.');
                loopFinishedCleanly = true;
                break;
              }
            }

            // Execute and record tool calls (spinner transition handled inside)
            await this._processToolCalls(message.tool_calls);

            if (this._interrupted) {
              break;
            }

          } catch (err: any) {
            ui.fail();
            if (this._interrupted || err.name === 'AbortError') {
              ui.stop();
              break;
            }
            const errStr = (err.message || '').toLowerCase();
            // Deep error logging for API failures
            if (err.status) {
              logger.error(`[API Error] Status: ${err.status}`);
              if (err.response?.data) {
                 logger.error(`[API Error] Details: ${JSON.stringify(err.response.data)}`);
              }
            } else if (err.name === 'AbortError' || errStr.includes('timeout')) {
              logger.secondary(`[Timeout Error]: The AI took too long to respond (60s).`);
            } else {
              logger.error(`[Error]: ${err.message || err}`);
            }
            throw err;
          }
        }

        if (!loopFinishedCleanly && turn >= this.maxTurns && !this._interrupted) {
          logger.secondary("[System]: Reached maximum conversation turns. Ending session.");
        }

        this._printStats();

        // Reset interrupted flag for the follow-up wait state
        this._interrupted = false;

        // Wait for exit or follow-up request
        const action = await ui.waitForExit();
        if (action === 'exit') {
          return;
        }

        // If user selected 'followup', ask for query input
        let followUp = '';
        try {
          followUp = await ui.askFollowUp();
        } catch (e: any) {
          // If user hits Ctrl+C or cancels the input prompt, exit cleanly
          return;
        }

        if (!followUp || followUp.toLowerCase() === 'q') {
          return;
        }

        // Record the follow-up prompt
        this.addMessage('user', followUp);
        // Log spacing and a divider before next response
        ui.log('');
        // Reset start time for accurate statistics on the follow-up execution
        this._runStartTime = performance.now();
      }
    } finally {
      // Clean up event listeners and restore default SIGINT behaviors on shutdown
      if (process.stdin.isTTY) {
        process.stdin.off('data', onRawInput);
      }
      process.off('SIGINT', localSigint);
      for (const listener of sigintListeners) {
        process.on('SIGINT', listener as any);
      }
    }
  }

  async _getCompletion(): Promise<any> {
    this._pruneMessagesIfNeeded();

    let attempt = 0;
    const maxAttempts = 6;
    const minDelayBetweenRequests = 1000;

    while (attempt < maxAttempts) {
      if (this._interrupted) {
        throw new Error('Aborted');
      }

      this._abortController = new AbortController();

      try {
        if (attempt === 0) {
          const now = Date.now();
          const timeSinceLastRequest = now - this.lastRequestTime;
          if (timeSinceLastRequest < minDelayBetweenRequests) {
            const waitTime = minDelayBetweenRequests - timeSinceLastRequest;
            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(resolve, waitTime);
              this._abortController!.signal.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new Error('Aborted'));
              });
            });
          }
        }

        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: this.messages,
          tools: toolDefinitions as any,
          tool_choice: 'auto',
          stream: true,
        }, {
          signal: this._abortController.signal
        });

        this.lastRequestTime = Date.now();

        let fullContent = '';
        const toolCallsAccumulator: any[] = [];
        let streamingComponent: StreamingText | null = null;
        let finishReason = 'stop';

        // We already have turn-wide interrupt handling in BaseModel.run().
        // Here we just stream and check if this._interrupted was flipped.
        for await (const chunk of response as any) {
          if (this._interrupted) {
            break;
          }
          
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
              finish_reason: tool_calls.length > 0 ? 'tool_calls' : (this._interrupted ? 'stop' : finishReason),
              message: {
                role: 'assistant',
                content: fullContent,
                ...(tool_calls.length > 0 ? { tool_calls } : {}),
              }
            }
          ]
        };

      } catch (err: any) {
        if (this._interrupted || err.name === 'AbortError' || err.message === 'Aborted') {
          throw new Error('Aborted');
        }

        const isContextLengthError =
          err.code === 'context_length_exceeded' ||
          /context.length|maximum context|too many tokens/i.test(err.message || '');

        if (isContextLengthError && !this._didEmergencyPrune) {
          this._didEmergencyPrune = true;
          this._emergencyPrune();
          continue; // Retry immediately, no backoff delay
        }

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
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(resolve, finalDelay);
            this._abortController!.signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new Error('Aborted'));
            });
          });
          ui.update('Thinking');
          continue;
        }
        throw err;
      } finally {
        this._abortController = null;
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

  private _pruneMessagesIfNeeded(): void {
    const currentTotal = estimateMessagesTokens(this.messages);
    if (currentTotal > DEFAULT_CONTEXT_BUDGET_TOKENS * COMPACTION_TRIGGER_RATIO) {
      this._pruneHistory(4, COMPACTION_TRIGGER_RATIO);
    }
  }

  private _emergencyPrune(): void {
    this._pruneHistory(2, 0);
  }

  private _pruneHistory(userTurnsToKeep: number, targetRatio: number): void {
    let systemStartIndex = 0;
    if (this.messages[0]?.role === 'system') {
      systemStartIndex = 1;
    }
    
    let hasNotice = false;
    let noticeIndex = -1;
    if (this.messages[systemStartIndex]?.role === 'system' && this.messages[systemStartIndex].content.startsWith('[Context notice:')) {
      hasNotice = true;
      noticeIndex = systemStartIndex;
    }
    
    const startIndex = hasNotice ? noticeIndex + 1 : systemStartIndex;
    
    let userCount = 0;
    let tailStartIndex = this.messages.length;
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].role === 'user') {
        userCount++;
        if (userCount === userTurnsToKeep) {
          tailStartIndex = i;
          break;
        }
      }
    }
    
    const lastUserIndex = this.messages.map(m => m.role).lastIndexOf('user');
    if (tailStartIndex > lastUserIndex) {
      tailStartIndex = lastUserIndex;
    }
    
    if (startIndex >= tailStartIndex) {
      return;
    }
    
    const chunks: { indices: number[], tokenCount: number }[] = [];
    const visited = new Set<number>();
    
    for (let i = startIndex; i < tailStartIndex; i++) {
      if (visited.has(i)) continue;
      const msg = this.messages[i];
      
      if (msg.role === 'assistant' && Array.isArray(msg.tool_calls)) {
        const chunkIndices = [i];
        const toolCallIds = new Set(msg.tool_calls.map((tc: any) => tc.id).filter(Boolean));
        
        for (let j = startIndex; j < tailStartIndex; j++) {
          if (j !== i && !visited.has(j)) {
            const candidate = this.messages[j];
            if (candidate.role === 'tool' && toolCallIds.has(candidate.tool_call_id)) {
              chunkIndices.push(j);
            }
          }
        }
        
        for (const idx of chunkIndices) {
          visited.add(idx);
        }
        const tokenCount = estimateMessagesTokens(chunkIndices.map(idx => this.messages[idx]));
        chunks.push({ indices: chunkIndices, tokenCount });
      } else if (msg.role === 'tool') {
        let assistantIdx = -1;
        for (let j = startIndex; j < tailStartIndex; j++) {
          const candidate = this.messages[j];
          if (candidate.role === 'assistant' && Array.isArray(candidate.tool_calls)) {
            if (candidate.tool_calls.some((tc: any) => tc.id === msg.tool_call_id)) {
              assistantIdx = j;
              break;
            }
          }
        }
        
        if (assistantIdx !== -1) {
          const chunkIndices = [assistantIdx];
          const assistantMsg = this.messages[assistantIdx];
          const toolCallIds = new Set(assistantMsg.tool_calls.map((tc: any) => tc.id).filter(Boolean));
          for (let j = startIndex; j < tailStartIndex; j++) {
            if (j !== assistantIdx && !visited.has(j)) {
              const candidate = this.messages[j];
              if (candidate.role === 'tool' && toolCallIds.has(candidate.tool_call_id)) {
                chunkIndices.push(j);
              }
            }
          }
          for (const idx of chunkIndices) {
            visited.add(idx);
          }
          const tokenCount = estimateMessagesTokens(chunkIndices.map(idx => this.messages[idx]));
          chunks.push({ indices: chunkIndices, tokenCount });
        } else {
          visited.add(i);
        }
      } else {
        visited.add(i);
        const tokenCount = estimateMessagesTokens([msg]);
        chunks.push({ indices: [i], tokenCount });
      }
    }
    
    const indicesToPrune = new Set<number>();
    let currentTotalTokens = estimateMessagesTokens(this.messages);
    const targetTokens = DEFAULT_CONTEXT_BUDGET_TOKENS * targetRatio;
    
    let prunedCount = 0;
    for (const chunk of chunks) {
      if (currentTotalTokens <= targetTokens) break;
      for (const idx of chunk.indices) {
        indicesToPrune.add(idx);
      }
      currentTotalTokens -= chunk.tokenCount;
      prunedCount++;
    }
    
    if (indicesToPrune.size > 0) {
      this._cumulativePrunedExchanges += prunedCount;
      const noticeText = `[Context notice: ${this._cumulativePrunedExchanges} earlier tool-call exchanges were pruned from this session to stay within context limits. Earlier file reads/searches are no longer in context — re-read files if needed.]`;
      
      const newMessages = this.messages.filter((_, idx) => !indicesToPrune.has(idx));
      
      let newSystemStartIndex = 0;
      if (newMessages[0]?.role === 'system') {
        newSystemStartIndex = 1;
      }
      
      if (newMessages[newSystemStartIndex]?.role === 'system' && newMessages[newSystemStartIndex].content.startsWith('[Context notice:')) {
        newMessages[newSystemStartIndex] = { ...newMessages[newSystemStartIndex], content: noticeText };
      } else {
        newMessages.splice(newSystemStartIndex, 0, { role: 'system', content: noticeText });
      }
      this.messages = newMessages;
    }
  }
}
