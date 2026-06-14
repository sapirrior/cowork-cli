import stringWidth from 'string-width';
import Component from './Component.js';

/**
 * Helper to calculate visible width of a string containing ANSI escape codes, CJK, or Emojis.
 */
function getStringWidth(str: string): number {
  return stringWidth(str);
}

/**
 * Calculates the exact 0-indexed visual row where the cursor resides in the wrapping layout.
 */
function getVisualRowOfCursor(buffer: string[], cursorLine: number, cursorColumn: number, termWidth: number): number {
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
  components: Component[];
  previousBuffer: string[];
  previousWidth: number;
  previousHeight: number;
  dirty: boolean;
  active: boolean;
  cursorHidden: boolean;
  previousCursor: { line: number; column: number } | null;
  previousCursorLine: number | undefined;
  private resizeHandler: () => void;

  constructor() {
    this.components = [];
    this.previousBuffer = [];
    this.previousWidth = process.stdout.columns || 80;
    this.previousHeight = process.stdout.rows || 24;
    this.dirty = false;
    this.active = false;
    this.cursorHidden = false;
    this.previousCursor = null;
    this.previousCursorLine = undefined;

    this.resizeHandler = () => {
      const w = process.stdout.columns || 80;
      const h = process.stdout.rows || 24;
      for (const comp of this.components) {
        if (typeof comp.onResize === 'function') {
          comp.onResize(w, h);
        }
      }
      this.requestFrame();
    };

    // Restore terminal cursor visibility on exit
    process.on('exit', () => {
      this.showCursor();
    });
  }

  /**
   * Hide cursor safely.
   */
  hideCursor(): void {
    if (!this.cursorHidden) {
      process.stdout.write('\x1b[?25l');
      this.cursorHidden = true;
    }
  }

  /**
   * Show cursor safely.
   */
  showCursor(): void {
    if (this.cursorHidden) {
      process.stdout.write('\x1b[?25h');
      this.cursorHidden = false;
    }
  }

  /**
   * Mounts a component to the engine layout.
   */
  mount(component: Component, options: { keepCursorVisible?: boolean } = {}): void {
    if (this.components.length === 0) {
      process.stdout.on('resize', this.resizeHandler);
    }
    component.engine = this;
    this.components.push(component);
    
    if (options.keepCursorVisible) {
      this.showCursor();
    } else {
      this.hideCursor();
    }

    if (typeof component.onMount === 'function') {
      component.onMount();
    }

    // Pre-scroll terminal for the initial render size
    const initialLines = component._getLines(true);
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
  clear(): void {
    if (this.previousBuffer.length > 0) {
      const drawWidth = this.previousWidth || process.stdout.columns || 80;
      const curWidth  = process.stdout.columns || 80;
      const getVisualLineCountAt = (lines: string[], w: number): number => {
        let count = 0;
        for (const line of lines) {
          count += Math.max(1, Math.ceil(getStringWidth(line) / w));
        }
        return count;
      };
      // Take the MAX across old-width and current-width so that if the terminal
      // reflowed content into more rows we still erase all of them.
      const prevVisualRows = Math.max(
        getVisualLineCountAt(this.previousBuffer, drawWidth),
        getVisualLineCountAt(this.previousBuffer, curWidth)
      );
      if (prevVisualRows > 0) {
        let clearOutput = '\x1b[?2026h';
        // On clear we always treat cursor as being at bottom of the frame.
        const upOffset = Math.min(prevVisualRows - 1, (process.stdout.rows || 24) - 1);
        if (upOffset > 0) clearOutput += `\x1b[${upOffset}A`;
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
  unmountAll(): void {
    this.showCursor();
    for (const comp of this.components) {
      if (typeof comp.onUnmount === 'function') {
        comp.onUnmount();
      }
    }
    this.clear();
    this.components = [];
    this.dirty = false;
    this.active = false;
    this.previousCursor = null;
    this.previousCursorLine = undefined;
    process.stdout.off('resize', this.resizeHandler);
  }

  /**
   * Request a redraw frame on the next tick.
   */
  requestFrame(): void {
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
  render(forceAll: boolean = false): void {
    this.dirty = false;

    // 1. Gather next buffer lines
    const nextBuffer: string[] = [];
    let customCursor: { line: number; column: number } | null = null;
    let lineOffsetAccumulator = 0;

    const termWidth = process.stdout.columns || 80;
    const termHeight = process.stdout.rows || 24;
    const sizeChanged = termWidth !== this.previousWidth || termHeight !== this.previousHeight;

    for (const comp of this.components) {
      const compLines = comp._getLines(forceAll || sizeChanged);
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

    const cursorChanged = (
      (customCursor && (!this.previousCursor || this.previousCursor.line !== customCursor.line || this.previousCursor.column !== customCursor.column)) ||
      (!customCursor && this.previousCursor)
    );

    // Fast-path: if nothing has changed and size hasn't changed, skip drawing
    if (!forceAll &&
        !sizeChanged &&
        !cursorChanged &&
        nextBuffer.length === this.previousBuffer.length &&
        nextBuffer.every((line, idx) => line === this.previousBuffer[idx])) {
      return;
    }

    // Helper to calculate wrapping rows — parameterised by width so we can
    // measure the OLD buffer at OLD width and the NEW buffer at NEW width.
    const getVisualLineCountAt = (lines: string[], w: number): number => {
      let count = 0;
      for (const line of lines) {
        const visualWidth = getStringWidth(line);
        count += Math.max(1, Math.ceil(visualWidth / w));
      }
      return count;
    };

    const drawWidth = this.previousWidth || termWidth;

    // On resize the terminal emulator may have *reflowed* the previously drawn
    // content so that it occupies a different number of physical rows than what
    // we measured at the old width.  To guarantee we erase ALL of those rows
    // (whether the terminal narrowed and content expanded, or widened and it
    // contracted) we take the MAX of the row count at both widths.
    // This is the only correct fix — there is no way to query the terminal for
    // the actual row count after a reflow.
    const prevVisualRowsAtOldWidth = getVisualLineCountAt(this.previousBuffer, drawWidth);
    const prevVisualRowsAtNewWidth = getVisualLineCountAt(this.previousBuffer, termWidth);
    const prevVisualRows = sizeChanged
      ? Math.max(prevVisualRowsAtOldWidth, prevVisualRowsAtNewWidth)
      : prevVisualRowsAtOldWidth;

    const nextVisualRows = getVisualLineCountAt(nextBuffer, termWidth);

    // Batch all ANSI movements and clears into a single write buffer string.
    // \x1b[?2026h / \x1b[?2026l = synchronized output — terminal paints atomically.
    let output = '\x1b[?2026h';

    // If the new frame needs more physical rows, pre-scroll to reserve space.
    if (this.previousBuffer.length > 0 && nextVisualRows > prevVisualRows) {
      const heightIncrease = nextVisualRows - prevVisualRows;
      output += '\n'.repeat(heightIncrease) + `\x1b[${heightIncrease}A\r`;
    }

    // Roll cursor back up to the TOP of the previously rendered frame.
    // On resize: always treat cursor as at the very bottom of prevVisualRows
    // because the stored previousCursor position is stale after a reflow.
    // On normal render: use the actual stored cursor row.
    const prevCursorVisualRow = (sizeChanged || !this.previousCursor)
      ? (prevVisualRows - 1)
      : getVisualRowOfCursor(this.previousBuffer, this.previousCursor.line, this.previousCursor.column, drawWidth);

    if (prevVisualRows > 1) {
      const upOffset = Math.min(prevCursorVisualRow, termHeight - 1);
      if (upOffset > 0) output += `\x1b[${upOffset}A`;
    }
    output += '\r\x1b[J'; // Erase from top of our frame downward — never touches output above

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
    this.previousHeight = termHeight;
    this.previousCursor = customCursor;
    this.previousCursorLine = customCursor ? customCursor.line : (nextBuffer.length - 1);
  }
}
