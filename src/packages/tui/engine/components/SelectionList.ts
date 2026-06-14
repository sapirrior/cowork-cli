import Component from '../Component.js';

interface SelectionListProps {
  question?: string;
  items?: string[];
  selectedIdx?: number;
}

interface SelectionListState {
  question: string;
  items: string[];
  selectedIdx: number;
}

export default class SelectionList extends Component<SelectionListProps, SelectionListState> {
  constructor(props: SelectionListProps = {}) {
    super(props);
    this.state = {
      question: props.question || '',
      items: props.items || [],
      selectedIdx: props.selectedIdx || 0
    };
  }

  override render(): string[] {
    const { question, items, selectedIdx } = this.state;

    const blue = (str: string) => `\x1b[38;2;123;165;218m${str}\x1b[0m`;
    const yellow = (str: string) => `\x1b[38;2;242;207;110m${str}\x1b[0m`;
    const dim = (str: string) => `\x1b[2m${str}\x1b[0m`;

    const lines: string[] = [];
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
