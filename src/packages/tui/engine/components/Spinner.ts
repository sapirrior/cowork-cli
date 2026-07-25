import Component from '../Component.js';
import { THEME } from '../../theme.js';

const THOUGHTS = [
  'Thinking...', 'Brewing...', 'Grooming...', 'Analyzing...',
  'Investigating...', 'Processing...', 'Synthesizing...', 'Exploring...',
  'Mapping...', 'Reasoning...', 'Meditating...', 'Computing...',
  'Crawling...', 'Scanning...'
];

const SPINNER_FRAMES = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];

interface SpinnerProps {
  label?: string;
  data?: string;
  rotating?: boolean;
}

interface SpinnerState {
  frameIdx: number;
  thoughtIdx: number;
  label: string;
  data: string;
  rotating: boolean;
}

export default class Spinner extends Component<SpinnerProps, SpinnerState> {
  timer: NodeJS.Timeout | null;

  constructor(props: SpinnerProps = {}) {
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

  override componentDidMount(): void {
    this.timer = setInterval(() => {
      const nextFrame = (this.state.frameIdx + 1) % SPINNER_FRAMES.length;
      const nextState: Partial<SpinnerState> = { frameIdx: nextFrame };

      if (this.state.rotating && nextFrame === 0) {
        const nextThoughtIdx = (this.state.thoughtIdx + 1) % THOUGHTS.length;
        nextState.thoughtIdx = nextThoughtIdx;
        nextState.label = THOUGHTS[nextThoughtIdx];
      }

      this.setState(nextState);
    }, 100);
  }

  override componentWillUnmount(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  override render(): string[] {
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
        const file = parts.pop() || '';
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

    const dataStr = truncatedData ? ` ${THEME.formatMain('(')}${THEME.formatNormal(truncatedData)}${THEME.formatMain(')')}` : '';
    return [`${THEME.formatMain(frame)} ${THEME.formatTool(label)}${dataStr}`];
  }
}
