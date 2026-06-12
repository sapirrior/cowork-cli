import Component from '../Component.js';

export default class PromptInput extends Component {
  constructor(props = {}) {
    super(props);
    this.state = {
      question: props.question || '',
      currentVal: props.currentVal || ''
    };
  }

  render() {
    const { question, currentVal } = this.state;

    const blue = (str) => `\x1b[38;2;123;165;218m${str}\x1b[0m`;
    const amber = (str) => `\x1b[38;2;242;207;110m${str}\x1b[0m`;

    return [
      `${blue('◇')} ${amber('Ask')}`,
      amber(question),
      `\x1b[1m>\x1b[0m ${currentVal}`
    ];
  }
}
