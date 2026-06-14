# A sub package named utils for cowork-cli for housing core utilities for safe paths, CLI help guidelines, console logs, and ignore rules

This package contains low-level helpers used across all package directories for system status output formatting, directory traversal validation, and gitignore configuration resolution.

---

## File & Function Breakdown

### Core Modules

| File | Export / Item | Type | Description |
| :--- | :--- | :--- | :--- |
| `index.ts` | All helpers | Export | Bundles and exposes utility modules. |
| `helpMsg.ts` | `show_help` | Function | Prints usage guidance, parameter flags, and configuration examples to the console when `cowork -h` or `cowork --help` is requested. |
| `logger.ts` | `logger` | Object | Exposes print wrappers (`main`, `secondary`, `error`). |
| | `formatMain` | Function | Styles text using green colors. |
| | `formatSecondary`| Function | Styles text using yellow colors. |
| | `formatDim` | Function | Styles text using dimmed/gray colors. |
| | `formatError` | Function | Styles text using red colors. |
| | `formatHeader` | Function | Styles text using bold magenta headers. |
| `fsUtils.ts` | `getIgnorePatterns` | Function | Loads default ignore rules plus root `.gitignore` pattern strings. Caches outputs. |
| | `loadNestedIgnores` | Function | Recursively loads and merges `.gitignore` files within subdirectories. |
| | `shouldIgnore` | Function | Matches a filename against ignore list patterns. Handles negation (`!`) and path-scoped separators. |
| | `safePath` | Function | Resolves paths against `process.cwd()` and throws errors if directory traversal is detected. |
| | `isSafeEntry` | Function | Assesses if a file or folder is safe to read (no symlinks, not ignored, within workspace boundary). |

---

## Sub-module Details

### `fsUtils.ts` Implementation Rules
* **Default Ignores (`DEFAULT_IGNORES`):** Built-in ignore list for common environment directories (`node_modules`, `.git`, `.vscode`, `.idea`, `dist`, `.env`).
* **Ignore Limits:** Restricts loaded gitignore file reads to a maximum of 64KB (`MAX_GITIGNORE_SIZE`) to prevent performance overhead on oversized repositories.
* **Regex Translation (`globToRegex`):** Custom parser that transforms standard wildcard globs (`*`, `**`, `?`, `[abc]`) into clean `RegExp` objects.
