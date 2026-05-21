# Project Overview: lets-ask-btw

`lets-ask-btw` is a lightweight Node.js CLI tool designed to allow users to ask questions to AI models directly from their terminal. It uses the OpenAI SDK to interface with any OpenAI-compatible API.

## Architecture

The project follows a modular and hardened structure:

- **`bin/cli.js`**: The executable entry point for the CLI.
- **`src/main.js`**: The main application logic that handles command-line arguments and orchestrates the flow.
- **`src/engine/`**: Contains core logic for AI interaction.
    - `client.js`: Manages the OpenAI client initialization with configuration validation.
    - `run.js`: Handles the streaming of AI completions with robust error reporting.
- **`src/utils/`**: General helper functions and management.
    - `configManager.js`: Centralized utility for loading, saving, and validating user configuration.
    - `helpMsg.js`: Defines and displays the CLI help message.
    - `setConfig.js`: Provides an interactive prompt to configure API keys and model settings.
- **`src/configs/`**: Stores local configuration.
    - `user.json`: Stores the model name, base URL, and API key (managed by `configManager.js`).

## Building and Running

### Prerequisites
- Node.js (v14+)
- npm

### Installation
```bash
npm install
```

### Configuration
Before using the tool, you must configure your API settings:
```bash
# Using the local script
node bin/cli.js --config

# Or using the linked command (if npm link is used)
btw --config
```

### Usage
```bash
# Ask a question
btw "How do I use file operations in Node.js?"

# Show help
btw --help
```

### Testing
There are currently no automated tests implemented.
```bash
npm test # Currently placeholder
```

## Development Conventions

- **Module System**: Uses ES Modules (`type: "module"` in `package.json`).
- **Configuration**: Managed centrally via `src/utils/configManager.js`.
- **Naming**: Follows camelCase for functions and variables.
- **Error Handling**: Comprehensive try-catch blocks with user-friendly error messages and troubleshooting tips.
- **Clean Exit**: The process explicitly exits after completing its task to ensure no hanging handles.

## TODOs / Known Issues
- Add unit tests for `configManager.js` and engine logic.
- Implement more advanced CLI argument parsing (e.g., using `commander` or `yargs`).
- Add support for multiple profiles/configurations.
