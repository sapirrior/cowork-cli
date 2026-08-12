# Provider Package (`@sapirror/sonnet-cli` — providers)

This package encapsulates interactions with AI model services, handles OpenAI client instantiations, manages context history, handles streaming completions with real-time TUI feedback and connection retries, and executes the conversation loop.

---

## File & Function Breakdown

### Core Modules

| File | Export / Item | Type | Description |
| :--- | :--- | :--- | :--- |
| `index.ts` | `clientLoader` | Export | Initializes and retrieves an OpenAI client configured for the active provider. |
| | `BaseModel` | Export | Base class coordinator for LLM dialog, retries, and tool execution loops. |
| | `DefaultModel` | Export | Handler for standard OpenAI-compatible endpoints. |
| | `GeminiModel` | Export | Handler for Google Gemini endpoints. |
| `client.ts` | `clientLoader()` | Function | Returns a preconfigured `OpenAI` client instance. Strips trailing slashes from endpoint URLs. Disables client-side retries (`maxRetries: 0`) and sets a timeout of 60 seconds. |

---

## Model Classes (`models/` Sub-directory)

### `BaseModel.ts` (The Core Loop Handler)
Manages model requests, streaming completions (`stream: true`) with live text and thinking segment rendering in the TUI, automatic backoff, and tool dispatch.

* **Key Constants & Settings:**
  - `TRANSIENT_NET_CODES`: Retries automatically on transient network error codes (`ECONNRESET`, `ETIMEDOUT`, `ECONNREFUSED`, `EAI_AGAIN`, `ENETUNREACH`, `EHOSTUNREACH`).
  - `maxTurns`: Capped at 15 turns to prevent infinite tool calling loops.
  - `MAX_BACKOFF_MS`: Caps exponential/linear retry delays at 30 seconds.
* **Key Functions:**
  - `addMessage(role, content, extra)`: Appends messages (`user`, `assistant`, `system`, `tool`) to conversation history.
  - `run(query, systemPrompt)`: Executes the main execution loop. Prints the TrueColor linear gradient logo and word-wrapped prompt, feeds back tool outputs, tracks token usage metrics, and calls `ui.waitForExit()` before returning.
  - `handleResponse(message)`: Invoked after each turn. Appends response payload to history. Overridden by `GeminiModel`.
  - `_getCompletion()`: Executes atomic streaming API requests (`stream: true`) and feeds chunks to `StreamingText` in real-time.
  - `_processToolCalls(toolCalls)`: Executes non-interactive tool calls in parallel using `Promise.all` while executing interactive tool calls (`askUser`, `askConfirm`, `writeFile`, `editFile`, `deleteFile`, `executeCommand`) sequentially to avoid terminal input collisions.

### `default.ts` (`DefaultModel`)
Standard OpenAI-compatible completion subclass inheriting from `BaseModel`.

### `gemini.ts` (`GeminiModel`)
Subclass for Google Gemini models. Retains vendor-specific metadata (such as `thought_signature`) in context message payloads.
