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
 * Preview line formatter and wrapper:
 * - Slices code lines by available TUI width (maxWidth).
 * - Prepend standard vertical bar border '  │ ' to every wrapped chunk.
 * - Slices raw content *before* highlighting to prevent slicing ANSI sequences.
 */
function renderPreviewLine(
  line: string,
  language: string,
  maxWidth: number,
  yellowBar: string
): string[] {
  if (!line) {
    return [`  ${yellowBar} `];
  }

  const resultLines: string[] = [];
  const trimmed = line.trim();

  // 1. Edit diff additions (+ ...) -> Green marker + highlighted code
  if (line.startsWith('+')) {
    const rawCode = line.slice(1);
    const spaceMatch = rawCode.match(/^(\s*)(.*)$/);
    const firstSpace = spaceMatch ? spaceMatch[1] : '';
    const codeContent = spaceMatch ? spaceMatch[2] : '';
    
    // Code available width is maxWidth - 2 (since '+ ' takes 2 characters)
    const codeLimit = Math.max(5, maxWidth - 2);
    const chunks: string[] = [];
    if (codeContent.length === 0) {
      chunks.push('');
    } else {
      for (let i = 0; i < codeContent.length; i += codeLimit) {
        chunks.push(codeContent.slice(i, i + codeLimit));
      }
    }

    for (let idx = 0; idx < chunks.length; idx++) {
      if (idx === 0) {
        const formatted = rgb(greenColor, '+') + firstSpace + highlightLine(chunks[idx], language);
        resultLines.push(`  ${yellowBar} ${formatted}`);
      } else {
        const formatted = '  ' + highlightLine(chunks[idx], language);
        resultLines.push(`  ${yellowBar} ${formatted}`);
      }
    }
    return resultLines;
  }

  // 2. Edit diff deletions / minus lines (- ...) -> Red marker + highlighted code
  if (line.startsWith('-')) {
    const rawCode = line.slice(1);
    const spaceMatch = rawCode.match(/^(\s*)(.*)$/);
    const firstSpace = spaceMatch ? spaceMatch[1] : '';
    const codeContent = spaceMatch ? spaceMatch[2] : '';
    
    const codeLimit = Math.max(5, maxWidth - 2);
    const chunks: string[] = [];
    if (codeContent.length === 0) {
      chunks.push('');
    } else {
      for (let i = 0; i < codeContent.length; i += codeLimit) {
        chunks.push(codeContent.slice(i, i + codeLimit));
      }
    }

    for (let idx = 0; idx < chunks.length; idx++) {
      if (idx === 0) {
        const formatted = rgb(redColor, '-') + firstSpace + highlightLine(chunks[idx], language);
        resultLines.push(`  ${yellowBar} ${formatted}`);
      } else {
        const formatted = '  ' + highlightLine(chunks[idx], language);
        resultLines.push(`  ${yellowBar} ${formatted}`);
      }
    }
    return resultLines;
  }

  // 3. Shell commands ($ ...) -> Gold $ + bash highlighted code
  if (trimmed.startsWith('$')) {
    const codeContent = trimmed.slice(1).trim();
    const codeLimit = Math.max(5, maxWidth - 2);
    const chunks: string[] = [];
    if (codeContent.length === 0) {
      chunks.push('');
    } else {
      for (let i = 0; i < codeContent.length; i += codeLimit) {
        chunks.push(codeContent.slice(i, i + codeLimit));
      }
    }

    for (let idx = 0; idx < chunks.length; idx++) {
      if (idx === 0) {
        const formatted = bold(rgb(amberColor, '$ ')) + highlightLine(chunks[idx], 'bash');
        resultLines.push(`  ${yellowBar} ${formatted}`);
      } else {
        const formatted = '  ' + highlightLine(chunks[idx], 'bash');
        resultLines.push(`  ${yellowBar} ${formatted}`);
      }
    }
    return resultLines;
  }

  // Base code lines: syntax highlighted with the detected language
  const chunks: string[] = [];
  if (line.length === 0) {
    chunks.push('');
  } else {
    for (let i = 0; i < line.length; i += maxWidth) {
      chunks.push(line.slice(i, i + maxWidth));
    }
  }

  for (const chunk of chunks) {
    resultLines.push(`  ${yellowBar} ${highlightLine(chunk, language)}`);
  }

  return resultLines;
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
    const width = process.stdout.columns || 80;
    const maxWidth = Math.max(10, width - 6);

    if (details && details.length > 0) {
      if (expanded) {
        for (const line of details) {
          const renderedChunks = renderPreviewLine(line, language, maxWidth, yellowBar);
          for (const renderedChunk of renderedChunks) {
            lines.push(renderedChunk);
          }
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
