import readline from 'node:readline';

/**
 * Helper to calculate visible width of a string containing ANSI escape codes, CJK, or Emojis.
 */
function getStringWidth(str) {
  // Strip ANSI escape codes
  const clean = str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
  let width = 0;
  for (const char of clean) {
    const cp = char.codePointAt(0);
    if (cp === undefined) continue;
    // Check if character lies within CJK or Emoji wide ranges
    const isWide = (
      (cp >= 0x4e00 && cp <= 0x9fff) ||
      (cp >= 0x3400 && cp <= 0x4dbf) ||
      (cp >= 0x3000 && cp <= 0x30ff) || // Symbols, Hiragana, Katakana
      (cp >= 0xff00 && cp <= 0xffef) || // Fullwidth Forms
      (cp >= 0x1f000 && cp <= 0x1faff) || // Emojis
      (cp >= 0x20000 && cp <= 0x3ffff) // Extensions
    );
    width += isWide ? 2 : 1;
  }
  return width;
}

/**
 * Calculates the exact 0-indexed visual row where the cursor resides in the wrapping layout.
 */
function getVisualRowOfCursor(buffer, cursorLine, cursorColumn, termWidth) {
  let visualRow = 0;
  for (let i = 0; i < cursorLine; i++) {
    const line = buffer[i] || '';
    const visualWidth = getStringWidth(line);
    visualRow += Math.max(1, Math.ceil(visualWidth / termWidth));
  }
  const colIndex = Math.max(0, cursorColumn - 1);
  visualRow += Math.floor(colIndex / termWidth);
  return visualRow;
}

/**
 * TerminalEngine handles inline drawing of reactive components.
 * It manages cursor movement, frame ticking, and differential updates.
 */
export default class TerminalEngine {
  constructor() {
    this.components = [];
    this.previousBuffer = [];
    this.previousWidth = process.stdout.columns || 80;
    this.dirty = false;
    this.active = false;
    this.cursorHidden = false;
    this.previousCursor = null;
    this.previousCursorLine = undefined;

    // Listen to terminal resizing to recalculate visual text layout columns dynamically
    process.stdout.on('resize', () => {
      this.requestFrame();
    });

    // Restore terminal cursor visibility on exit
    process.on('exit', () => {
      this.showCursor();
    });
  }

  /**
   * Hide cursor safely.
   */
  hideCursor() {
    if (!this.cursorHidden) {
      process.stdout.write('\x1b[?25l');
      this.cursorHidden = true;
    }
  }

  /**
   * Show cursor safely.
   */
  showCursor() {
    if (this.cursorHidden) {
      process.stdout.write('\x1b[?25h');
      this.cursorHidden = false;
    }
  }

  /**
   * Mounts a component to the engine layout.
   */
  mount(component, options = {}) {
    component.engine = this;
    this.components.push(component);
    
    if (options.keepCursorVisible) {
      this.showCursor();
    } else {
      this.hideCursor();
    }

    // Pre-scroll terminal for the initial render size
    const initialLines = component.render();
    const termWidth = process.stdout.columns || 80;
    let visualRows = 0;
    for (const line of initialLines) {
      const visualWidth = getStringWidth(line);
      visualRows += Math.max(1, Math.ceil(visualWidth / termWidth));
    }
    if (visualRows > 1) {
      process.stdout.write('\n'.repeat(visualRows - 1) + `\x1b[${visualRows - 1}A\r`);
    }
    
    this.requestFrame();
  }

  /**
   * Clears the current visual buffer from the screen.
   */
  clear() {
    if (this.previousBuffer.length > 0) {
      const termWidth = process.stdout.columns || 80;
      const getVisualLineCount = (lines) => {
        let count = 0;
        for (const line of lines) {
          const visualWidth = getStringWidth(line);
          count += Math.max(1, Math.ceil(visualWidth / termWidth));
        }
        return count;
      };
      const prevVisualRows = getVisualLineCount(this.previousBuffer);
      if (prevVisualRows > 0) {
        let clearOutput = '\x1b[?2026h';
        const prevCursorVisualRow = this.previousCursor
          ? getVisualRowOfCursor(this.previousBuffer, this.previousCursor.line, this.previousCursor.column, termWidth)
          : (prevVisualRows - 1);
        const upOffset = Math.min(prevCursorVisualRow, process.stdout.rows - 1 || 24);
        if (upOffset > 0) {
          clearOutput += `\x1b[${upOffset}A`;
        }
        clearOutput += '\r\x1b[J\x1b[?2026l';
        process.stdout.write(clearOutput);
      }
      this.previousBuffer = [];
      this.previousCursor = null;
      this.previousCursorLine = undefined;
    }
  }

  /**
   * Unmounts all components and stops loop.
   */
  unmountAll() {
    this.showCursor();
    this.clear();
    this.components = [];
    this.dirty = false;
    this.active = false;
    this.previousCursor = null;
    this.previousCursorLine = undefined;
  }

  /**
   * Request a redraw frame on the next tick.
   */
  requestFrame() {
    if (this.dirty) return;
    this.dirty = true;
    
    // Ticker scheduling to batch updates
    process.nextTick(() => {
      if (this.dirty) {
        this.render();
      }
    });
  }

  /**
   * Performs differential drawing on process.stdout
   */
  render() {
    this.dirty = false;

    // 1. Gather next buffer lines
    const nextBuffer = [];
    let customCursor = null;
    let lineOffsetAccumulator = 0;

    for (const comp of this.components) {
      const compLines = comp.render();
      if (comp.getCursorPosition) {
        const pos = comp.getCursorPosition();
        if (pos) {
          customCursor = {
            line: lineOffsetAccumulator + pos.line,
            column: pos.column
          };
        }
      }
      nextBuffer.push(...compLines);
      lineOffsetAccumulator += compLines.length;
    }

    const termWidth = process.stdout.columns || 80;

    const cursorChanged = (
      (customCursor && (!this.previousCursor || this.previousCursor.line !== customCursor.line || this.previousCursor.column !== customCursor.column)) ||
      (!customCursor && this.previousCursor)
    );

    // Fast-path: if nothing has changed and width hasn't changed, skip drawing
    if (!cursorChanged &&
        termWidth === this.previousWidth &&
        nextBuffer.length === this.previousBuffer.length &&
        nextBuffer.every((line, idx) => line === this.previousBuffer[idx])) {
      return;
    }

    // Helper to calculate wrapping lines accurately
    const getVisualLineCount = (lines) => {
      let count = 0;
      for (const line of lines) {
        const visualWidth = getStringWidth(line);
        count += Math.max(1, Math.ceil(visualWidth / termWidth));
      }
      return count;
    };

    const prevVisualRows = getVisualLineCount(this.previousBuffer);
    const nextVisualRows = getVisualLineCount(nextBuffer);

    // Batch all ANSI movements and clears into a single write buffer string
    // Wrap drawing with \x1b[?2026h (start synchronization) and \x1b[?2026l (end synchronization) to eliminate screen flickers
    let output = '\x1b[?2026h';

    // If height increased, pre-scroll terminal to prevent pushing top of component off-screen
    if (this.previousBuffer.length > 0 && nextVisualRows > prevVisualRows) {
      const heightIncrease = nextVisualRows - prevVisualRows;
      output += '\n'.repeat(heightIncrease) + `\x1b[${heightIncrease}A\r`;
    }

    // 2. Roll cursor back up (harden calculation to prevent scrolling terminal boundary errors)
    const prevCursorVisualRow = this.previousCursor
      ? getVisualRowOfCursor(this.previousBuffer, this.previousCursor.line, this.previousCursor.column, termWidth)
      : (prevVisualRows - 1);

    if (prevVisualRows > 1) {
      const upOffset = Math.min(prevCursorVisualRow, process.stdout.rows - 1 || 24);
      if (upOffset > 0) {
        output += `\x1b[${upOffset}A`; // Move cursor up safely
      }
    }
    output += '\r\x1b[J'; // Clear line and all content below it to eliminate ghost rows

    // 3. Append the new buffer cleanly
    for (let i = 0; i < nextBuffer.length; i++) {
      const line = nextBuffer[i];
      if (i === nextBuffer.length - 1) {
        output += '\r' + line; // Keep cursor at the end of the last line
      } else {
        output += '\r' + line + '\n';
      }
    }

    // 4. Position cursor to custom line/col if needed
    if (customCursor) {
      const customCursorVisualRow = getVisualRowOfCursor(nextBuffer, customCursor.line, customCursor.column, termWidth);
      const linesFromBottom = (nextVisualRows - 1) - customCursorVisualRow;
      if (linesFromBottom > 0) {
        output += `\x1b[${linesFromBottom}A`;
      }
      const targetCol = ((customCursor.column - 1) % termWidth) + 1;
      output += `\r\x1b[${targetCol}G`;
    }

    output += '\x1b[?2026l'; // End synchronized output

    // Write everything to stdout in a single write operation to prevent flicker
    process.stdout.write(output);

    this.previousBuffer = nextBuffer;
    this.previousWidth = termWidth;
    this.previousCursor = customCursor;
    this.previousCursorLine = customCursor ? customCursor.line : (nextBuffer.length - 1);
  }
}
