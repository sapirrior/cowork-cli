import Component from '../Component.js';

export default class ProviderSelector extends Component {
  constructor(props = {}) {
    super(props);
    this.state = {
      title: props.title || 'Choose your AI provider',
      items: props.items || [], // [{ label: string, configured: boolean, active: boolean }]
      selectedIdx: props.selectedIdx || 0
    };
  }

  render() {
    const { title, items, selectedIdx } = this.state;

    const blue = (str) => `\x1b[38;2;123;165;218m${str}\x1b[0m`;
    const yellow = (str) => `\x1b[38;2;242;207;110m${str}\x1b[0m`;
    const dim = (str) => `\x1b[2m${str}\x1b[0m`;
    const bold = (str) => `\x1b[1m${str}\x1b[0m`;

    const width = process.stdout.columns || 80;

    // Truncate title if it exceeds terminal width
    const maxTitleLen = width - 4;
    const displayTitle = title.length > maxTitleLen
      ? title.slice(0, maxTitleLen - 3) + '...'
      : title;

    const lines = [];
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
