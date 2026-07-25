# A sub package named tui for haiku-67 for managing the interactive terminal interface and custom layout engine

This package provides a lightweight, reactive terminal UI framework to render live spinners, handle interactive selection menus, prompt for user keyboard input, and format styled console responses.

---

## File & Function Breakdown

### Exporters & Configurations

| File | Export / Item | Type | Description |
| :--- | :--- | :--- | :--- |
| `index.ts` | `ui` | Export | Instantiated singleton `UIEngine` from `ui/main.ts`. |
| | `outputFormatted` | Export | Markdown-to-ANSI formatter from `ui/outputFormatter.ts`. |
| | `loginForm` | Export | High-level interactive form controller module from `ui/loginForm.ts`. |
| `test.js` | None | Script | Test/validation script for exercising UI elements. |

---

### UI Core Modules (`ui/` Sub-directory)

Holds the controller code split from the previous monolithic UI module.

* #### `main.ts` (`UIEngine` Class)
  Initializes `TerminalEngine` and handles interface entry points.
  - `start(label, data)`: Displays a loader spinner with a custom message.
  - `think()`: Starts the thought/thinking spinner.
  - `update(data)`: Refreshes data parameters inside active spinners.
  - `stop(msg)`: Commits the spinner with a green confirmation dot.
  - `fail(msg)`: Commits the spinner with a red failure dot.
  - `log(text)`: Outputs standard print streams without overlapping active components.
  - `header(title)` / `footer(duration)`: Prints styled layout sections.
  - `ask(question)` / `confirm(question)`: Defers to the prompt helpers.

* #### `prompt.ts`
  Interactive prompt loop routines.
  - `ask(uiInstance, question)`: Renders input components with inline text. Listens for character strokes, backspace `\x7f`, pasting, home/end, delete, and arrow-key cursor navigation. Resolves text strings, or rejects on Ctrl+C cancels.
  - `confirm(uiInstance, question)`: Arrow-key toggle prompt. Displays styled selection lines for Yes/No options.

* #### `loginForm.ts`
  High-level interactive form controllers for the setup and login system.
  - `selectProvider(uiInstance, items)`: Arrow-key selectable list menu.
  - `inputField(uiInstance, options)`: Horizontal bordered user-input prompt.
  - `runFieldSequence(uiInstance, fields)`: Sequences multiple credential fields.

* #### `spinner.ts`
  Helper functions for rendering active progress animations.
  - `start`, `think`, `update`, `stop`, `fail` implementations.
  - `abortActiveSpinner(uiInstance)`: Force unmounts active spinner components from the draw loop.
  - `commitSpinner(uiInstance, msg, color)`: Replaces active spinners with a static status line showing a colored dot indicator.

* #### `format.ts`
  Text styling ANSI helpers.
  - `rgb(rgbArr, text)`: Encapsulates text inside TrueColor ANSI sequences (`\x1b[38;2;R;G;Bm...`).
  - `bold(text)` / `dim(text)`: Returns text enclosed in bold and dim ANSI modifiers.

* #### `theme.ts`
  Centralizes the TUI color configuration system by loading color accents from config.json and providing type-safe color formatter helpers.

* #### `outputFormatter.ts`
  Markdown rendering helper. Parses standard markdown strings (headings, bold text, blocks, inline quotes, and URLs) and outputs ANSI-styled equivalents to match terminal color templates.

---

### UI Component Drawing Engine (`engine/` Sub-directory)

A lightweight component frame loop implementation.

* #### `TerminalEngine.ts`
  Calculates string boundaries (resolving CJK characters and Emoji width differences) and performs differential writing.
  - `mount(comp, options)`: Registers a component.
  - `unmountAll()`: Unregisters all components.
  - `render()`: Calculates line heights, matches dirty states, and draws diff frames using `readline` cursor control.

* #### `Component.ts`
  Superclass representing UI view elements. Implements `setState(state)` to request redraw frames from parent engines.

* #### UI Elements (`engine/components/` Sub-directory)
  - `Spinner.ts`: Renders live text loaders and frames for rotating characters.
  - `SelectionList.ts`: Highlights selected items in arrow-key selections.
  - `InputBox.ts`: Full-width horizontal bordered layout for in-line text input and error messages (supports cursor navigation, in-place editing, pasting, and wrapping).
  - `ProviderSelector.ts`: Non-boxed list selection menu showing ticks, active status, and custom highlights.
