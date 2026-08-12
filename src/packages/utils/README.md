# Utilities Package (`@sapirror/sonnet-cli` — utils)

This package contains low-level helpers for terminal color formatting, path safety (`safePath`), CLI help messages, and gitignore rule parsing.

---

## File & Function Breakdown

### Core Modules

| File | Export / Item | Type | Description |
| :--- | :--- | :--- | :--- |
| `index.ts` | All helpers | Export | Bundles and exposes utility modules. |
| `helpMsg.ts` | `show_help` | Function | Prints usage guidance, parameter flags, and configuration examples when `sonnet -h` or `sonnet --help` is invoked. |
| `logger.ts` | `logger` | Object | Exposes system log wrappers (`main`, `secondary`, `normal`, `error`). Writes output cleanly via `process.stdout.write()`. |
| | `formatMain` | Function | Styles text using main brand blue (`#7BA5DA`). |
| | `formatSecondary`| Function | Styles text using tool amber (`#F2CF6E`). |
| | `formatDim` | Function | Styles text using dim grey (`#8F9399`). |
| | `formatError` | Function | Styles text using error red (`#E07070`). |
| | `formatHeader` | Function | Styles text using header purple (`#A37ACC`). |
| `fsUtils.ts` | `getIgnorePatterns` | Function | Loads default ignore rules plus root `.gitignore` pattern strings. Caches outputs. |
| | `loadNestedIgnores` | Function | Recursively loads and merges `.gitignore` files within subdirectories. |
| | `shouldIgnore` | Function | Matches a filename against active ignore list patterns. |
| | `safePath` | Function | Resolves paths against `process.cwd()` and throws errors if directory traversal is detected outside the workspace. |
| | `isSafeEntry` | Function | Assesses if a file or folder is safe to read (no symlinks, not ignored, within workspace boundary). |

---

## `fsUtils.ts` Implementation Rules

* **Default Ignores (`DEFAULT_IGNORES`):** Built-in ignore list for common build/environment directories (`node_modules`, `.git`, `.vscode`, `.idea`, `dist`, `.env`).
* **Ignore Limits:** Restricts loaded gitignore file reads to a maximum of 64KB (`MAX_GITIGNORE_SIZE`) to prevent performance overhead on oversized repositories.
* **Regex Translation (`globToRegex`):** Custom parser that transforms standard wildcard globs (`*`, `**`, `?`, `[abc]`) into clean `RegExp` objects.
