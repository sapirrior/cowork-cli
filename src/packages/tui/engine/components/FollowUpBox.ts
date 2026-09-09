import Component from '../Component.js';
import stringWidth from 'string-width';
import { THEME } from '../../theme.js';
import { wrapByVisualWidth } from '../cell-layout.js';

interface FollowUpBoxProps {
  currentVal?: string;
}

interface FollowUpBoxState {
  currentVal: string;
  cursorIndex: number;
}

// Prefix: "> " at column 0, no indent
const PREFIX      = '> ';
const PREFIX_COLS = 2;
const PLACEHOLDER = 'Type your follow-up…';

// Thin grey border — one shade darker than THEME.formatDim to stay subtle
function greyBorder(width: number): string {
  // Use explicit grey RGB so it renders identically regardless of terminal theme
  return `\x1b[38;2;75;75;75m${'─'.repeat(Math.max(1, width - 1))}\x1b[0m`;
}

export default class FollowUpBox extends Component<FollowUpBoxProps, FollowUpBoxState> {
  private _cachedWrappedContent: string[] = [];

  constructor(props: FollowUpBoxProps = {}) {
    super(props);
    this.state = {
      currentVal: props.currentVal || '',
      cursorIndex: (props.currentVal || '').length,
    };
  }

  /**
   * Cursor sits on line 1 (the input line; line 0 = top border).
   * Column = PREFIX_COLS + visual offset within the current wrapped line + 1 (1-indexed).
   * No indent — > is at column 0.
   */
  override getCursorPosition(): { line: number; column: number } {
    const width = process.stdout.columns || 80;
    const maxContentCols = Math.max(10, width - 1 - PREFIX_COLS);

    const { currentVal, cursorIndex } = this.state;
    const sub = currentVal.substring(0, cursorIndex);
    const subWrapped = wrapByVisualWidth(sub, maxContentCols);
    const cursorLineOffset = Math.max(0, subWrapped.length - 1);
    const lastSeg = subWrapped[subWrapped.length - 1] || '';
    const cursorColOffset = stringWidth(lastSeg);

    return {
      line:   1 + cursorLineOffset,      // line 0 = top border, line 1 = first content line
      column: PREFIX_COLS + 1 + cursorColOffset, // 1-indexed, no indent
    };
  }

  override render(): string[] {
    const { currentVal } = this.state;
    const width = process.stdout.columns || 80;
    const border = greyBorder(width);
    // Content columns: full width minus "> " prefix, no indent
    const maxContentCols = Math.max(10, width - 1 - PREFIX_COLS);

    const lines: string[] = [];

    // ── Top border ────────────────────────────────────────────────────
    lines.push(border);

    // ── Input line(s) ─────────────────────────────────────────────────
    const prefixStyled = THEME.formatMain('> ');

    if (currentVal.length === 0) {
      lines.push(`${prefixStyled}${THEME.formatDim(PLACEHOLDER)}`);
    } else {
      this._cachedWrappedContent = wrapByVisualWidth(currentVal, maxContentCols);
      lines.push(`${prefixStyled}${this._cachedWrappedContent[0]}`);
      for (let i = 1; i < this._cachedWrappedContent.length; i++) {
        // Continuation lines: align text under first line (PREFIX_COLS spaces)
        lines.push(`${' '.repeat(PREFIX_COLS)}${this._cachedWrappedContent[i]}`);
      }
    }

    // ── Bottom border ─────────────────────────────────────────────────
    lines.push(border);

    // ── Footer hint line ──────────────────────────────────────────────
    const leftRaw   = 'ctrl+c to cancel';
    const rightRaw  = 'Enter to send ↵';
    const leftHint  = THEME.formatDim(leftRaw);
    const rightHint = THEME.formatDim(rightRaw);
    const gap = Math.max(1, (width - 1) - leftRaw.length - rightRaw.length);
    lines.push(`${leftHint}${' '.repeat(gap)}${rightHint}`);

    return lines;
  }
}
