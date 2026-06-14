import Component from '../Component.js';

interface PromptInputProps {
  question?: string;
  currentVal?: string;
}

interface PromptInputState {
  question: string;
  currentVal: string;
}

export default class PromptInput extends Component<PromptInputProps, PromptInputState> {
  constructor(props: PromptInputProps = {}) {
    super(props);
    this.state = {
      question: props.question || '',
      currentVal: props.currentVal || ''
    };
  }

  override render(): string[] {
    const { question, currentVal } = this.state;

    const blue = (str: string) => `\x1b[38;2;123;165;218m${str}\x1b[0m`;
    const amber = (str: string) => `\x1b[38;2;242;207;110m${str}\x1b[0m`;

    return [
      `${blue('◇')} ${amber('Ask')}`,
      amber(question),
      `\x1b[1m>\x1b[0m ${currentVal}`
    ];
  }
}
