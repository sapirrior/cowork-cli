# A sub package named providers for cowork-cli for handling connections to model service providers and executing responses

This package encapsulates interactions with the AI models, handles custom model client instantiations, manages context history, handles connection retries, and executes the conversation loop.

---

## File & Function Breakdown

### Core Modules

| File | Export / Item | Type | Description |
| :--- | :--- | :--- | :--- |
| `index.js` | `clientLoader` | Export | Initializes and retrieves an OpenAI client configured for the active provider. |
| | `BaseModel` | Export | The base class coordinator for LLM dialog, retry, and tool-handling loop. |
| | `DefaultModel` | Export | Handler for standard OpenAI-compatible endpoints. |
| | `GeminiModel` | Export | Handler for Google Gemini endpoints. |
| `client.js` | `clientLoader()` | Function | Returns a preconfigured `OpenAI` client instance. Strips trailing slashes from endpoint URLs. Disables client-side retries (`maxRetries: 0`) and sets a timeout of 60 seconds. |

---

### Model Classes (`models/` Sub-directory)

Contains base structures and specific subclasses to abstract vendor-specific requirements.

#### `BaseModel.js` (The Core Loop Handler)
Manages model response streams, automatic backoff, and parallel tool dispatch.

* **Key Constants & Settings:**
  - `TRANSIENT_NET_CODES`: Retries immediately on transient DNS or socket errors (`ECONNRESET`, `ETIMEDOUT`, `ECONNREFUSED`, `EAI_AGAIN`, `ENETUNREACH`, `EHOSTUNREACH`).
  - `maxTurns`: Capped at 15 turns to prevent infinite tool calling loops.
  - `MAX_BACKOFF_MS`: Caps linear/exponential delays at 30 seconds.
* **Key Functions:**
  - `addMessage(role, content, extra)`: Records message elements (roles: `user`, `assistant`, `system`, `tool`) in the active thread history array.
  - `run(query, systemPrompt)`: Executes the main multi-turn loop. Feeds back tool outputs, tracks token usage metrics, handles content warnings, and prints final formatted responses.
  - `handleResponse(message)`: Invoked after each turn. Appends the message to history. Can be overridden by subclasses.
  - `_getCompletion()`: Calls the OpenAI SDK completion API. Wraps executions in a retry handler.
  - `_getCompletionWithRetry(...)`: Coordinates linear backoff sleep periods (starts at 1s, scales linearly up to `MAX_BACKOFF_MS`) for connection failures.
  - `_processToolCalls(toolCalls)`: Executes a set of tool calls in parallel using `Promise.all`. Updates progress indicator components via TUI packages, and reports execution logs to the console.

#### `default.js` (`DefaultModel`)
Inherits direct capabilities from `BaseModel`. Intended for standard OpenAI compatibility.

#### `gemini.js` (`GeminiModel`)
Handles integration nuances unique to Google Gemini. 
* **Key Override:**
  - `handleResponse(message)`: Pushes the complete message payload (retaining API metadata properties such as `thought_signature`) to ensure multi-turn calls do not fail validation on subsequent context submissions.
