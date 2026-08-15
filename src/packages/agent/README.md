# A sub package named agent for sonnet for orchestrating LLM interactions, tool executions, and system loops

This package is responsible for loading system prompts, managing conversation state, determining model types, executing tool requests dispatched by the LLM, and handling error recovery.

---

## File & Function Breakdown

### Core Modules

| File | Export / Item | Type | Description |
| :--- | :--- | :--- | :--- |
| `index.ts` | `runQuery` | Export | Main executor of chat queries. |
| | `toolDefinitions` | Export | List of schemas for all supported tools. |
| | `dispatchTool` | Export | Dispatches tool execution based on tool name and arguments. |
| `run.ts` | `runQuery` | Function | Formats system prompts from `sys.txt` (replacing variables like `${folder}` and `${year}`), detects model type, instantiates the appropriate Model Handler subclass (`GeminiModel` or `DefaultModel`), and executes the agent loop. |

---

### Tools (`tools/` Sub-directory)

Every tool has an implementation file in `tools/` and a corresponding schema in `tools/index.ts`. All schemas enforce strict JSON constraints (`additionalProperties: false`, matching parameter types, etc.).

| File | Function / Schema Name | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- |
| `index.ts` | `dispatchTool(name, args)` | Dynamically calls the matching tool implementation from `toolImplementations` map. | Standardized error return if a tool is not found. |
| `readFile.ts` | `readFile` | Reads the entire content of a specific file. | Resolves using `safePath` to prevent directory traversal. Fits files `<1MB`. |
| `readDir.ts` | `readDir` | Lists immediate directory contents. | Outputs file names and types (`DIR`/`FILE`) with size details. |
| `projectTree.ts` | `projectTree` | Generates a visual directory tree structure. | Respects `.gitignore` and default exclusions recursively. |
| `readFileChunk.ts` | `readFileChunk` | Reads specific line ranges (1-based index) from a file. | Prevents high memory consumption on large codebases. |
| `searchText.ts` | `searchText` | Regular expression search within files and folders. | Returns matching lines with a configurable number of context lines (max 5). Rejects binary files. |
| `webFetch.ts` | `webFetch` | Downloads page content or JSON payloads from a URL. | Strips HTML tags (`script`, `style`, `nav`, etc.). Hardened with manual redirect handling and DNS check for SSRF protection. Approximates character limit to 15,000. |
| `webSearch.ts` | `webSearch` | Performs a web search using DuckDuckGo HTML. | Parses query results into title, URL, and snippet keys. Output is strictly returned in JSON format. Max 20 results. |
| `findFile.ts` | `findFile` | Finds files matching a filename regex pattern. | Recursively walks the directory (max depth 10) matching patterns. Max 15 results. |
| `findDir.ts` | `findDir` | Finds folders matching a folder name regex pattern. | Recursively walks directories matching patterns. Max 15 results. |
| `askUser.ts` | `askUser` | Solicits text input from the user in the console. | Suspends the visual loader/spinner during prompt lifecycle. |
| `askConfirm.ts` | `askConfirm` | Asks the user a binary yes/no confirmation prompt. | Returns boolean configuration `{ confirmed: true/false }` (controls agent iteration continue checks). |
| `gitDiff.ts` | `gitDiff` | Shows staged or unstaged diff output. | Restricts lines to max 500. Runs `git diff` safely via `execFile`. |
| `gitLog.ts` | `gitLog` | Shows git commit history logs. | Allows listing up to 50 commits with optional `--oneline` format. |
| `gitStatus.ts` | `gitStatus` | Exposes porcelain git working tree status. | Parses status indicators (`M`, `A`, `D`, etc.) and groups by Staged, Unstaged, and Untracked. |
| `readManyFiles.ts` | `readManyFiles` | Walks and consolidates matching text files. | Matches include/exclude globs. Automatically skips binary files unless explicitly requested. Filters out `.gitignore` files. Safe handle close lifecycle. |
| `writeFile.ts` | `writeFile` | Creates or overwrites a file. | Requires mandatory user confirmation. Resolves paths safely. |
| `editFile.ts` | `editFile` | Edits an existing file via string replacement. | Shows preview of changes and requires user confirmation. The target text must match exactly one location in the file. |
| `deleteFile.ts` | `deleteFile` | Permanently deletes a single file. | Cannot delete directories. Requires mandatory confirmation. |
| `executeCommand.ts` | `executeCommand` | Executes a shell command via bash securely. | Requires user confirmation. Enforces sandbox path boundaries, security guards against dangerous commands, non-interactive environment flags, configurable timeouts (default 60s, max 300s), and head+tail log truncation. |
