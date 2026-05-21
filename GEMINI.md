# Project Overview: lets-ask-btw

`lets-ask-btw` is a lightweight Node.js CLI tool designed to allow users to ask questions to AI models directly from their terminal. It uses the OpenAI SDK to interface with any OpenAI-compatible API and includes built-in tools for file system interaction.

## Architecture

The project follows a modular and hardened structure:

- **`bin/cli.js`**: The executable entry point for the CLI with global error boundaries.
- **`src/main.js`**: Orchestrates the flow and handles top-level commands.
- **`src/engine/`**: Core logic for AI interaction.
    - **`models/`**: Manages conversation history and the tool-calling loop.
        - `BaseModel.js`: Base class for history management.
        - `default.js`: Standard OpenAI-compatible handler.
        - `gemini.js`: Specialized handler for Gemini `thought_signature` preservation.
    - **`tools/`**: Built-in capabilities for the AI (e.g., `readFile`, `readDir`, `searchText`).
    - `client.js`: Manages OpenAI client initialization and URL normalization.
    - `run.js`: Instantiates the correct model handler based on configuration.
- **`src/utils/`**: Helper functions and management.
    - `logger.js`: Centralized utility for colorized truecolor ANSI output.
    - `configManager.js`: Centralized utility for loading/saving configuration.
    - `helpMsg.js`: Colorized CLI help interface.
    - `setConfig.js`: Interactive prompt for API settings (now includes `model_type`).
- **`src/configs/`**: Stores local configuration.
    - `user.json`: Stores model settings, including the explicit `model_type`.
    - `config.json`: Defines the UI theme and accent colors.

## Features

- **Tool Calling**: The AI can autonomously read files, list directories, and search for text to provide better context-aware answers.
- **Gemini Support**: Full support for Gemini models via OpenAI-compatible APIs, including mandatory `thought_signature` handling.
- **Colorized UI**: High-contrast, colorized terminal output using hex-to-ANSI conversion.
- **Explicit Model Types**: Configure your provider type (e.g., `openai`, `gemini`) to ensure correct protocol handling.

## Building and Running

### Prerequisites
- Node.js (v18+)
- npm

### Installation
```bash
npm install
```

### Configuration
Before using the tool, you must configure your API settings:
```bash
# Set up model, URL, key, and provider type
btw --config
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
- **Logging**: Always use `src/utils/logger.js` for console output.
- **Tool Development**: New tools should be added to `src/engine/tools/` and registered in `src/engine/tools/index.js`.
- **Model Handling**: Provider-specific logic belongs in `src/engine/models/`.

## TODOs / Known Issues
- Add unit tests for tool implementations and history logic.
- Implement support for multiple profiles/configurations.
- Add support for interactive chat mode (REPL).
