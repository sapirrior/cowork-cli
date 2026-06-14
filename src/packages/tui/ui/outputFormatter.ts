import { colors } from '../../utils/index.js';

const reset = '\x1b[0m';

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

function visualLength(str: string): number {
  if (!str) return 0;
  const clean = stripAnsi(str);
  let len = 0;
  for (const char of clean) {
    const cp = char.codePointAt(0);
    if (cp === undefined) continue;
    const isWide = (
      (cp >= 0x4e00 && cp <= 0x9fff) ||
      (cp >= 0x3400 && cp <= 0x4dbf) ||
      (cp >= 0x3000 && cp <= 0x30ff) || // Symbols, Hiragana, Katakana
      (cp >= 0xff00 && cp <= 0xffef) || // Fullwidth Forms
      (cp >= 0x1f000 && cp <= 0x1faff) || // Emojis
      (cp >= 0x20000 && cp <= 0x3ffff) // Extensions
    );
    len += isWide ? 2 : 1;
  }
  return len;
}

function applyInlineStyles(str: string): string {
  if (!str) return '';

  // 1. Inline code: `code` -> tool color (amber) + code + reset foreground color
  let res = str.replace(/`([^`]+)`/g, (match, code) => {
    return `${colors.tool}${code}\x1b[39m`;
  });

  // 2. Bold styling: **text** -> bold terminal style + main color (blue) + text + reset
  res = res.replace(/\*\*([^*]+)\*\*/g, (match, boldText) => {
    return `\x1b[1m${colors.main}${boldText}\x1b[22m\x1b[39m`;
  });

  // 3. Italic/dim styling: *text* or _text_ -> dim color (grey) + text + reset foreground color
  res = res.replace(/\*([^*]+)\*/g, (match, italicText) => {
    return `${colors.dim}${italicText}\x1b[39m`;
  });
  res = res.replace(/_([^_]+)_/g, (match, italicText) => {
    return `${colors.dim}${italicText}\x1b[39m`;
  });

  // 4. Link styling: [label](url) -> label (main/blue) + dim url (grey)
  res = res.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
    return `${colors.main}${label}\x1b[39m ${colors.dim}(${url})\x1b[39m`;
  });

  return res;
}

function balanceAnsiStyles(wrappedLines: string[]): string[] {
  let activeColor: string | null = null;

  return wrappedLines.map(line => {
    let prefix = '';
    if (activeColor) prefix += activeColor;

    const ansiRegex = /\x1b\[([0-9;]*)m/g;
    let match: RegExpExecArray | null;
    while ((match = ansiRegex.exec(line)) !== null) {
      const code = match[1];
      const parts = code.split(';');

      if (parts.includes('0') || parts.includes('39')) {
        activeColor = null;
      }

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part === '38') {
          if (parts[i + 1] === '2' || parts[i + 1] === '5') {
            activeColor = match[0];
            break;
          }
        } else if (/^[39][0-9]$/.test(part) && part !== '39') {
          activeColor = match[0];
          break;
        }
      }
    }

    let suffix = '';
    if (activeColor) suffix += '\x1b[39m';

    return prefix + line + suffix;
  });
}

/**
 * Wraps text to the current terminal width without breaking words unless necessary.
 * Dynamically detects terminal width and preserves whitespace/indentation.
 */
export function outputFormatted(text: any, overrideWidth?: number): string {
  if (text === null || text === undefined) return '';
  // Normalize newlines, strip carriage returns, and expand tabs to preserve column alignment
  const strText = String(text).replace(/\r/g, '').replace(/\t/g, '    ');
  
  let rawWidth = overrideWidth || process.stdout.columns || 80;
  if (typeof rawWidth !== 'number' || isNaN(rawWidth) || rawWidth < 10) {
    rawWidth = 80;
  }
  
  // Use full terminal width with a small 2-char right margin to prevent
  // edge-wrapping artifacts on terminals that wrap at the last column.
  const width = Math.max(10, rawWidth - 2);
  const lines = strText.split('\n');
  const wrappedLines: string[] = [];

  let inCodeBlock = false;
  let tableBuffer: string[] = [];   // accumulates raw pipe-delimited rows

  // ---------------------------------------------------------------------------
  // Table renderer — called when a table block is complete
  // ---------------------------------------------------------------------------
  function renderTable(rawRows: string[]) {
    // Parse each row into trimmed cell strings
    const parsed = rawRows.map(row => {
      const cells = row.split('|');
      // strip the leading/trailing empty strings caused by outer pipes
      if (cells[0].trim() === '') cells.shift();
      if (cells[cells.length - 1].trim() === '') cells.pop();
      return cells.map(c => c.trim());
    });

    if (parsed.length === 0) return;

    // Identify the separator row (only dashes/colons/pipes) and extract alignment
    let sepIdx = parsed.findIndex(row =>
      row.every(c => /^:?-+:?$/.test(c))
    );
    if (sepIdx === -1) sepIdx = 1; // assume row 1 is separator if not found

    const alignRow = parsed[sepIdx] || [];
    const aligns = alignRow.map(c => {
      if (/^:-+:$/.test(c)) return 'center';
      if (/^-+:$/.test(c))  return 'right';
      return 'left';
    });

    const headerRows = parsed.slice(0, sepIdx);
    const dataRows   = parsed.slice(sepIdx + 1);
    const allDataRows = [...headerRows, ...dataRows];

    // Determine number of columns
    const numCols = Math.max(...allDataRows.map(r => r.length), aligns.length);

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
    // Total width = borders(numCols+1) + padding(numCols*2) + sum(colWidths)
    const borderOverhead = (numCols + 1) + (numCols * 2);
    const totalNatural   = colWidths.reduce((a, b) => a + b, 0) + borderOverhead;
    if (totalNatural > width) {
      const budget = width - borderOverhead;
      const ratio  = budget / colWidths.reduce((a, b) => a + b, 0);
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
        // Truncate the raw text first, then re-style
        const plain  = stripAnsi(styled);
        const cut    = plain.slice(0, plain.length - overflow - 1) + '…';
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

    // Box-drawing helpers
    const hbar = (w: number) => '─'.repeat(w + 2); // col width + 2 padding

    // ┌─...─┬─...─┐
    const topBorder = D + '┌' + colWidths.map(hbar).join('┬') + '┐' + R;
    // ├─...─┼─...─┤  (after header)
    const midBorder = D + '├' + colWidths.map(hbar).join('┼') + '┤' + R;
    // └─...─┴─...─┘
    const botBorder = D + '└' + colWidths.map(hbar).join('┴') + '┘' + R;

    function buildRow(cells: string[], isHeader: boolean) {
      const parts = colWidths.map((w, i) => {
        const raw     = cells[i] || '';
        const align   = aligns[i] || 'left';
        const fitted  = fitCell(raw, w, align);
        return isHeader
          ? ` \x1b[1m${colors.main}${stripAnsi(fitted)}\x1b[22m${R} `
          : ` ${fitted} `;
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

  // Helper function to wrap a string to a specific width (ANSI and wide-char aware)
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
        // If it's a long word that exceeds the entire width
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
        // If it's whitespace that causes overflow
        else if (/^\s+$/.test(token)) {
          if (currentLine) {
            result.push(currentLine.trimEnd());
            currentLine = '';
          }
        } 
        // Normal word that causes overflow
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

  for (const line of lines) {
    // --- Table row detection (pipe-delimited, outside code blocks) -----------
    const isTableRow = !inCodeBlock && /^\s*\|/.test(line);
    if (isTableRow) {
      tableBuffer.push(line.trim());
      continue;
    }
    // Flush buffered table when a non-table line is encountered
    if (tableBuffer.length > 0) {
      renderTable(tableBuffer);
      tableBuffer = [];
    }

    // Check if the line already contains ANSI escape formatting (e.g., pre-colored command outputs)
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

      // Color hierarchy: H1 = header (purple), H2 = main (blue), H3+ = dim
      const levelColor = level === 1 ? colors.header
                       : level === 2 ? colors.main
                       : colors.dim;

      // Bold for H1 and H2, normal for H3+
      const boldStart = level <= 2 ? '\x1b[1m' : '';
      const boldEnd   = level <= 2 ? '\x1b[22m' : '';

      // Add a blank line before headers for breathing room
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
      // Add spacing before blockquotes for breathing room
      if (wrappedLines.length > 0 && wrappedLines[wrappedLines.length - 1] !== '') {
        wrappedLines.push('');
      }
      const prefix = quoteMatch[0];
      const content = line.substring(prefix.length);
      const wrapWidth = Math.max(10, width - prefix.length);
      const baseColor = colors.dim;
      
      // Prefix quote content with baseColor and restore it after any inline color resets
      const formattedContent = `${baseColor}${applyInlineStyles(content).replace(/\x1b\[39m/g, `\x1b[39m${baseColor}`)}${reset}`;
      const wrappedSegments = wrapString(formattedContent, wrapWidth);

      // Use dim color for the vertical bar to make blockquotes feel integrated and soft
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
  }

  return wrappedLines
    .map(line => line.replace(/[\s\u200B]+(?=(?:\x1b\[[0-9;]*[a-zA-Z]|\s)*$)/g, ''))
    .join('\n');
}
