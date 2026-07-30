# 🤖 AGENTS.md — Agentic Engineering Guidelines

Welcome, AI Coding Agent! This document contains machine-readable context, architectural rules, coding standards, and safety invariants for working on the `cowork-cli` codebase.

---

## 🎯 Executive Context

`haiku-67` is an agentic command-line developer assistant. It operates a context-aware tool execution loop in standard terminal environments.

*   **Tech Stack**: Node.js, TypeScript (Strict Mode), ES Modules (`"type": "module"`), OpenAI SDK, and raw ANSI Escape Codes (no heavy terminal library dependencies).
*   **Compilation & Runs**:
    *   Build codebase: `npm run build`
    *   Development run: `npm run dev -- <args>`
    *   Target binary output: `dist/bin/cli.js`

---

## 📁 Repository Directory Map

Keep edits confined within the appropriate package structure. Do not create new top-level directories.

*   **[bin/cli.ts](./bin/cli.ts)**: Shell executable entry point. Configures global error boundaries (`unhandledRejection`, `uncaughtException`, `SIGINT`) and restores the cursor on exit.
*   **[src/core/index.ts](./src/core/index.ts)**: Core CLI logic. Parses commands, reads from standard input (`stdin`), loads config, and initializes connectivity checks.
*   **src/packages/**: Subsystem packages:
    *   `agent/`: Orchestrates the agent loop, schedules tool invocations, and maps tool JSON schemas.
    *   `config/`: Manages user credentials, switches provider models, and runs the interactive setup wizard.
    *   `providers/`: Wraps OpenAI SDK implementations and handles provider overrides (like Gemini's thought signatures).
    *   `tui/`: Implements the rendering loop, differential visual outputs, spinners, inputs, and markdown formatter.
    *   `utils/`: Safe filesystem utilities, console logging, help text, and gitignore rule parsing.

---

## 🛠️ Codebase Invariants & Coding Standards

To maintain system compatibility and stability, you **must** adhere to these rules when editing the code:

### 1. File & Paths Safety (Invariants)
*   **Sandbox Boundaries**: All filesystem read/write operations must resolve paths through the `safePath` function located in **[fsUtils.ts](./src/packages/utils/fsUtils.ts)**. This prevents directory traversal attacks (`../../etc/passwd`).
*   **Symbolic Links**: Never resolve symbolic links when recursively scanning files. Throw errors or ignore symlinks to prevent loops or sandbox breakouts.
*   **Gitignore Rules**: Files matching active ignore patterns must be skipped. Always check file entries using `isSafeEntry()` before reading.

### 2. ES Module Structure
*   **Relative Imports**: You **must** include the `.js` extension on all relative import paths (e.g., `import { logger } from '../utils/index.js';`). Failure to include `.js` will result in module resolution crashes at runtime.
*   **JSON Handling**: Do not import JSON files directly without using fs-read loaders or satisfying experimental import requirements. Use standard `fs.readFileSync` for JSON objects.

### 3. Terminal UI Safety
*   **No Unbounded Prints**: Never use standard `console.log()` or `process.stdout.write()` while a TUI spinner or selector is active.
*   **Logger Abstraction & Persistence**: Always write messages through the `ui.log()` API in **[main.ts](./src/packages/tui/ui/main.ts)** (or call `engine.commit()`). This ensures the printed output is persisted inside the `HistoryStore` state, preventing it from being lost during terminal resize events. Never write user-visible output directly to standard streams.

### 4. Package Documentation Invariant
*   **Update Package READMEs**: Whenever you modify code or files within any package directory (e.g., inside `src/packages/`), you **must** update the corresponding package's `README.md` file to accurately reflect the changes (e.g., updated exported APIs, functions, arguments, models, or schemas).

---

## 🔄 The Agent System Loop & Tool Dispatch Protocol

If you are modifying the internal agent loop or adding new tools, understand the routing flow:

```
                  +----------------------------------+
                  |       [run.ts] (Initiator)       |
                  +----------------------------------+
                                   |
                                   v
                  +----------------------------------+
                  |  [BaseModel.ts] (Execution Loop) | <---+
                  +----------------------------------+     |
                    |                              ^       | (Next Turn)
     (Tool Calls)   |                              |       |
                    v                              |       |
+------------------------------------+             |       |
|    [tools/index.ts] (Router)       |             |       |
+------------------------------------+             |       |
  | (Non-Interactive)  | (Interactive)             |       |
  |                    |                           |       |
  v (Parallel)         v (Sequential)              |       |
+---------------+    +-----------------+           |       |
|  Promise.all  |    |  In-order run   |           |       |
+---------------+    +-----------------+           |       |
  |                    |                           |       |
  +---------> [Tool Output Result] ----------------+-------+
                                                   |
                                                   v (Final Turn)
                                           [Render Markdown]
```

### 1. Loop Control Flow ([BaseModel.ts](./src/packages/providers/models/BaseModel.ts))
*   **Max Turns**: Capped at 15 turns to prevent infinite execution loops.
*   **Network Retries**: Handles exponential backoff and linear delays when contacting API providers. Clamped at 30 seconds (`MAX_BACKOFF_MS`) to prevent the CLI from hanging indefinitely.
*   **Gemini Context Matching**: Push full response objects in `GeminiModel` to preserve vendor metadata (`thought_signature`), preventing validation errors on subsequent context submission turns.

### 2. Tool Scheduling Protocol
Tools are registered and schemas defined in **[tools/index.ts](./src/packages/agent/tools/index.ts)**.
*   **Parallel Execution**: Non-interactive tools (file read, directory grep, status checks) are executed concurrently using `Promise.all` to minimize processing latency.
*   **Sequential Execution**: Interactive tools (such as `askUser` or `askConfirm`) **must** be executed sequentially. This prevents multiple keyboard prompt listeners from intercepting terminal input simultaneously.

---

## 🧩 Extension Checklist: Implementing a New Tool

1.  **Code the Tool**: Create a new handler in `src/packages/agent/tools/` (e.g., `myTool.ts`). Always use `safePath` to resolve file paths.
2.  **Define Schema**: Define a strict JSON Schema representation under the `toolDefinitions` array in **[tools/index.ts](./src/packages/agent/tools/index.ts)**. Enforce `additionalProperties: false`.
3.  **Map Implementation**: Add your tool function to the `toolImplementations` lookup object in **[tools/index.ts](./src/packages/agent/tools/index.ts)**.
4.  **TUI Label**: Define a human-readable action description in the `TOOL_LABELS` lookup of **[BaseModel.ts](./src/packages/providers/models/BaseModel.ts)** so the TUI spinner renders cleanly.
