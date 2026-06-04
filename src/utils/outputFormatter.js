import { colors } from './logger.js';

const reset = '\x1b[0m';

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

function visualLength(str) {
  if (!str) return 0;
  const clean = stripAnsi(str);
  let len = 0;
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    if ((code >= 0x3000 && code <= 0x9FFF) || (code >= 0xFF00 && code <= 0xFFEF)) {
      len += 2;
    } else {
      len += 1;
    }
  }
  return len;
}

function applyInlineStyles(str) {
  if (!str) return '';

  // 1. Inline code: `code` -> tool color (amber) + code + reset foreground color
  str = str.replace(/`([^`]+)`/g, (match, code) => {
    return `${colors.tool}${code}\x1b[39m`;
  });

  // 2. Bold styling: **text** -> bold terminal style + main color (blue) + text + reset
  str = str.replace(/\*\*([^*]+)\*\*/g, (match, boldText) => {
    return `\x1b[1m${colors.main}${boldText}\x1b[22m\x1b[39m`;
  });

  // 3. Italic/dim styling: *text* or _text_ -> dim color (grey) + text + reset foreground color
  str = str.replace(/\*([^*]+)\*/g, (match, italicText) => {
    return `${colors.dim}${italicText}\x1b[39m`;
  });
  str = str.replace(/_([^_]+)_/g, (match, italicText) => {
    return `${colors.dim}${italicText}\x1b[39m`;
  });

  // 4. Link styling: [label](url) -> label (main/blue) + dim url (grey)
  str = str.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
    return `${colors.main}${label}\x1b[39m ${colors.dim}(${url})\x1b[39m`;
  });

  return str;
}

function balanceAnsiStyles(wrappedLines) {
  let activeColor = null;

  return wrappedLines.map(line => {
    let prefix = '';
    if (activeColor) prefix += activeColor;

    const ansiRegex = /\x1b\[([0-9;]*)m/g;
    let match;
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
 * @param {string} text The text to format.
 * @param {number} [overrideWidth] Optional manual width override.
 * @returns {string} The formatted text.
 */
export function outputFormatted(text, overrideWidth) {
  if (text === null || text === undefined) return '';
  // Normalize newlines, strip carriage returns, and expand tabs to preserve column alignment
  const strText = String(text).replace(/\r/g, '').replace(/\t/g, '    ');
  
  let rawWidth = overrideWidth || process.stdout.columns || 80;
  if (typeof rawWidth !== 'number' || isNaN(rawWidth) || rawWidth < 10) {
    rawWidth = 80;
  }
  
  let width = rawWidth;
  if (width >= 60) {
    width = Math.floor(width * 0.80);
  } else {
    width = Math.max(10, Math.floor(width * 0.95));
  }
  const lines = strText.split('\n');
  const wrappedLines = [];
  
  let inCodeBlock = false;

  // Helper function to wrap a string to a specific width (ANSI and wide-char aware)
  function wrapString(content, wrapWidth) {
    const safeWidth = Math.max(5, wrapWidth);
    if (visualLength(content) <= safeWidth) return [content];
    
    const tokens = content.split(/(\s+)/);
    const result = [];
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
      const dividerWidth = Math.min(40, width);
      const padding = ' '.repeat(Math.max(0, Math.floor((width - dividerWidth) / 2)));
      wrappedLines.push(`${padding}${colors.dim}${'· '.repeat(dividerWidth / 2)}${reset}`);
      continue;
    }

    // 2. Detect code block boundaries
    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        const lang = line.trim().substring(3) || 'code';
        const borderLength = Math.max(5, Math.min(30, width - lang.length - 7));
        wrappedLines.push(`${colors.dim}┌── [${colors.tool}${lang}${colors.dim}] ${'─'.repeat(borderLength)}${reset}`);
      } else {
        inCodeBlock = false;
        const borderLength = Math.max(5, Math.min(30, width - 4));
        wrappedLines.push(`${colors.dim}└───${'─'.repeat(borderLength)}${reset}`);
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
      const symbol = level === 1 ? '◆' : level === 2 ? '◇' : '◈';
      const wrapWidth = Math.max(10, width - 2); // 2 is symbol + space
      const wrappedTitle = wrapString(title, wrapWidth);
      const baseColor = colors.header;

      if (wrappedTitle.length > 0) {
        const formattedFirst = applyInlineStyles(wrappedTitle[0]).replace(/\x1b\[39m/g, `\x1b[39m${baseColor}`);
        wrappedLines.push(`${colors.header}${symbol} ${baseColor}${formattedFirst}${reset}`);
        for (let i = 1; i < wrappedTitle.length; i++) {
          const formattedSub = applyInlineStyles(wrappedTitle[i]).replace(/\x1b\[39m/g, `\x1b[39m${baseColor}`);
          wrappedLines.push(`  ${baseColor}${formattedSub}${reset}`);
        }
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
        const bulletSymbol = bulletMatch[2] === '-' ? '•' : bulletMatch[2] === '*' ? '◦' : '▪';
        formattedPrefix = `${bulletMatch[1]}${colors.main}${bulletSymbol}${reset}${bulletMatch[3]}`;
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

  return wrappedLines.join('\n');
}
