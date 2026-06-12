# 🚀 cowork-cli (`cwk`)

> **Stop waiting. Start knowing.**  
> A minimalist, context-aware AI co-processor that lives in your terminal and understands your codebase.

---

## ⚡ Quick Start

### 📦 Installation
```bash
npm install -g cowork-cli
```

### 🔑 Configuration
Set up your AI provider interactively. `cwk` supports **any** OpenAI-compatible API (Ollama, OpenRouter, Google Gemini, OpenAI, etc.).

```bash
# Open interactive login wizard (shows setup status & active configuration)
cwk --login

# Or directly switch to / setup a specific provider
cwk --login google
cwk --login openai
cwk --login openrouter
cwk --login local
```
*Credentials are saved in `~/.config/cowork/auth.json`.*

---

## 💡 Real-World Usage

Instead of open-ended chatting, `cwk` **investigates** your project using safe, built-in tools (which respect `.gitignore`).

### 🔍 Codebase Exploration
```bash
cwk "Where is the authentication logic handled?"
```
*`cwk` recursively traverses folders, resolves imports, and prints a precise summary.*

### 🐛 Debugging & Analysis
```bash
cwk "Find all 'FIXME' tags in src/ and point out the most critical one"
```

### 🧬 Piping Inputs
```bash
git diff | cwk "Write a clean commit message for these changes"
```

---

## ✨ Features That Matter

* **🔌 Universal Compatibility**: Seamless support for OpenAI, local models (Ollama/Llama), OpenRouter, and dedicated handlers for **Google Gemini** (preserving thought metadata).
* **🖥️ Zero-Whitespace UI**: Clean, high-density terminal layouts designed for developers.
* **🎨 Markdown Rendering**: Custom TUI compiler rendering headings, lists, tables, bold styling, and blockquotes with full CJK character width support.
* **🔧 Powerful Tool Suite**:
  * `searchText` (Regex searches with context window lines)
  * `readManyFiles` (Consolidated matching file reader)
  * `projectTree` (Visual directory structure overview)
  * `webSearch` & `webFetch` (Browse the web / read live docs inline)
* **🛡️ Sandboxed I/O**: Safe path validation preventing directory traversal attacks.

---

## 🏗️ Project Architecture

The codebase is split into modular packages under `src/packages/`:

```
src/
├── bin/          # CLI executable entrypoint (cli.js)
├── core/         # CLI argument and stdin pipelines (index.js)
└── packages/     # Isolated packages with clean public APIs:
    ├── 🤖 agent/     # Agent loops & tool execution (searchText, readManyFiles, etc.)
    ├── ⚙️ config/    # Configuration manager and login wizard prompts
    ├── 🔌 providers/ # LLM integration handlers (BaseModel, GeminiModel, client)
    ├── 🎨 tui/       # Console rendering engine, custom layout component loops
    └── 🛠️ utils/     # Ignore file parsers, logging colors, and path safety
```

---

## ⌨️ CLI Command Reference

| Command | Action |
| :--- | :--- |
| `cwk "<query>"` | Run a one-shot analysis on your codebase. |
| `cwk -l`, `--login [provider]` | Interactive setup or active provider switch (`google`, `openai`, `openrouter`, `local`). |
| `cwk -v`, `--version` | Print the active version. |
| `cwk -h`, `--help` | Show usage options. |
