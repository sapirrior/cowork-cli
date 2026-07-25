import Component from '../Component.js';
import stringWidth from 'string-width';
import { THEME } from '../../theme.js';

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
   * Tells the engine where the cursor should reside.
   * Tracks the line and column in the wrapped text grid.
   */
  override getCursorPosition(): { line: number; column: number } {
    const width = process.stdout.columns || 80;
    const maxWidth = Math.max(10, width - 2);
    const { cursorIndex, currentVal, masked } = this.state;
    
    const sub = currentVal.substring(0, cursorIndex);
    const displaySub = masked ? '•'.repeat(sub.length) : sub;
    const visualWidth = stringWidth(displaySub);
    
    const cursorLineOffset = Math.floor(visualWidth / maxWidth);
    const cursorColOffset = visualWidth % maxWidth;

    return {
      line: 2 + cursorLineOffset,
      column: 3 + cursorColOffset
    };
  }

  override render(): string[] {
    const { label, hint, currentVal, masked, error } = this.state;

    const borderCol = error ? THEME.formatError : THEME.formatDim;
    const width = process.stdout.columns || 80;
    
    // Draw horizontal borders slightly shorter than width to prevent terminal auto-wrap
    const horizontalLine = borderCol('─'.repeat(width - 1));

    const lines: string[] = [];

    // Line 1: ◈ Label [hint] (with truncation to prevent wrapping)
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
    const symbol = error ? THEME.formatError('◈') : THEME.formatMain('◈');
    const hintPart = displayHint ? ` ${THEME.formatDim(displayHint)}` : '';
    lines.push(`${symbol} ${THEME.bold(displayLabel)}${hintPart}`);

    // Line 2: Top border
    lines.push(horizontalLine);

    // Lines 3+: Wrapped input value lines
    const displayVal = masked ? '•'.repeat(currentVal.length) : currentVal;
    const maxWidth = Math.max(10, width - 2);
    
    const wrapped: string[] = [];
    if (displayVal.length === 0) {
      wrapped.push('');
    } else {
      for (let i = 0; i < displayVal.length; i += maxWidth) {
        wrapped.push(displayVal.slice(i, i + maxWidth));
      }
    }

    for (const wrappedLine of wrapped) {
      lines.push(`  ${wrappedLine}`);
    }

    // Next Line: Bottom border
    lines.push(horizontalLine);

    // Next Line: ✖ error (truncated to prevent wrapping)
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
