# TUI Package (`@haiku/tui`)

The `tui` package implements a state-driven, flicker-free terminal rendering engine for `cowork-cli`.

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
                    v
                  +----------------------------------+
                  |         [StateRenderer]          |
                  +----------------------------------+
                    | (Clear & Paint \x1b[H\x1b[J)
                    v
                  +----------------------------------+
                  |          [FrameBuffer]           |
                  +----------------------------------+
```

## 🧩 Components

- **`DocumentTree.ts`**: Owns the ordered tree of `ComponentNode` items (`TextNode`, `Spinner`, `InputBox`, `SelectionList`).
- **`FrameBuffer.ts`**: Pure viewport computation engine. Computes `DocumentFrame`, max scroll bounds, and line wrapping for arbitrary document heights.
- **`StateRenderer.ts`**: Atomic frame replacement engine. Clears the Alternate Screen Buffer top-left (`\x1b[H\x1b[J`) under synchronized output (`\x1b[?2026h` / `\x1b[?2026l`).
- **`TerminalEngine.ts`**: Orchestrates interactive lifecycle, 50ms debounced window resize (`SIGWINCH`), mouse wheel + trackpad natural scrolling (`\x1b[?1007h`), Arrow/PageUp/PageDown/Home/End keys, and primary scrollback history flushing upon exit (`flushHistoryToPrimaryScreen`).
- **`HistoryStore.ts`**: Retained-state memory store preserving all committed session output.

## 🚀 Usage Example

```typescript
import ui from './ui/main.js';

ui.start('Analyzing directory...');
ui.log('Scanning package.json');
ui.stop('Directory analyzed');

const choice = await ui.askSelection('Choose action:', ['Continue', 'Exit']);
```

## 📜 Terminal Invariants & Safety

1. **Alternate Screen Execution**: Interactive components run inside the Alternate Screen Buffer (`\x1b[?1049h`). Resizing or zooming (`Ctrl+` / `Ctrl-`) reflows document lines with zero ghost lines or scrollback corruption.
2. **Primary History Flush**: On process exit, the CLI exits Alternate Screen (`\x1b[?1049l`) and flushes `HistoryStore` content directly to standard `stdout`, leaving a single clean execution log in standard terminal scrollback.
