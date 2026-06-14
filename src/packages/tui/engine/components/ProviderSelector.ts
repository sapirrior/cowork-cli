import Component from '../Component.js';

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

    const blue = (str: string) => `\x1b[38;2;123;165;218m${str}\x1b[0m`;
    const yellow = (str: string) => `\x1b[38;2;242;207;110m${str}\x1b[0m`;
    const dim = (str: string) => `\x1b[2m${str}\x1b[0m`;
    const bold = (str: string) => `\x1b[1m${str}\x1b[0m`;

    const width = process.stdout.columns || 80;

    // Truncate title if it exceeds terminal width
    const maxTitleLen = width - 4;
    const displayTitle = title.length > maxTitleLen
      ? title.slice(0, maxTitleLen - 3) + '...'
      : title;

    const lines: string[] = [];
    lines.push(`${blue('◇')} ${yellow(bold(displayTitle))}`);
    lines.push('');

    const itemsLines = items.map((item, idx) => {
      const isSelected = idx === selectedIdx;
      const tick = item.configured ? '✓' : ' ';
      const activeSufx = item.active ? ' (active)' : '';
      let fullLabel = `${tick} ${item.label}${activeSufx}`;

      // Truncate item label if it exceeds terminal width
      const maxLabelLen = width - 8;
      if (fullLabel.length > maxLabelLen) {
        fullLabel = fullLabel.slice(0, maxLabelLen - 3) + '...';
      }

      if (isSelected) {
        return `${blue('➔ ')}${blue(`[ ${fullLabel} ]`)}`;
      } else if (item.configured) {
        return `    ${fullLabel}`;
      } else {
        return dim(`    ${fullLabel}`);
      }
    });

    lines.push(...itemsLines);
    return lines;
  }
}
