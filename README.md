# lets-ask-btw (btw)

A lightweight, powerful CLI companion and mini quick analyst designed for specific technical questions and rapid codebase insights.

**Note**: `lets-ask-btw` is not a general-purpose chatbot or autonomous agent. It is a technical companion and analytical tool focused on providing immediate, context-aware answers to targeted questions.

## Features

- **Multi-Model Support**: Works with OpenAI-compatible APIs and Google Gemini.
- **Smart Tool Integration**:
  - `readFile` & `readFileChunk`: Read files or specific line ranges with built-in binary detection.
  - `searchText`, `findFile` & `findDir`: Search through your codebase using regex for text, files, or directories.
  - `projectTree` & `readDir`: Generate visual directory structures or list contents efficiently.
  - `listTools`: Provide detailed documentation on all available tools and their usage.
- **Tight UI**: Zero-whitespace design with semantic tool logging and adaptive word-wrapping for a high-density terminal experience.
- **Robust Configuration**: Simple setup via `~/.env` with support for custom model URLs and types.

## Installation

Install globally via npm:

```bash
npm install -g lets-ask-btw
```

## Configuration

The tool loads configuration from a `.env` file located in your home directory (`~/.env`).

Create or update `~/.env` with the following variables:

```env
BTW_MODEL_NAME=your-model-name
BTW_MODEL_URL=https://api.provider.com/v1
BTW_MODEL_API_KEY=your-api-key
BTW_MODEL_TYPE=openai # or 'gemini'
```

## Model Recommendations

For the fastest and most reliable experience:
- **Use Non-Reasoning Models**: Standard models (like GPT-4o-mini or Gemini Flash) are recommended for quick technical queries.
- **Reasoning Models**: If you use a reasoning model (like o1 or DeepSeek-R1), it is recommended to append `/no_think` to your query or ensure the model is configured to return direct answers to minimize latency and terminal clutter.

## Usage

Once installed, you can use the `btw` command (or the entry script) followed by your query:

```bash
btw "How do I refactor the parser in this project?"
btw "Find all occurrences of 'TODO' in the src/ directory"
btw "Explain what the main.js file does"
```

## Help

For a full list of commands and flags:

```bash
btw --help
```

## License

[MIT](LICENSE)
