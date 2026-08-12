# 🌿 Sonnet CLI

<p align="center">
  <pre>
 ▛███▜   <b>Sonnet CLI</b>
▛█████▜  <i>Stop waiting. Start knowing.</i>
 ▘▘ ▝▝
  </pre>
</p>

An autonomous AI engineering co-worker that lives in your terminal, investigates codebases, writes and edits code, runs terminal commands, and verifies solutions.

---

## ⚡ Quick Start

### 📦 Installation
```bash
npm install -g @sapirrior/sonnet-cli
```

### 🔑 Configuration
Set up your AI provider interactively. `sonnet` supports **any** OpenAI-compatible API (Google Gemini, OpenAI, OpenRouter, Ollama, custom providers, etc.).

```bash
# Open interactive login wizard (shows setup status & active configuration)
sonnet --login

# Or directly switch to / setup a specific provider
sonnet --login google
sonnet --login openai
sonnet --login openrouter
sonnet --login ollama
sonnet --login custom
```
*Credentials are saved in `~/.config/sonnet/auth.json`.*

---

## 💡 Real-World Usage

Instead of open-ended chatting, `sonnet` **investigates, writes, edits, and executes** in your project using safe, built-in tools (which respect `.gitignore`).

### 🔍 Codebase Exploration
```bash
sonnet "Where is the authentication logic handled?"
```

### 🛠️ Code Editing & Refactoring
```bash
sonnet "Refactor the database connection pool in src/db.ts to use singleton pattern"
```

### ⚡ Build & Test Execution
```bash
sonnet "Run the build script and fix any TypeScript compilation errors in src/"
```

### 🧬 Piping Inputs
```bash
git diff | sonnet "Write a clean commit message for these changes"
```

---

## ✨ Features That Matter

* **🔌 Universal Provider Support**: Native support for Google Gemini (preserving thought metadata), OpenAI, OpenRouter, Ollama (local), and custom HTTP base endpoints.
* **⚡ Non-Streaming Stability**: Standard atomic completions (`stream: false`) ensuring zero chunk aggregation overhead and accurate token tracking.
* **🖥️ State-Driven TUI Engine**: Zero-flicker rendering powered by a `DocumentTree` state model operating inside the Alternate Screen Buffer (`\x1b[?1049h`).
* **🎨 24-Bit TrueColor Gradient Logo**: Beautiful TrueColor linear gradient logo (Deep Indigo Violet ➔ Electric Cyan) paired with randomly selected philosophical engineering quotes on each run.
* **🛡️ Symbol-Free Lean Tool Confirmation Cards**: Minimalist, text-first interactive tool confirmation UI with content showcase previews, framed along the left edge by a bright Yellow vertical border (`│`), and instant keybindings (`y`/`n`/`Enter`/`Esc`/`Tab`/`Ctrl+Y`/`Ctrl+N`/`Ctrl+E`/`Arrow keys`).
* **🧹 Clean Terminal Scrollback**: Alternate screen history filtering ensures the logo and prompt remain in the TUI screen, keeping your main terminal scrollback completely clean.
* **🔧 19 Agentic Tools**:
  * Read/Search: `readFile`, `readDir`, `projectTree`, `readFileChunk`, `searchText`, `findFile`, `findDir`, `readManyFiles`
  * Git/Web: `gitDiff`, `gitLog`, `gitStatus`, `webFetch`, `webSearch`
  * Mutating/Executing: `writeFile`, `editFile`, `deleteFile`, `executeCommand`
  * Interactive: `askUser`, `askConfirm`
* **🛡️ Path Sandboxing**: Resolves all file paths through `safePath` sandbox boundaries to prevent directory traversal.

---

## 🏗️ Project Architecture

```
src/
├── bin/          # Shell executable entrypoint (cli.ts)
├── core/         # CLI argument and stdin pipelines (index.ts)
└── packages/     # Subsystem packages:
    ├── 🤖 agent/     # Agent loops, tool implementations & dispatch protocol
    ├── ⚙️ config/    # Configuration manager and login credential wizard
    ├── 🔌 providers/ # LLM integration handlers (BaseModel, GeminiModel)
    ├── 🎨 tui/       # Terminal engine, DocumentTree, and ToolConfirmationCard
    └── 🛠️ utils/     # Ignore file parsers, path safety (safePath), and logger
```

---

## ⌨️ CLI Command Reference

| Command | Action |
| :--- | :--- |
| `sonnet "<query>"` | Run an autonomous engineering task on your codebase. |
| `sonnet -l`, `--login [provider]` | Interactive setup or active provider switch (`google`, `openai`, `openrouter`, `ollama`, `custom`). |
| `sonnet -v`, `--version` | Print active package version. |
| `sonnet -h`, `--help` | Show CLI help message. |

**Binaries / Aliases**: `sonnet`, `snt`

---

## 🤝 License

MIT © nolan stark
