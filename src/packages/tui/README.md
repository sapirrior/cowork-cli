# TUI Package (`@sapirrior/sonnet-cli` — tui)

The `tui` package implements a state-driven, flicker-free terminal rendering engine for Sonnet CLI.

## 🏗️ Architecture

```
                  +----------------------------------+
                  |           [UI Layer]             |
                  +----------------------------------+
                                   |
                                   v
                  +----------------------------------+
                  |         [DocumentTree]           |
                  +----------------------------------+
                                   |
                                   v
                  +----------------------------------+
                  |        [TerminalEngine]          |
                  +----------------------------------+
                    | (Alternate Screen: \x1b[?1049h)
                    | lineWidthCache: Map<string,number>
                    v
                  +----------------------------------+
                  |         [StateRenderer]          |
                  +----------------------------------+
                    | (Line-diff renderer — only rewrites
                    |  changed lines; full repaint on resize)
                    v
                  +----------------------------------+
                  |          [FrameBuffer]           |
                  +----------------------------------+
```

## 🧩 Engine Modules (`engine/`)

| File | Description |
| :--- | :--- |
| `DocumentTree.ts` | Owns the ordered tree of `ComponentNode` items. |
| `FrameBuffer.ts` | Pure viewport computation. Accepts a `lineWidthCache` map so `stringWidth()` is called at most once per unique line string for the lifetime of the process. |
| `StateRenderer.ts` | **Line-diff renderer.** Keeps a `previousLines` snapshot and only emits cursor-move + text for lines that changed. Uses `\x1b[K` to erase stale trailing characters. Falls back to full clear (`\x1b[H\x1b[J`) only on `forceFull` (resize) or first paint. |
| `TerminalEngine.ts` | Orchestrates lifecycle, resize, scroll, mouse, and owns the shared `lineWidthCache` passed to every render call. |
| `HistoryStore.ts` | Retained-state memory store for all committed session output. |
| `Component.ts` | Base class. `setState()` batches all updates within the same synchronous tick into a single `requestFrame()` via the `dirty` flag guard. |

## 🧩 UI Components (`engine/components/`)

| Component | Description |
| :--- | :--- |
| `Spinner.ts` | Animated spinner with rotating thought phrases. |
| `InputBox.ts` | Text input widget with Unicode-safe cursor tracking and wrapping. Exports `wrapByVisualWidth(text, maxCols)` and `visualCursorOffset(text, charIndex)` helpers for use by other components. |
| `SelectionList.ts` | Arrow-key navigable selection list. |
| `ProviderSelector.ts` | Provider login selector. |
| `ToolConfirmationCard.ts` | Lean, interactive tool confirmation card with yellow left border and keybindings (`y`/`n`/`Enter`/`Esc`/`Tab`/`Ctrl+Y`/`Ctrl+N`/`Ctrl+E`/Arrow keys). |
| `StreamingText.ts` | Dynamic text renderer supporting live streaming with real-time thinking extraction. |
| `FollowUpBox.ts` | Follow-up input box with top/bottom borders, dim placeholder when empty, footer hints (`ctrl+c to cancel` / `Enter to send ↵`), Unicode-safe cursor, and word-level navigation. |

## ⌨️ Input Keybindings (`ui/prompt.ts`)

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

## 🚀 Usage

```typescript
import { ui } from './ui/main.js';

// Tool confirmation with content showcase preview
const { confirmed } = await ui.confirmTool({
  toolName: 'writeFile',
  action: 'Create file',
  target: 'src/utils/helper.ts (10 lines)',
  details: ['export function test() { return true; }'],
});

// Ask for user follow-up inline using FollowUpBox
const query = await ui.askFollowUp();
```

## 📜 Terminal Invariants & Safety

1. **Alternate Screen**: Interactive components run inside `\x1b[?1049h`.
2. **Line-diff rendering**: `StateRenderer` never clears the full screen unless `forceFull` is set (resize events). Only changed lines are rewritten, eliminating flicker during spinner ticks and streaming.
3. **Width cache**: `TerminalEngine` owns a single `Map<string, number>` for `stringWidth` results. History lines are immutable so cache entries are permanent and never need eviction.
4. **Unicode-safe slicing**: All text wrapping in `InputBox` and `FollowUpBox` uses `wrapByVisualWidth()`, which iterates codepoints and respects wide characters (CJK, emoji) — no byte-offset slicing.
5. **Batched frames**: `Component.setState()` always calls `engine.requestFrame()` but the `dirty` flag guard ensures multiple `setState()` calls within the same synchronous event produce exactly one repaint on the next tick.
6. **History Flush**: On exit, CLI flushes `HistoryStore` to primary scrollback (omitting `logo` and `prompt` entries).
