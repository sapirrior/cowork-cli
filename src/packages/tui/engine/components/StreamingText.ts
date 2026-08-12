import Component from '../Component.js';
import { extractThinking, formatThinkingOnly, outputFormatted } from '../../ui/outputFormatter.js';

export interface StreamingTextProps {
  rawText?: string;
}

export interface StreamingTextState {
  rawText: string;
}

export default class StreamingText extends Component<StreamingTextProps, StreamingTextState> {
  constructor(props: StreamingTextProps = {}) {
    super(props);
    this.state = {
      rawText: props.rawText || '',
    };
  }

  setRawText(rawText: string): void {
    this.setState({ rawText });
  }

  override render(): string[] {
    const { rawText } = this.state;
    if (!rawText) return [];

    const { thinking, response } = extractThinking(rawText);
    const lines: string[] = [];

    if (thinking) {
      const formattedThinking = formatThinkingOnly(thinking);
      if (formattedThinking) {
        lines.push(...formattedThinking.split('\n'));
      }
    }

    if (response) {
      if (thinking) {
        lines.push('');
      }
      const formattedResponse = outputFormatted(response);
      if (formattedResponse) {
        lines.push(...formattedResponse.split('\n'));
      }
    }

    return lines;
  }
}
