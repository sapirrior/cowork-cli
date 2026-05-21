# lets-ask-btw 🚀

`lets-ask-btw` (`btw`) is a hardened, minimalist Node.js CLI tool for interacting with AI models. It is designed for developers who want a fast, "no-fluff" terminal interface to OpenAI-compatible APIs, including full support for Gemini models.

## 🏗️ Architecture

The project is built with a focus on modularity, error resilience, and terminal performance.

### Core Components
- **`bin/cli.js`**: The executable entry point. Manages global error boundaries, cursor state, and graceful signal handling (Ctrl+C).
- **`src/main.js`**: Orchestrator. Handles initial argument parsing and executes the silent validation suite.
- **`src/engine/`**: The "brain" of the application.
    - **`models/`**: State-aware handlers for different AI provider requirements.
        - `BaseModel.js`: Core logic for history management, exponential backoff, and robust tool execution loops.
        - `default.js`: Optimized for standard OpenAI-compatible endpoints.
        - `gemini.js`: Specialized handler for Google Gemini models, preserving the mandatory `thought_signature`.
    - **`client.js`**: Manages OpenAI client instantiation and URL normalization.
- **`src/utils/`**: Shared utilities for a consistent DX.
    - `configManager.js`: Handles global `~/.env` loading and connectivity verification.
    - `ui.js`: Minimalist, non-intrusive terminal animations (spinners).
    - `logger.js`: Centralized truecolor ANSI logging with semantic levels.

## ✨ Key Features

- **Enforced Context Safety**:
    - **Visual Structure**: The `projectTree` tool generates a minimalist directory tree while respecting `.gitignore` patterns.
    - **Smart Search**: `searchText` supports regex across files/folders with recursion, respects `.gitignore`, and skips binary files.
    - **Safe File I/O**: `readFile` (1MB limit) and `readFileChunk` (range-based) include binary detection and async safety.
    - **Secure Web Fetching**: `webFetch` includes SSRF protection (blocking private IPs), HTML stripping, and strict timeouts.
- **Polished CLI Experience**:
    - **Terminal-Optimized**: A dynamic system prompt enforces plain-text structure, skipping Markdown to ensure clean rendering in all terminal environments.
    - **Context Injection**: Automatically injects `${folder}` (CWD) and `${year}` into the AI's system context for grounded responses.
    - **Tight UI**: Zero-whitespace design for a high-density, professional terminal feel.
    - **Transparent Tooling**: Bracketed, unindented tool logs provide clear visibility into AI actions without clutter.
- **Robustness by Default**:
    - **Silent Validation**: Every query is preceded by an automatic, silent configuration and connectivity check.
    - **Advanced Retries**: Implements exponential backoff with jitter and respects `Retry-After` headers for rate-limited APIs.
    - **Self-Correcting Loop**: Execution errors from tool calls are fed back to the AI for autonomous recovery.

## ⚙️ Configuration

The tool uses a global configuration system. You must manually manage your settings in a `~/.env` file.

```env
# Required Configuration
BTW_MODEL_NAME=your-model-id          # e.g., gpt-4o or gemini-1.5-pro
BTW_MODEL_URL=your-api-base-url       # e.g., https://api.openai.com/v1
BTW_MODEL_API_KEY=your-secret-key
BTW_MODEL_TYPE=openai                 # Options: 'openai' or 'gemini'
```

## ⌨️ Usage

The CLI enforces a single-argument query structure for precision. All multi-word queries must be wrapped in double quotes.

```bash
# General Query
btw "Explain the architecture of a Node.js stream."

# Tool-Assisted Query
btw "Search for 'FIXME' in src/ and summarize the technical debt."

# Display Help
btw --help
```

## 🛠️ Development Conventions

- **ES Modules**: The entire codebase uses native ESM.
- **Surgical Logic**: Logic is isolated into small, testable functions. Avoid threading state across unrelated layers.
- **No Dependencies**: Maintain a minimalist dependency tree (currently only `openai`, `dotenv`, and `ipaddr.js`).
- **Validation First**: Ensure all new features are preceded by appropriate validation logic in `configManager.js`.

---

*“btw... what was that command again?”*
