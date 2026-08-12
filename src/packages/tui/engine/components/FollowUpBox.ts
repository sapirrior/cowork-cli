import Component from '../Component.js';
import stringWidth from 'string-width';
import { THEME } from '../../theme.js';

interface FollowUpBoxProps {
  currentVal?: string;
}

interface FollowUpBoxState {
  currentVal: string;
  cursorIndex: number;
}

export default class FollowUpBox extends Component<FollowUpBoxProps, FollowUpBoxState> {
  constructor(props: FollowUpBoxProps = {}) {
    super(props);
    this.state = {
      currentVal: props.currentVal || '',
      cursorIndex: (props.currentVal || '').length
    };
  }

  override getCursorPosition(): { line: number; column: number } {
    const width = process.stdout.columns || 80;
    const maxWidth = Math.max(10, width - 2);
    const { cursorIndex, currentVal } = this.state;
    
    // Prefix '❯ ' is 2 characters wide
    const visualWidth = 2 + stringWidth(currentVal.substring(0, cursorIndex));
    
    const cursorLineOffset = Math.floor(visualWidth / maxWidth);
    const cursorColOffset = visualWidth % maxWidth;

    return {
      line: cursorLineOffset,
      column: 1 + cursorColOffset
    };
  }

  override render(): string[] {
    const { currentVal } = this.state;
    const width = process.stdout.columns || 80;
    const maxWidth = Math.max(10, width - 2);
    
    const prefix = `${THEME.formatMain('❯')} `;
    const fullText = prefix + currentVal;
    
    const lines: string[] = [];
    for (let i = 0; i < fullText.length; i += maxWidth) {
      lines.push(fullText.slice(i, i + maxWidth));
    }
    
    return lines.length > 0 ? lines : [''];
  }
}
