# lets-ask-btw (btw) 🚀

`lets-ask-btw` (`btw`) is a hardened, minimalist Node.js Developer Analyst tool. It is designed for high-density, context-aware codebase investigation using any OpenAI-compatible API, with first-class support for Gemini 3.1+ models.

## 🏗️ Architecture

The project is built as a **Codebase Co-processor**—a tool that lives in the terminal to provide actionable intelligence in a single turn.

### Core Components
- **`bin/cli.js`**: The executable entry point. Manages global error boundaries and graceful signal handling.
- **`src/main.js`**: Orchestrator. Handles argument parsing and configuration loading.
- **`src/engine/`**: The analytical core.
    - **`models/`**: State-aware handlers.
        - `BaseModel.js`: Core logic for tool-execution loops and exponential backoff.
        - `gemini.js`: Specialized handler for Google Gemini models, preserving the mandatory `thought_signature`.
    - **`tools/`**: The analyst's "senses"—`searchText`, `findFile`, `projectTree`, and the interactive `askUser`.
- **`src/utils/`**:
    - `outputFormatter.js`: Dynamic terminal wrapping that preserves structure without Markdown.
    - `logger.js`: Zero-whitespace, action-oriented logging (`[reading]`, `[searching]`).

## ✨ Key Features

- **Analyst Persona**: Enforced via a strict system prompt that prioritizes technical investigation and bans conversational filler.
- **Universal Compatibility**: Works with **any** OpenAI-compatible endpoint (OpenRouter, Ollama, etc.).
- **Tight UI Philosophy**:
    - **Zero-Whitespace**: Maximal information density.
    - **No Markdown**: Pure plain-text output optimized for raw terminal environments.
    - **Semantic Action Logs**: Real-time feedback using action-oriented verbs.
- **Discovery Power**:
    - **Smart Trees**: `projectTree` respects `.gitignore` for noise-free mapping.
    - **Surgical Search**: Regex-based `searchText` and `findFile` for pinpoint accuracy.
- **Interactive Intelligence**:
    - **`askUser`**: Allows the AI to pause execution and request specific feedback or clarification via a high-density terminal prompt.
- **Context Injection**: Automatically injects current workspace path and time into the model context.

## ⚙️ Configuration

Managed via a global `~/.env` file.

```env
BTW_MODEL_NAME=google/gemini-3.1-pro  # e.g., via OpenRouter
BTW_MODEL_URL=https://openrouter.ai/api/v1
BTW_MODEL_API_KEY=your-secret-key
BTW_MODEL_TYPE=openai                 # 'openai' or 'gemini'
```

## ⌨️ Usage

Designed for one-shot technical queries.

```bash
# Investigative Query
btw "How is error handling implemented in the engine?"

# Pattern Discovery
btw "Find all occurrences of 'FIXME' and analyze the technical debt."

# System Commands
btw -v        # Show version
btw --help    # Show help
```

## 🛠️ Development Conventions

- **Minimalism**: Maintain zero dependencies beyond core AI clients and basic utilities.
- **Density**: Every tool output and log must be as compact as possible.
- **Analyst-First**: Features must enhance the tool's ability to investigate code autonomously.

---

*“btw... stop waiting, start knowing.”*
