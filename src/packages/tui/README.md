# TUI Package (`@sapirror/sonnet-cli` — tui)

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

- **`DocumentTree.ts`**: Owns the ordered tree of `ComponentNode` items.
- **`FrameBuffer.ts`**: Pure viewport computation engine.
- **`StateRenderer.ts`**: Atomic frame replacement engine.
- **`TerminalEngine.ts`**: Orchestrates interactive lifecycle, resize, scroll, and mouse.
- **`HistoryStore.ts`**: Retained-state memory store for all committed session output.

## 🧩 UI Components (`engine/components/`)

| Component | Description |
| :--- | :--- |
| `Spinner.ts` | Animated spinner with rotating thought phrases |
| `InputBox.ts` | Text input widget with cursor tracking and wrapping |
| `SelectionList.ts` | Arrow-key navigable selection list |
| `ProviderSelector.ts` | Provider login selector |
| `ToolConfirmationCard.ts` | Lean, interactive tool confirmation card with content showcase, yellow vertical left border, and keybindings (`y`/`n`/`Enter`/`Esc`/`Tab`/`Ctrl+Y`/`Ctrl+N`/`Ctrl+E`/`Arrow keys`) |

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

// Prompt query output
ui.prompt(formatPromptQuery(query));
```

## 📜 Terminal Invariants & Safety

1. **Alternate Screen**: Interactive components run inside `\x1b[?1049h`.
2. **History Flush**: On exit, CLI flushes `HistoryStore` to primary scrollback (omitting `logo` and `prompt` entries to keep main scrollback clean).
3. **Component Independence**: Each component in `engine/components/` is fully self-contained and extends `Component` base class.
