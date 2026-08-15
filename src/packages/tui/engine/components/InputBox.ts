import Component from '../Component.js';
import stringWidth from 'string-width';
import { THEME } from '../../theme.js';

/**
 * Wraps `text` into lines that do not exceed `maxCols` **display columns**.
 * Unlike a naive `.slice(i, i+n)`, this respects wide Unicode characters
 * (CJK, emoji) so no character is ever split mid-glyph.
 */
export function wrapByVisualWidth(text: string, maxCols: number): string[] {
  if (text.length === 0) return [''];
  if (maxCols <= 0) return [text];

  const lines: string[] = [];
  let currentLine = '';
  let currentWidth = 0;

  // Iterate over Unicode codepoints (handles surrogate pairs / emoji)
  for (const char of text) {
    const cw = stringWidth(char);
    if (currentWidth + cw > maxCols && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = char;
      currentWidth = cw;
    } else {
      currentLine += char;
      currentWidth += cw;
    }
  }
  if (currentLine.length > 0 || lines.length === 0) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Returns the display-column offset of the cursor within `text` up to
 * `charIndex` (a codepoint/character index, not a byte index).
 */
export function visualCursorOffset(text: string, charIndex: number): number {
  let col = 0;
  let i = 0;
  for (const char of text) {
    if (i >= charIndex) break;
    col += stringWidth(char);
    i++;
  }
  return col;
}

interface InputBoxProps {
  label?: string;
  hint?: string;
  currentVal?: string;
  masked?: boolean;
  error?: string | null;
}

interface InputBoxState {
  label: string;
  hint: string;
  currentVal: string;
  cursorIndex: number;
  masked: boolean;
  error: string | null;
}

export default class InputBox extends Component<InputBoxProps, InputBoxState> {
  constructor(props: InputBoxProps = {}) {
    super(props);
    this.state = {
      label: props.label || '',
      hint: props.hint || '',
      currentVal: props.currentVal || '',
      cursorIndex: (props.currentVal || '').length,
      masked: props.masked || false,
      error: props.error || null
    };
  }

  /**
   * Cursor position in the DocumentTree grid.
   * Line 0 = label row, line 1 = top border, line 2+ = content lines.
   * Column offset is 2 (for the "  " prefix) + visual column within the line.
   */
  override getCursorPosition(): { line: number; column: number } {
    const width = process.stdout.columns || 80;
    // 2 chars prefix indent inside the box
    const INDENT = 2;
    const maxWidth = Math.max(10, width - 1 - INDENT);
    const { cursorIndex, currentVal, masked } = this.state;

    const sub = currentVal.substring(0, cursorIndex);
    const displaySub = masked ? '•'.repeat(sub.length) : sub;
    const totalVisualOffset = stringWidth(displaySub);

    const cursorLineOffset = Math.floor(totalVisualOffset / maxWidth);
    const cursorColOffset  = totalVisualOffset % maxWidth;

    // +2 for label row and top-border row above the content area
    return {
      line: 2 + cursorLineOffset,
      column: INDENT + 1 + cursorColOffset   // 1-indexed column
    };
  }

  override render(): string[] {
    const { label, hint, currentVal, masked, error } = this.state;

    const borderCol = error ? THEME.formatError : THEME.formatDim;
    const width = process.stdout.columns || 80;
    const horizontalLine = borderCol('─'.repeat(width - 1));

    const lines: string[] = [];

    // Line 1: label + hint
    const maxLabelWidth = width - 4;
    let displayLabel = label;
    let displayHint = hint ? ` [${hint}]` : '';
    if (displayLabel.length + displayHint.length > maxLabelWidth) {
      if (displayLabel.length < maxLabelWidth - 10) {
        displayHint = displayHint.slice(0, maxLabelWidth - displayLabel.length - 3) + '...]';
      } else {
        displayHint = '';
        displayLabel = displayLabel.slice(0, maxLabelWidth - 3) + '...';
      }
    }
    const symbol   = error ? THEME.formatError('◈') : THEME.formatMain('◈');
    const hintPart = displayHint ? ` ${THEME.formatDim(displayHint)}` : '';
    lines.push(`${symbol} ${THEME.bold(displayLabel)}${hintPart}`);

    // Line 2: top border
    lines.push(horizontalLine);

    // Lines 3+: wrapped content (Unicode-safe)
    const displayVal = masked ? '•'.repeat(currentVal.length) : currentVal;
    const INDENT = 2;
    const maxWidth = Math.max(10, width - 1 - INDENT);
    const wrapped = wrapByVisualWidth(displayVal, maxWidth);
    for (const wrappedLine of wrapped) {
      lines.push('  ' + wrappedLine);
    }

    // Bottom border
    lines.push(horizontalLine);

    // Error line
    if (error) {
      let displayError = error;
      if (displayError.length > width - 6) {
        displayError = displayError.slice(0, width - 9) + '...';
      }
      lines.push(`  ${THEME.formatError('✖')} ${THEME.formatError(displayError)}`);
    }

    return lines;
  }
}
