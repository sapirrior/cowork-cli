import Component from '../Component.js';

export default class SelectionList extends Component {
  constructor(props = {}) {
    super(props);
    this.state = {
      question: props.question || '',
      items: props.items || [],
      selectedIdx: props.selectedIdx || 0
    };
  }

  render() {
    const { question, items, selectedIdx } = this.state;

    const blue = (str) => `\x1b[38;2;123;165;218m${str}\x1b[0m`;
    const yellow = (str) => `\x1b[38;2;242;207;110m${str}\x1b[0m`;
    const dim = (str) => `\x1b[2m${str}\x1b[0m`;

    const lines = [];
    if (question) {
      lines.push(`${blue('◇')} ${yellow('Ask Confirm')}`);
      lines.push(yellow(question));
    }

    const itemsLines = items.map((item, idx) => {
      const isSelected = idx === selectedIdx;
      const prefix = isSelected ? blue('➔ ') : '  ';
      const text = isSelected ? blue(`[ ${item} ]`) : dim(`  ${item}  `);
      return `${prefix}${text}`;
    });

    lines.push(...itemsLines);
    return lines;
  }
}
