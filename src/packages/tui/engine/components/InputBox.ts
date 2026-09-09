import Component from '../Component.js';
import stringWidth from 'string-width';
import { THEME } from '../../theme.js';
import { wrapByVisualWidth } from '../cell-layout.js';

export { wrapByVisualWidth };

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
  private _cachedWrappedContent: string[] = [];

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
   * Cursor position in physical rows relative to this component.
   * Line 0 = label row, line 1 = top border, line 2+ = content lines.
   * Column offset is 2 (for the "  " prefix) + visual column within the wrapped row.
   */
  override getCursorPosition(): { line: number; column: number } {
    const width = process.stdout.columns || 80;
    const INDENT = 2;
    const maxWidth = Math.max(10, width - 1 - INDENT);
    const { cursorIndex, currentVal, masked } = this.state;

    const sub = currentVal.substring(0, cursorIndex);
    const displaySub = masked ? '•'.repeat(sub.length) : sub;

    // Use wrapByVisualWidth to determine exact row and remainder within the current line
    const subWrapped = wrapByVisualWidth(displaySub, maxWidth);
    const cursorLineOffset = Math.max(0, subWrapped.length - 1);
    const lastSeg = subWrapped[subWrapped.length - 1] || '';
    const cursorColOffset = stringWidth(lastSeg);

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
    this._cachedWrappedContent = wrapByVisualWidth(displayVal, maxWidth);
    for (const wrappedLine of this._cachedWrappedContent) {
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
