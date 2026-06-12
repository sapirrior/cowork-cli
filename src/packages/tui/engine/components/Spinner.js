import Component from '../Component.js';

const THOUGHTS = [
  'Thinking...', 'Brewing...', 'Grooming...', 'Analyzing...',
  'Investigating...', 'Processing...', 'Synthesizing...', 'Exploring...',
  'Mapping...', 'Reasoning...', 'Meditating...', 'Computing...',
  'Crawling...', 'Scanning...'
];

const SPINNER_FRAMES = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];

export default class Spinner extends Component {
  constructor(props = {}) {
    super(props);
    this.state = {
      frameIdx: 0,
      thoughtIdx: 0,
      label: props.label || 'Thinking...',
      data: props.data || '',
      rotating: props.rotating || false
    };
    this.timer = null;
  }

  componentDidMount() {
    this.timer = setInterval(() => {
      let nextFrame = (this.state.frameIdx + 1) % SPINNER_FRAMES.length;
      let nextState = { frameIdx: nextFrame };

      if (this.state.rotating && nextFrame === 0) {
        nextState.thoughtIdx = (this.state.thoughtIdx + 1) % THOUGHTS.length;
        nextState.label = THOUGHTS[nextState.thoughtIdx];
      }

      this.setState(nextState);
    }, 100);
  }

  componentWillUnmount() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  render() {
    const frame = SPINNER_FRAMES[this.state.frameIdx];
    const label = this.state.label;
    const data = this.state.data;

    // Get current terminal width
    const termWidth = process.stdout.columns || 80;
    
    // Calculate space left for the path/data metadata inside the parenthesis
    // Structure: "● spinner" (1) + " " (1) + "label" (L) + " (" (2) + ")" (1) = L + 5 columns
    const maxDataWidth = Math.max(0, termWidth - label.length - 6);

    // Apply smart file path truncation
    let truncatedData = data;
    if (data && data.length > maxDataWidth) {
      if (maxDataWidth <= 3) {
        truncatedData = '…';
      } else if (data.includes('/')) {
        const parts = data.split('/');
        const file = parts.pop();
        const parent = parts.pop() || '';
        
        const pathOption1 = `…/${parent}/${file}`;
        const pathOption2 = `…/${file}`;
        
        if (pathOption1.length <= maxDataWidth) {
          truncatedData = pathOption1;
        } else if (pathOption2.length <= maxDataWidth) {
          truncatedData = pathOption2;
        } else {
          truncatedData = `…${file.slice(-(maxDataWidth - 1))}`;
        }
      } else {
        truncatedData = data.slice(0, maxDataWidth - 1) + '…';
      }
    }

    const blue = (str) => `\x1b[38;2;123;165;218m${str}\x1b[0m`;
    const amber = (str) => `\x1b[38;2;242;207;110m${str}\x1b[0m`;
    const silver = (str) => `\x1b[38;2;194;198;197m${str}\x1b[0m`;

    const dataStr = truncatedData ? ` ${blue('(')}${silver(truncatedData)}${blue(')')}` : '';
    return [`${blue(frame)} ${amber(label)}${dataStr}`];
  }
}
