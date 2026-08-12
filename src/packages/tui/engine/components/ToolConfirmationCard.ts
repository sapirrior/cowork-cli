import Component from '../Component.js';
import { rgb, bold, dim } from '../../ui/format.js';
import { detectLanguage, highlightLine } from '../../ui/highlighter.js';

export interface ToolConfirmationProps {
  toolName?: string;
  action?: string;
  target?: string;
  details?: string[];
  selectedIdx?: number;
  expanded?: boolean;
}

export interface ToolConfirmationState {
  toolName: string;
  action: string;
  target: string;
  details: string[];
  selectedIdx: number;
  expanded: boolean;
}

const purpleColor: [number, number, number] = [163, 122, 204];
const amberColor:  [number, number, number] = [242, 207, 110];
const blueColor:   [number, number, number] = [123, 165, 218];
const silverColor: [number, number, number] = [194, 198, 197];
const greenColor:  [number, number, number] = [122, 195, 145];
const redColor:    [number, number, number] = [224, 112, 112];
const dimColor:    [number, number, number] = [160, 165, 175];

/**
 * Preview line formatter:
 * - Additions (+): Green marker + syntax highlighted code
 * - Deletions / Minus lines (-): Red marker + syntax highlighted code
 * - Shell commands ($): Bold Gold $ + bash highlighted command
 * - Base Code: Syntax highlighted based on file language
 */
function formatPreviewLine(line: string, language: string): string {
  if (!line) return '';

  const trimmed = line.trim();

  // 1. Edit diff additions (+ ...) -> Green marker + highlighted code
  if (line.startsWith('+')) {
    const spaceCode = line.slice(1);
    const spaceMatch = spaceCode.match(/^(\s*)(.*)$/);
    const space = spaceMatch ? spaceMatch[1] : '';
    const code = spaceMatch ? spaceMatch[2] : '';
    return rgb(greenColor, '+') + space + highlightLine(code, language);
  }

  // 2. Edit diff deletions / minus lines (- ...) -> Red marker + highlighted code
  if (line.startsWith('-')) {
    const spaceCode = line.slice(1);
    const spaceMatch = spaceCode.match(/^(\s*)(.*)$/);
    const space = spaceMatch ? spaceMatch[1] : '';
    const code = spaceMatch ? spaceMatch[2] : '';
    return rgb(redColor, '-') + space + highlightLine(code, language);
  }

  // 3. Shell commands ($ ...) -> Gold $ + bash highlighted code
  if (trimmed.startsWith('$')) {
    const code = trimmed.slice(1).trim();
    return bold(rgb(amberColor, '$ ')) + highlightLine(code, 'bash');
  }

  // Base code lines: syntax highlighted with the detected language
  return highlightLine(line, language);
}

/**
 * Standard tool label resolver matching Sonnet tool conventions.
 */
function getToolLabel(toolName: string, action?: string): string {
  const clean = toolName.toLowerCase();
  if (clean.includes('write'))   return 'writing file';
  if (clean.includes('edit'))    return 'editing file';
  if (clean.includes('delete'))  return 'deleting file';
  if (clean.includes('command') || clean.includes('exec')) return 'running command';
  return action || toolName;
}

export default class ToolConfirmationCard extends Component<ToolConfirmationProps, ToolConfirmationState> {
  constructor(props: ToolConfirmationProps = {}) {
    super(props);
    this.state = {
      toolName: props.toolName || 'tool',
      action: props.action || '',
      target: props.target || '',
      details: props.details || [],
      selectedIdx: props.selectedIdx || 0,
      expanded: props.expanded !== undefined ? props.expanded : false, // Default preview off
    };
  }

  override render(): string[] {
    const { toolName, action, target, details, selectedIdx, expanded } = this.state;
    const lines: string[] = [];

    // Header line: ● bullet symbol next to bold title + Silver target path in Blue parentheses
    const bullet = rgb(purpleColor, '●');
    const labelStr = bold(rgb(amberColor, getToolLabel(toolName, action)));
    const targetText = target || action;
    const targetStr = targetText ? `  ${rgb(blueColor, '(')}${rgb(silverColor, targetText)}${rgb(blueColor, ')')}` : '';

    lines.push(`  ${bullet} ${labelStr}${targetStr}`);

    // Content preview section framed by a bright Yellow vertical left border (│) with clean white content
    const yellowBar = rgb(amberColor, '│');
    const isCommand = toolName.toLowerCase().includes('command') || toolName.toLowerCase().includes('exec');
    const language = isCommand ? 'bash' : detectLanguage(target, details);

    if (details && details.length > 0) {
      if (expanded) {
        const previewLimit = 8;
        const visibleDetails = details.slice(0, previewLimit);
        for (const line of visibleDetails) {
          lines.push(`  ${yellowBar} ${formatPreviewLine(line, language)}`);
        }
        if (details.length > previewLimit) {
          lines.push(`  ${yellowBar} ${rgb(silverColor, `... (${details.length - previewLimit} more lines)`)}`);
        }
      } else {
        lines.push(`  ${yellowBar} ${dim(`(preview hidden · Tab or e to expand ${details.length} lines)`)}`);
      }
    }

    // Inline action options (no arrow symbols)
    const isAllowSelected = selectedIdx === 0;
    const isDenySelected  = selectedIdx === 1;

    const allowBtn = isAllowSelected
      ? bold(rgb(greenColor, '  Allow [y]'))
      : dim('  Allow [y]');

    const denyBtn = isDenySelected
      ? bold(rgb(redColor, '  Deny [n]'))
      : dim('  Deny [n]');

    lines.push(`${allowBtn}   ${denyBtn}`);

    // Properly colored instruction keybindings footer line
    const instY   = rgb(greenColor, 'y/Enter');
    const instAllow = rgb(dimColor, ' Allow');
    const dot1    = rgb(dimColor, ' · ');
    const instN   = rgb(redColor, 'n/Esc');
    const instDeny = rgb(dimColor, ' Deny');
    const dot2    = rgb(dimColor, ' · ');
    const instTab = rgb(amberColor, 'Tab');
    const instPrev = rgb(dimColor, ' Toggle Preview');

    lines.push(`  ${rgb(dimColor, '(')}${instY}${instAllow}${dot1}${instN}${instDeny}${dot2}${instTab}${instPrev}${rgb(dimColor, ')')}`);

    return lines;
  }
}
