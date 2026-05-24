# 🚀 cowork-cli (cwk)

**Stop waiting. Start knowing.**

`cowork-cli` (`cwk`) is the ultimate high-speed CLI Analyst for developers who need answers, not a conversation. It's a minimalist, context-aware co-processor that lives in your terminal and understands your code as well as you do.

## 🔥 Universal AI Power

Think your favorite model won't work? **Think again!** `cwk` is built to be compatible with **any** (yes, ANY!) OpenAI-compatible API endpoint on the planet.

Whether you're running local models via Ollama, using specialized providers, or tapping into the world's most powerful LLMs via **OpenRouter**, `cwk` has you covered.

### 🌟 Full Gemini Support
Love Google's Gemini models? We do too. `cwk` features a specialized handler to preserve the high-density analytical capabilities of the Gemini suite, ensuring you get the best out of **Gemini 3.1 Pro** and **Flash**.

---

## 🛠️ Rapid Setup (OpenRouter Example)

Get up and running in seconds. Just point `cwk` to your provider in your `~/.env` file:

```env
# Example using OpenRouter to access Gemini 3.1 Pro
CWK_MODEL_NAME=google/gemini-3.1-pro
CWK_MODEL_URL=https://openrouter.ai/api/v1
CWK_MODEL_API_KEY=your_openrouter_key
CWK_MODEL_TYPE=openai
```

---

## ⚡ Real-World Usage

`cwk` doesn't just "chat"—it **investigates**. It uses a suite of built-in tools to map your project, search for patterns, and read files before giving you a hard-hitting, plain-text technical answer.

### 🔍 Explore your codebase
```bash
cwk "Where is the authentication logic handled?"
```
*`cwk` will automatically list directories, find relevant files, and peek at the code to give you a precise summary.*

### 🛠️ Debug like a pro
```bash
cwk "Find all 'FIXME' tags in src/ and tell me which one is most critical"
```

### 🧠 Instant Documentation
```bash
cwk "Explain the data flow in the engine/ models"
```

---

## ✨ Features that Matter

- **Zero-Whitespace UI**: High-density terminal output designed for professionals. No fluff, no headers, just data.
- **Interactive Feedback**: The AI can now ask you clarifying questions via the `askUser` tool when it needs more context.
- **Smart Discovery**: Built-in `searchText`, `findFile`, and `projectTree` tools that respect your `.gitignore`.
- **Surgical I/O**: Read entire files or specific line ranges (`readFileChunk`) with automatic binary detection.
- **Piping Support**: Pipe logs or diffs directly into `cwk` for instant analysis.

## 📦 Installation

```bash
npm install -g cowork-cli
```

## ⌨️ Commands

| Command | Description |
| :--- | :--- |
| `cwk "query"` | Run a one-shot analysis on your codebase. |
| `cwk -v`, `--version` | Display the current version of `cwk`. |
| `cwk --help` | Show the minimalist help menu. |

---

*“cwk... how does this work again?”*
