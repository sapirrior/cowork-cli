# A sub package named tui for Sonnet CLI for rendering terminal interface and layout engine

This package implements a state-driven, flicker-free, mouse-free terminal rendering engine, physical cell layout calculation, differential line updates, and interactive components for Sonnet CLI.

---

## File & Function Breakdown

### Core Modules

| File | Export / Item | Type | Description |
| :--- | :--- | :--- | :--- |
| `index.ts` | `ui` | Export | Facade object exposing high-level UI controls (`log`, `prompt`, `start`, `stop`, `ask`, `askFollowUp`, `confirmTool`, `cleanup`). |
| | `outputFormatted` | Export | Formats and converts markdown content into ANSI-styled strings. |
| | `formatPromptQuery` | Export | Formats user prompt queries for display in the terminal. |
| | `extractThinking` | Export | Extracts thinking blocks and final response text. |
| | `formatThinkingOnly` | Export | Formats thinking output blocks. |
| | `StreamingText` | Export | Dynamic text renderer supporting live streaming. |
| | `isPromptActive` | Export | Returns whether an interactive prompt is currently awaiting user input. |
| `theme.ts` | `THEME` | Export | Centralized terminal palette definitions and text stylers derived from `config.json`. |

---

## Engine Modules (`engine/` Sub-directory)

| File | Export / Item | Type | Description |
| :--- | :--- | :--- | :--- |
| `cell-layout.ts` | `wrapVisualLine` / `wrapByVisualWidth` | Function | Unicode-safe and ANSI-safe word wrapper preserving escape sequences across physical row boundaries. |
| | `measureNode` | Function | Measures a `ComponentNode` and breaks its logical lines into physical rows and local cursor offsets. |
| | `layoutDocument` | Function | Lays out the complete `DocumentTree` into flat physical rows and absolute `CellCursor`. |
| `DocumentTree.ts` | `DocumentTree` | Class | Manages the ordered tree of components and historical entries. |
| | `TextNode` | Class | Stored static line node supporting dynamic re-wrapping via `wrappable` flag and memoized `getLines(width)`. |
| `FrameBuffer.ts` | `computeDocumentFrame` | Function | Pure viewport computation operating on physical rows. Guarantees 1 line in `DocumentFrame` = 1 physical terminal row. |
| `StateRenderer.ts` | `StateRenderer` | Class | Line-diff renderer that rewrites only modified lines and avoids full-screen clears except during resize events. |
| `TerminalEngine.ts` | `TerminalEngine` | Class | Coordinates the alternate screen buffer (`\x1b[?1049h`), raw mode, vim-style keyboard scrolling, resize handling, and history flushing on exit. |
| `HistoryStore.ts` | `HistoryStore` | Class | Retained-state memory store for committed session logs and exit-flush lines. |
| `Component.ts` | `Component` | Class | Base class for UI components with batched frame requests and dirty-checking. |

---

## UI Components (`engine/components/` Sub-directory)

| Component | Description |
| :--- | :--- |
| `Spinner.ts` | Animated spinner with rotating thought phrases. |
| `InputBox.ts` | Text input widget with Unicode-safe and ANSI-safe cursor tracking and wrapping. |
| `SelectionList.ts` | Arrow-key navigable selection list. |
| `ProviderSelector.ts` | Provider login selector. |
| `ToolConfirmationCard.ts` | Lean, interactive tool confirmation card with yellow left border and keybindings. |
| `StreamingText.ts` | Dynamic text renderer supporting live streaming with real-time thinking extraction. |
| `FollowUpBox.ts` | Follow-up input box with thin grey borders (`> ` at left edge), placeholder, and consolidated wrap cursor math. |

---

## Supported Input Keybindings (`ui/prompt.ts`)

Both `ask()` and `askFollowUp()` share a single `handleInputKey()` function supporting:

| Key | Action |
| :--- | :--- |
| Left / Right Arrow | Move cursor one character |
| `Ctrl+Left` / `Alt+b` | Jump one word left |
| `Ctrl+Right` / `Alt+f` | Jump one word right |
| `Ctrl+Backspace` / `Ctrl+W` | Delete word to the left |
| Home / End | Jump to start / end of input |
| Backspace | Delete character to the left |
| Delete | Delete character to the right |
| Enter | Submit input |
| `Ctrl+C` | Cancel prompt |

---

## Terminal Invariants & Safety

1. **Alternate Screen**: Interactive components run inside `\x1b[?1049h`. Permanent rawMode is enabled during alternate screen mode.
2. **Line-diff rendering**: `StateRenderer` never clears the full screen unless `forceFull` is set (resize events). Only changed lines are rewritten, eliminating flicker during spinner ticks and streaming.
3. **Width cache**: `TerminalEngine` owns a single `Map<string, number>` for `stringWidth` results. History lines are immutable so cache entries are permanent and never need eviction.
4. **Unicode-safe slicing**: All text wrapping in `InputBox`, `FollowUpBox`, and `cell-layout.ts` uses `wrapVisualLine()` / `wrapByVisualWidth()`, which iterates codepoints and respects wide characters (CJK, emoji) without splitting escape sequences.
5. **Batched frames**: `Component.setState()` always calls `engine.requestFrame()` but the `dirty` flag guard ensures multiple `setState()` calls within the same synchronous event produce exactly one repaint on the next tick.
6. **Zero Mouse Tracking**: All mouse tracking escape sequences (`?1000h`/`1002h`/`1006h`/`1007h`) are completely removed to prevent Termux stdin corruption.
7. **History Flush**: On exit, CLI flushes `HistoryStore` to primary scrollback (omitting `logo` and `prompt` entries).
