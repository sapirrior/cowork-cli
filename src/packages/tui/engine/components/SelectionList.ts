import Component from '../Component.js';
import { rgb, bold, dim } from '../../ui/format.js';

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

const purpleColor: [number, number, number] = [163, 122, 204];
const amberColor:  [number, number, number] = [242, 207, 110];
const blueColor:   [number, number, number] = [123, 165, 218];
const silverColor: [number, number, number] = [194, 198, 197];
const greenColor:  [number, number, number] = [122, 195, 145];

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
      const bullet = rgb(purpleColor, '●');
      const labelStr = bold(rgb(amberColor, 'ask confirm'));
      const dataStr = ` ${rgb(blueColor, '(')}${rgb(silverColor, question)}${rgb(blueColor, ')')}`;
      lines.push(`  ${bullet} ${labelStr}${dataStr}`);
    }

    const itemsLines = items.map((item, idx) => {
      const isSelected = idx === selectedIdx;
      return isSelected
        ? bold(rgb(greenColor, `    [ ${item} ]`))
        : dim(`      ${item}`);
    });

    lines.push(...itemsLines);
    return lines;
  }
}
