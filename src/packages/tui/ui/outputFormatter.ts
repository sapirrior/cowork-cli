import { logger, colors } from '../../utils/index.js';
import stringWidth from 'string-width';

const reset = '\x1b[0m';

/**
 * Visual character width calculator aware of Unicode wide characters and ANSI escape sequences.
 */
function visualLength(text: string): number {
  if (!text) return 0;
  return stringWidth(text);
}

/**
 * Strips ANSI escape sequences from text.
 */
function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * Applies inline markdown formatting (bold, italic, inline code, links).
 */
function applyInlineStyles(text: string): string {
  if (!text) return '';
  let res = text;

  // Inline code: `code`
  res = res.replace(/`([^`]+)`/g, (_, code) => `${colors.tool}${code}${reset}`);
  // Bold: **text** or __text__
  res = res.replace(/(\*\*|__)(.*?)\1/g, (_, __, content) => `\x1b[1m${content}\x1b[22m`);
  // Italic: *text* or _text_
  res = res.replace(/(\*|_)(.*?)\1/g, (_, __, content) => `\x1b[3m${content}\x1b[23m`);
  // Links: [label](url)
  res = res.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => `${colors.main}${label}${colors.dim} (${url})${reset}`);

  return res;
}

/**
 * Balances ANSI style codes across wrapped line boundaries.
 */
function balanceAnsiStyles(lines: string[]): string[] {
  let activeStyles: string[] = [];

  return lines.map(line => {
    const prefix = activeStyles.join('');
    const matches = line.match(/\x1b\[[0-9;]*[a-zA-Z]/g) || [];

    for (const match of matches) {
      if (match === '\x1b[0m' || match === '\x1b[39m') {
        activeStyles = [];
      } else {
        activeStyles.push(match);
      }
    }

    const suffix = activeStyles.length > 0 ? reset : '';
    return prefix + line + suffix;
  });
}

/**
 * Main Markdown output formatter for TUI.
 * Converts markdown text into ANSI-formatted, word-wrapped lines.
 */
export function formatOutput(markdownText: string, overrideWidth?: number): string {
  if (!markdownText) return '';

  let rawWidth = overrideWidth || process.stdout.columns || 80;
  if (typeof rawWidth !== 'number' || isNaN(rawWidth) || rawWidth < 10) {
    rawWidth = 80;
  }
  const width = Math.max(10, rawWidth - 2);

  const lines = markdownText.split('\n');
  const wrappedLines: string[] = [];
  let inCodeBlock = false;
  let tableBuffer: string[] = [];

  // Table renderer — called when a table block is complete
  function renderTable(rawRows: string[]) {
    // Parse each row into trimmed cell strings without empty outer pipe padding
    const parsed = rawRows.map(row => {
      let trimmed = row.trim();
      if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
      if (trimmed.endsWith('|'))   trimmed = trimmed.slice(0, -1);
      return trimmed.split('|').map(c => c.trim());
    });

    if (parsed.length === 0) return;

    // Identify the separator row (dashes/colons/pipes)
    let sepIdx = parsed.findIndex(row =>
      row.length > 0 && row.every(c => /^:?-+:?$/.test(c))
    );

    // Fallback: If no valid separator row exists, render as normal text lines (not a table)
    if (sepIdx === -1) {
      for (const rawLine of rawRows) {
        const formatted = applyInlineStyles(rawLine);
        const wrappedSegments = wrapString(formatted, width);
        const balancedSegments = balanceAnsiStyles(wrappedSegments);
        for (const segment of balancedSegments) {
          wrappedLines.push(segment);
        }
      }
      return;
    }

    const headerRows = parsed.slice(0, sepIdx);
    const dataRows   = parsed.slice(sepIdx + 1);

    const alignRow = parsed[sepIdx] || [];
    const aligns = alignRow.map(c => {
      if (/^:-+:$/.test(c)) return 'center';
      if (/^-+:$/.test(c))  return 'right';
      return 'left';
    });

    const allDataRows = [...headerRows, ...dataRows];
    if (allDataRows.length === 0) return;

    // Determine number of columns strictly from content rows
    const numCols = Math.max(1, ...allDataRows.map(r => r.length));

    // Compute natural column widths (visual length of cell content)
    const colWidths = Array(numCols).fill(0);
    for (const row of allDataRows) {
      for (let i = 0; i < numCols; i++) {
        const cell = row[i] || '';
        const cellLen = visualLength(stripAnsi(applyInlineStyles(cell)));
        if (cellLen > colWidths[i]) colWidths[i] = cellLen;
      }
    }

    // Cap table to available width: shrink columns proportionally if needed
    const borderOverhead = (numCols + 1) + (numCols * 2);
    const totalNatural   = colWidths.reduce((a, b) => a + b, 0) + borderOverhead;
    if (totalNatural > width) {
      const budget = width - borderOverhead;
      const totalColSum = Math.max(1, colWidths.reduce((a, b) => a + b, 0));
      const ratio  = budget / totalColSum;
      for (let i = 0; i < numCols; i++) {
        colWidths[i] = Math.max(1, Math.floor(colWidths[i] * ratio));
      }
    }

    // Helper: pad/truncate a cell to the target visual width
    function fitCell(rawText: string, colW: number, align: string) {
      const styled    = applyInlineStyles(rawText || '');
      const visLen    = visualLength(stripAnsi(styled));
      const overflow  = visLen - colW;
      let content     = styled;
      if (overflow > 0) {
        const plain  = stripAnsi(styled);
        const cut    = plain.slice(0, Math.max(1, plain.length - overflow - 1)) + '…';
        content      = applyInlineStyles(rawText.slice(0, cut.length));
      }
      const padTotal = colW - Math.min(visLen, colW);
      if (align === 'right') {
        return ' '.repeat(padTotal) + content;
      } else if (align === 'center') {
        const left  = Math.floor(padTotal / 2);
        const right = padTotal - left;
        return ' '.repeat(left) + content + ' '.repeat(right);
      } else {
        return content + ' '.repeat(padTotal);
      }
    }

    const D  = colors.dim;
    const R  = reset;

    const hbar = (w: number) => '─'.repeat(w + 2);

    const topBorder = D + '┌' + colWidths.map(hbar).join('┬') + '┐' + R;
    const midBorder = D + '├' + colWidths.map(hbar).join('┼') + '┤' + R;
    const botBorder = D + '└' + colWidths.map(hbar).join('┴') + '┘' + R;

    function buildRow(cells: string[], isHeader: boolean) {
      const parts = colWidths.map((w, i) => {
        const raw     = cells[i] || '';
        const align   = aligns[i] || 'left';
        const fitted  = fitCell(raw, w, align);
        return isHeader
          ? ` \x1b[1m${colors.main}${fitted}\x1b[22m${R} `
          : ` ${colors.data}${fitted}${R} `;
      });
      return D + '│' + R + parts.join(D + '│' + R) + D + '│' + R;
    }

    // Add blank line before table if previous line is not blank
    if (wrappedLines.length > 0 && wrappedLines[wrappedLines.length - 1] !== '') {
      wrappedLines.push('');
    }

    wrappedLines.push(topBorder);
    for (const hrow of headerRows) {
      wrappedLines.push(buildRow(hrow, true));
    }
    if (dataRows.length > 0) {
      wrappedLines.push(midBorder);
      for (const drow of dataRows) {
        wrappedLines.push(buildRow(drow, false));
      }
    }
    wrappedLines.push(botBorder);
    wrappedLines.push('');
  }

  // Helper function to wrap a string to a specific width
  function wrapString(content: string, wrapWidth: number): string[] {
    const safeWidth = Math.max(5, wrapWidth);
    if (visualLength(content) <= safeWidth) return [content];
    
    const tokens = content.split(/(\s+)/);
    const result: string[] = [];
    let currentLine = '';

    for (const token of tokens) {
      if (!token) continue;

      const tokenLen = visualLength(token);
      const currentLineLen = visualLength(currentLine);

      if (currentLineLen + tokenLen > safeWidth) {
        if (tokenLen > safeWidth && !/^\s+$/.test(token)) {
          if (currentLine) {
            result.push(currentLine.trimEnd());
            currentLine = '';
          }
          
          let remainingWord = token;
          while (visualLength(remainingWord) > safeWidth) {
            let visibleChars = 0;
            let splitIdx = 0;
            while (visibleChars < safeWidth && splitIdx < remainingWord.length) {
              if (remainingWord.startsWith('\x1b[', splitIdx)) {
                const endEsc = remainingWord.indexOf('m', splitIdx);
                if (endEsc !== -1) {
                  splitIdx = endEsc + 1;
                  continue;
                }
              }
              const code = remainingWord.charCodeAt(splitIdx);
              const isWide = (code >= 0x3000 && code <= 0x9FFF) || (code >= 0xFF00 && code <= 0xFFEF);
              if (visibleChars + (isWide ? 2 : 1) > safeWidth) {
                break;
              }
              visibleChars += isWide ? 2 : 1;
              splitIdx++;
            }
            result.push(remainingWord.substring(0, splitIdx));
            remainingWord = remainingWord.substring(splitIdx);
          }
          currentLine = remainingWord;
        } 
        else if (/^\s+$/.test(token)) {
          if (currentLine) {
            result.push(currentLine.trimEnd());
            currentLine = '';
          }
        } 
        else {
          if (currentLine) {
            result.push(currentLine.trimEnd());
          }
          currentLine = token;
        }
      } else {
        currentLine += token;
      }
    }
    
    if (currentLine) result.push(currentLine.trimEnd());
    return result.length > 0 ? result : [''];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // --- Table row detection (pipe-delimited, outside code blocks) -----------
    const isNextSeparator = i + 1 < lines.length &&
      /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(lines[i + 1]);

    const isTableRow = !inCodeBlock && line.includes('|') && (
      tableBuffer.length > 0 ||
      /^\s*\|/.test(line) ||
      /\|\s*$/.test(line) ||
      isNextSeparator
    );

    if (isTableRow) {
      tableBuffer.push(line.trim());
      continue;
    }
    // Flush buffered table when a non-table line is encountered
    if (tableBuffer.length > 0) {
      renderTable(tableBuffer);
      tableBuffer = [];
    }

    // Check if the line already contains ANSI escape formatting
    const hasAnsi = /\x1b\[[0-9;]*[a-zA-Z]/.test(line);
    if (hasAnsi) {
      const wrappedSegments = wrapString(line, width);
      const balancedSegments = balanceAnsiStyles(wrappedSegments);
      for (const segment of balancedSegments) {
        wrappedLines.push(segment);
      }
      continue;
    }

    // 1. Detect Horizontal Rules (e.g., ---, ***, ___ )
    if (line.match(/^(\s*)([-*_])\2\2+(\s*)$/)) {
      wrappedLines.push(`${colors.dim}${'─'.repeat(width)}${reset}`);
      continue;
    }

    // 2. Detect code block boundaries
    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        const lang = line.trim().substring(3).trim();
        if (lang) {
          wrappedLines.push(`${colors.dim}  ${lang}${reset}`);
        }
      } else {
        inCodeBlock = false;
      }
      continue;
    }

    // 3. If in code block, preserve line with vertical boundary
    if (inCodeBlock) {
      wrappedLines.push(`${colors.dim}│ ${reset}${line}`);
      continue;
    }

    // 4. Check for Markdown Headers: # Header
    const headerMatch = line.match(/^(#+)\s*(.*)/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const title = headerMatch[2];

      const levelColor = level === 1 ? colors.header
                       : level === 2 ? colors.main
                       : colors.dim;

      const boldStart = level <= 2 ? '\x1b[1m' : '';
      const boldEnd   = level <= 2 ? '\x1b[22m' : '';

      if (wrappedLines.length > 0 && wrappedLines[wrappedLines.length - 1] !== '') {
        wrappedLines.push('');
      }

      const wrapWidth = Math.max(10, width);
      const wrappedTitle = wrapString(title, wrapWidth);

      for (const segment of wrappedTitle) {
        const formatted = applyInlineStyles(segment)
                            .replace(/\x1b\[39m/g, `\x1b[39m${levelColor}`);
        wrappedLines.push(`${boldStart}${levelColor}${formatted}${boldEnd}${reset}`);
      }
      continue;
    }

    // 5. Check for List Item structure: bullets (- * +) or numbering (e.g., 1. or 1.1.)
    const listMatch = line.match(/^(\s*)([-*+]\s|\d+(\.\d+)*\.\s)/);
    if (listMatch) {
      const prefix = listMatch[0];
      const content = line.substring(prefix.length);
      const wrapWidth = Math.max(10, width - prefix.length);
      const formattedContent = applyInlineStyles(content);
      const wrappedSegments = wrapString(formattedContent, wrapWidth);

      let formattedPrefix = prefix;
      const bulletMatch = prefix.match(/^(\s*)([-*+])(\s)/);
      if (bulletMatch) {
        formattedPrefix = `${bulletMatch[1]}${colors.main}•${reset}${bulletMatch[3]}`;
      } else {
        const numberMatch = prefix.match(/^(\s*)(\d+(\.\d+)*\.)(\s)/);
        if (numberMatch) {
          formattedPrefix = `${numberMatch[1]}${colors.main}${numberMatch[2]}${reset}${numberMatch[4]}`;
        }
      }

      const balancedSegments = balanceAnsiStyles(wrappedSegments);
      wrappedLines.push(formattedPrefix + balancedSegments[0]);
      const hangingIndent = ' '.repeat(prefix.length);
      for (let i = 1; i < balancedSegments.length; i++) {
        wrappedLines.push(hangingIndent + balancedSegments[i]);
      }
      continue;
    }

    // 6. Check for Blockquote structure
    const quoteMatch = line.match(/^(\s*)(>\s?)/);
    if (quoteMatch) {
      if (wrappedLines.length > 0 && wrappedLines[wrappedLines.length - 1] !== '') {
        wrappedLines.push('');
      }
      const prefix = quoteMatch[0];
      const content = line.substring(prefix.length);
      const wrapWidth = Math.max(10, width - prefix.length);
      const baseColor = colors.dim;
      
      const formattedContent = `${baseColor}${applyInlineStyles(content).replace(/\x1b\[39m/g, `\x1b[39m${baseColor}`)}${reset}`;
      const wrappedSegments = wrapString(formattedContent, wrapWidth);

      const formattedPrefix = prefix.replace(/>\s?/, `${colors.dim}│ ${reset}`);
      const balancedSegments = balanceAnsiStyles(wrappedSegments);

      for (const segment of balancedSegments) {
        wrappedLines.push(formattedPrefix + segment);
      }
      continue;
    }

    // 7. Check for Indented paragraph structure
    const indentMatch = line.match(/^(\s+)/);
    if (indentMatch) {
      const prefix = indentMatch[0];
      const content = line.substring(prefix.length);
      const wrapWidth = Math.max(10, width - prefix.length);
      const formattedContent = applyInlineStyles(content);
      const wrappedSegments = wrapString(formattedContent, wrapWidth);
      const balancedSegments = balanceAnsiStyles(wrappedSegments);

      for (const segment of balancedSegments) {
        wrappedLines.push(prefix + segment);
      }
      continue;
    }

    // 8. Fallback: plain text paragraph
    const formatted = applyInlineStyles(line);
    const wrappedSegments = wrapString(formatted, width);
    const balancedSegments = balanceAnsiStyles(wrappedSegments);
    for (const segment of balancedSegments) {
      wrappedLines.push(segment);
    }
  }

  // Flush any table that ends at end-of-input
  if (tableBuffer.length > 0) {
    renderTable(tableBuffer);
    tableBuffer = [];
  }

  return wrappedLines
    .map(line => line.replace(/[\s\u200B]+(?=(?:\x1b\[[0-9;]*[a-zA-Z]|\s)*$)/g, ''))
    .join('\n');
}

/**
 * Formats a user prompt query for display in the TUI alternate screen.
 */
export function formatPromptQuery(query: string, overrideWidth?: number): string {
  if (!query) return '';

  let rawWidth = overrideWidth || process.stdout.columns || 80;
  if (typeof rawWidth !== 'number' || isNaN(rawWidth) || rawWidth < 10) {
    rawWidth = 80;
  }

  const termWidth = Math.max(10, rawWidth - 2);
  const promptSymbol = `${colors.main}❯${reset}`;
  const symbolLen = 2;
  const wrapWidth = Math.max(10, termWidth - symbolLen);

  const lines = query.split('\n');
  const formattedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
      formattedLines.push('');
      continue;
    }

    const tokens = line.split(/(\s+)/);
    let currentLine = '';
    const lineSegments: string[] = [];

    for (const token of tokens) {
      if (!token) continue;
      const tokenLen = visualLength(token);
      const currentLen = visualLength(currentLine);

      if (currentLen + tokenLen > wrapWidth) {
        if (tokenLen > wrapWidth && !/^\s+$/.test(token)) {
          if (currentLine) {
            lineSegments.push(currentLine.trimEnd());
            currentLine = '';
          }
          let remaining = token;
          while (visualLength(remaining) > wrapWidth) {
            let splitIdx = 0;
            let vis = 0;
            while (vis < wrapWidth && splitIdx < remaining.length) {
              const code = remaining.charCodeAt(splitIdx);
              const isWide = (code >= 0x3000 && code <= 0x9FFF) || (code >= 0xFF00 && code <= 0xFFEF);
              if (vis + (isWide ? 2 : 1) > wrapWidth) break;
              vis += isWide ? 2 : 1;
              splitIdx++;
            }
            lineSegments.push(remaining.substring(0, splitIdx));
            remaining = remaining.substring(splitIdx);
          }
          currentLine = remaining;
        } else if (/^\s+$/.test(token)) {
          if (currentLine) {
            lineSegments.push(currentLine.trimEnd());
            currentLine = '';
          }
        } else {
          if (currentLine) {
            lineSegments.push(currentLine.trimEnd());
          }
          currentLine = token;
        }
      } else {
        currentLine += token;
      }
    }
    if (currentLine) lineSegments.push(currentLine.trimEnd());
    if (lineSegments.length === 0) lineSegments.push('');

    for (let s = 0; s < lineSegments.length; s++) {
      if (i === 0 && s === 0) {
        formattedLines.push(`${promptSymbol} ${lineSegments[s]}`);
      } else {
        formattedLines.push(`  ${lineSegments[s]}`);
      }
    }
  }

  return formattedLines.join('\n');
}

export const outputFormatted = formatOutput;
