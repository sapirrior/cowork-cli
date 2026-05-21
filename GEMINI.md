# Project Overview: lets-ask-btw

`lets-ask-btw` is a lightweight Node.js CLI tool designed to allow users to ask questions to AI models directly from their terminal. It uses the OpenAI SDK to interface with any OpenAI-compatible API and includes built-in tools for file system interaction.

## Architecture

The project follows a modular and hardened structure:

- **`bin/cli.js`**: The executable entry point for the CLI with global error boundaries and cursor management.
- **`src/main.js`**: Orchestrates the flow and handles top-level commands.
- **`src/engine/`**: Core logic for AI interaction.
    - **`models/`**: Manages conversation history and the tool-calling loop.
        - `BaseModel.js`: Base class for history management, exponential backoff, and robust tool execution.
        - `default.js`: Standard OpenAI-compatible handler.
        - `gemini.js`: Specialized handler for Gemini `thought_signature` preservation.
    - **`tools/`**: Built-in capabilities for the AI (e.g., `readFile`, `readDir`, `searchText`).
    - `client.js`: Manages OpenAI client initialization and URL normalization.
    - `run.js`: Instantiates the correct model handler based on configuration.
- **`src/utils/`**: Helper functions and management.
    - `ui.js`: Manages terminal animations (spinners) and cursor visibility.
    - `logger.js`: Centralized utility for colorized truecolor ANSI output.
    - `configManager.js`: Centralized utility for loading configuration from `~/.env`.
    - `helpMsg.js`: Colorized CLI help interface.
- **`src/configs/`**: Stores static configuration.
    - `config.json`: Defines the UI theme and accent colors.

## Features

- **Tool Calling**: The AI can autonomously read files, list directories, and search for text.
    - **Powerful Search**: Supports optional recursion, respects `.gitignore`, automatically skips binary files, and enforces strict context safety limits (max matches per file/total) to prevent context bloat.
    - **Safe Web Fetching**: `webFetch` tool for reading documentation/APIs with built-in SSRF protection (blocks private/reserved IPs), 10s timeouts, and aggressive HTML stripping to minimize context usage.
- **Visual Feedback**: Includes a minimalist text-based "thinking" animation and clean, bracketed tool execution logs (no emojis or symbols).
- **Robustness**: 
    - **Advanced Retries**: Automatically retries transient API errors (429, 5xx) using exponential backoff with jitter and strict adherence to `Retry-After` headers.
    - **Proactive Throttling**: Enforces a minimum delay between API requests to prevent rapid-fire tool-calling loops from triggering rate limits.
    - **Error Recovery**: Self-correcting tool-calling loop that feeds execution errors back to the model.
    - **Clean Exits**: Uses `process.exitCode` for reliable stream flushing and signal handling for Ctrl+C.
- **Gemini Support**: Full support for Gemini models via OpenAI-compatible APIs, including mandatory `thought_signature` handling.

## Building and Running

### Prerequisites
- Node.js (v18+)
- npm

### Installation
```bash
npm install
```

### Configuration
Before using the tool, you must manually configure your API settings in your `~/.env` file:
```env
BTW_MODEL_NAME=your-model-name
BTW_MODEL_URL=your-model-base-url
BTW_MODEL_API_KEY=your-api-key
BTW_MODEL_TYPE=openai-or-gemini
```

### Usage
```bash
# Ask a question (AI can use tools if needed)
btw "Search for 'TODO' in the src folder and summarize them."

# Show help
btw --help
```

## Development Conventions

- **Module System**: Uses ES Modules.
- **UI & Logging**: Use `src/utils/ui.js` for animations and `src/utils/logger.js` for console output.
- **Stability**: Ensure all async operations are wrapped in the top-level CLI error boundary.
- **Security**: Never commit secrets. Users are responsible for managing their `~/.env` file.

## TODOs / Known Issues
- Add unit tests for tool implementations and history logic.
- Implement support for multiple profiles/configurations.
- Add support for interactive chat mode (REPL).
