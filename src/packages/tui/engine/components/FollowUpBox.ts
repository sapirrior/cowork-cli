import Component from '../Component.js';
import stringWidth from 'string-width';
import { THEME } from '../../theme.js';
import { wrapByVisualWidth, visualCursorOffset } from './InputBox.js';

interface FollowUpBoxProps {
  currentVal?: string;
}

interface FollowUpBoxState {
  currentVal: string;
  cursorIndex: number;
}

// The visible prefix rendered inside the box: "❯ " (2 display columns)
const PREFIX     = '❯ ';
const PREFIX_COLS = 2;
const INDENT      = 2;   // "  " before the ❯
const PLACEHOLDER = 'Type your follow-up…';

export default class FollowUpBox extends Component<FollowUpBoxProps, FollowUpBoxState> {
  constructor(props: FollowUpBoxProps = {}) {
    super(props);
    this.state = {
      currentVal: props.currentVal || '',
      cursorIndex: (props.currentVal || '').length,
    };
  }

  /**
   * Cursor sits on line 1 (the input line; line 0 = top border).
   * Column = INDENT + PREFIX_COLS + visual offset within current line + 1 (1-indexed).
   */
  override getCursorPosition(): { line: number; column: number } {
    const width = process.stdout.columns || 80;
    const maxContentCols = Math.max(10, width - 1 - INDENT - PREFIX_COLS);

    const { currentVal, cursorIndex } = this.state;
    // Visual offset of the cursor within the raw text
    const totalOffset = visualCursorOffset(currentVal, cursorIndex);

    const cursorLineOffset = Math.floor(totalOffset / maxContentCols);
    const cursorColOffset  = totalOffset % maxContentCols;

    return {
      line:   1 + cursorLineOffset,           // 1 = first content line (after top border)
      column: INDENT + PREFIX_COLS + cursorColOffset + 1, // 1-indexed
    };
  }

  override render(): string[] {
    const { currentVal } = this.state;
    const width = process.stdout.columns || 80;
    const borderLine = THEME.formatDim('─'.repeat(width - 1));
    const maxContentCols = Math.max(10, width - 1 - INDENT - PREFIX_COLS);

    const lines: string[] = [];

    // ── Top border ──────────────────────────────────────────────────
    lines.push(borderLine);

    // ── Input line(s) ───────────────────────────────────────────────
    const indent = '  '; // INDENT spaces
    const prefixStyled = `${THEME.formatMain(PREFIX)}`;

    if (currentVal.length === 0) {
      // Show dim placeholder when empty
      lines.push(`${indent}${prefixStyled}${THEME.formatDim(PLACEHOLDER)}`);
    } else {
      // Unicode-safe line wrapping on the raw text (no ANSI inside slice)
      const contentLines = wrapByVisualWidth(currentVal, maxContentCols);
      lines.push(`${indent}${prefixStyled}${contentLines[0]}`);
      for (let i = 1; i < contentLines.length; i++) {
        // Continuation lines: indent + prefix-width spaces to align text
        lines.push(`${indent}${' '.repeat(PREFIX_COLS)}${contentLines[i]}`);
      }
    }

    // ── Bottom border ────────────────────────────────────────────────
    lines.push(borderLine);

    // ── Footer hint line ─────────────────────────────────────────────
    const leftHint  = THEME.formatDim('ctrl+c to cancel');
    const rightHint = THEME.formatDim('Enter to send ↵');
    // Use raw lengths for spacing math (dim wrapping is ANSI, not visual chars)
    const leftRaw   = 'ctrl+c to cancel';
    const rightRaw  = 'Enter to send ↵';
    const gap = Math.max(1, (width - 1) - leftRaw.length - rightRaw.length);
    lines.push(`${leftHint}${' '.repeat(gap)}${rightHint}`);

    return lines;
  }
}
