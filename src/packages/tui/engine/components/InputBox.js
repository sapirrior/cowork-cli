import Component from '../Component.js';

export default class InputBox extends Component {
  constructor(props = {}) {
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
  getCursorPosition() {
    const width = process.stdout.columns || 80;
    const maxWidth = Math.max(10, width - 2);
    const { cursorIndex } = this.state;
    
    const cursorLineOffset = Math.floor(cursorIndex / maxWidth);
    const cursorColOffset = cursorIndex % maxWidth;

    return {
      line: 2 + cursorLineOffset,
      column: 3 + cursorColOffset
    };
  }

  render() {
    const { label, hint, currentVal, masked, error } = this.state;

    const blue = (str) => `\x1b[38;2;123;165;218m${str}\x1b[0m`;
    const red = (str) => `\x1b[38;2;224;112;112m${str}\x1b[0m`;
    const dim = (str) => `\x1b[2m${str}\x1b[0m`;
    const bold = (str) => `\x1b[1m${str}\x1b[0m`;

    const borderCol = error ? red : dim;
    const width = process.stdout.columns || 80;
    
    // Draw horizontal borders slightly shorter than width to prevent terminal auto-wrap
    const horizontalLine = borderCol('─'.repeat(width - 1));

    const lines = [];

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
    const symbol = error ? red('◈') : blue('◈');
    const hintPart = displayHint ? ` ${dim(displayHint)}` : '';
    lines.push(`${symbol} ${bold(displayLabel)}${hintPart}`);

    // Line 2: Top border
    lines.push(horizontalLine);

    // Lines 3+: Wrapped input value lines
    const displayVal = masked ? '•'.repeat(currentVal.length) : currentVal;
    const maxWidth = Math.max(10, width - 2);
    
    const wrapped = [];
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
      lines.push(`  ${red('✖')} ${red(displayError)}`);
    }

    return lines;
  }
}
