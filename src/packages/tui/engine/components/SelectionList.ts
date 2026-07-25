import Component from '../Component.js';
import { THEME } from '../../theme.js';

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

    const lines: string[] = [];
    if (question) {
      lines.push(`${THEME.formatMain('◇')} ${THEME.formatTool('Ask Confirm')}`);
      lines.push(THEME.formatTool(question));
    }

    const itemsLines = items.map((item, idx) => {
      const isSelected = idx === selectedIdx;
      const prefix = isSelected ? THEME.formatMain('➔ ') : '  ';
      const text = isSelected ? THEME.formatMain(`[ ${item} ]`) : THEME.formatDim(`  ${item}  `);
      return `${prefix}${text}`;
    });

    lines.push(...itemsLines);
    return lines;
  }
}
