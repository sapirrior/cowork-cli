# Project Instructions: cowork-cli (cwk)

`cowork-cli` (`cwk`) is a high-speed, minimalist AI CLI analyst designed for developers. It functions as a context-aware co-processor that investigates codebases using a tool-calling loop to provide precise technical answers.

## Project Overview

- **Core Goal:** Provide rapid, non-conversational technical analysis of a codebase.
- **Technologies:** Node.js (ES Modules), OpenAI SDK, `dotenv`.
- **Key Features:**
  - Compatibility with any OpenAI-compatible API.
  - Specialized handler for Google Gemini models to preserve high-density analytical features (e.g., thought signatures).
  - Robust tool-calling suite for filesystem interaction and interactive user feedback.
  - High-density, minimalist terminal UI.

## Architecture

The project is organized into several key modules:

- `bin/cli.js`: The executable entry point. Handles global error boundaries and signal interrupts.
- `src/main.js`: Orchestrates the CLI flow: argument parsing, configuration loading, connectivity checks, and execution.
- `src/engine/run.js`: Prepares the system prompt and selects the appropriate model handler.
- `src/engine/models/`: Contains model interaction logic.
  - `BaseModel.js`: Encapsulates the core execution loop, message history, retry logic (exponential backoff), and tool dispatching.
  - `default.js`: Standard OpenAI-compatible implementation.
  - `gemini.js`: Specialized handler for Gemini models.
- `src/engine/tools/`: A collection of functional tools (e.g., `readFile`, `searchText`, `projectTree`) that the AI uses to explore the workspace.
- `src/utils/`: Shared utilities for configuration management, filesystem operations, logging, and UI formatting.

## Building and Running

### Prerequisites
- Node.js (v14+ recommended).
- An API key for an OpenAI-compatible provider (e.g., OpenAI, OpenRouter, Ollama).

### Setup
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure your environment in `~/.env`:
   ```env
   BTW_MODEL_NAME=your_model_name
   BTW_MODEL_URL=your_api_url
   BTW_MODEL_API_KEY=your_api_key
   BTW_MODEL_TYPE=openai # or 'gemini'
   ```

### Execution
- **Run directly:**
  ```bash
  node bin/cli.js "your query here"
  ```
- **Development Link:**
  ```bash
  npm link
  btw "your query here"
  ```

### Testing
- **TODO:** Implement unit and integration tests. The `package.json` contains a placeholder for `npm test`.

## Development Conventions

- **Module System:** Uses ES Modules exclusively.
- **Code Style:** Prefers a functional approach for tools and object-oriented structure for model handlers.
- **Documentation:** Use JSDoc for documenting functions and classes.
- **UI:** Adhere to the "Zero-Whitespace" philosophy. Keep output high-density and avoid unnecessary filler.
- **Error Handling:** Centralize error boundaries in `cli.js` and `BaseModel.js`. Use `logger.error` for user-facing errors.
- **Tool Development:** New tools should be added to `src/engine/tools/`, registered in `index.js`, and include clear descriptions and parameter definitions in `toolDefinitions`.
