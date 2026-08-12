import Component from '../Component.js';
import { rgb, bold, dim } from '../../ui/format.js';

interface SelectorItem {
  label: string;
  configured: boolean;
  active: boolean;
}

interface ProviderSelectorProps {
  title?: string;
  items?: SelectorItem[];
  selectedIdx?: number;
}

interface ProviderSelectorState {
  title: string;
  items: SelectorItem[];
  selectedIdx: number;
}

const purpleColor: [number, number, number] = [163, 122, 204];
const amberColor:  [number, number, number] = [242, 207, 110];
const blueColor:   [number, number, number] = [123, 165, 218];
const silverColor: [number, number, number] = [194, 198, 197];
const greenColor:  [number, number, number] = [122, 195, 145];

export default class ProviderSelector extends Component<ProviderSelectorProps, ProviderSelectorState> {
  constructor(props: ProviderSelectorProps = {}) {
    super(props);
    this.state = {
      title: props.title || 'Choose your AI provider',
      items: props.items || [],
      selectedIdx: props.selectedIdx || 0
    };
  }

  override render(): string[] {
    const { title, items, selectedIdx } = this.state;
    const lines: string[] = [];

    const bullet = rgb(purpleColor, '●');
    const labelStr = bold(rgb(amberColor, 'select provider'));
    const dataStr = ` ${rgb(blueColor, '(')}${rgb(silverColor, title)}${rgb(blueColor, ')')}`;
    lines.push(`  ${bullet} ${labelStr}${dataStr}`);

    const itemsLines = items.map((item, idx) => {
      const isSelected = idx === selectedIdx;
      const tick = item.configured ? '✓' : ' ';
      const activeSufx = item.active ? ' (active)' : '';
      const fullLabel = `${tick} ${item.label}${activeSufx}`;

      return isSelected
        ? bold(rgb(greenColor, `    [ ${fullLabel} ]`))
        : dim(`      ${fullLabel}`);
    });

    lines.push(...itemsLines);
    return lines;
  }
}
