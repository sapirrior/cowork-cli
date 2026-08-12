import { THEME } from '../theme.js';

interface HighlightRule {
  pattern: RegExp;
  color: [number, number, number];
}

// Color formatter function using TrueColor ANSI sequence
function colorText(color: [number, number, number], text: string): string {
  return `\x1b[38;2;${color[0]};${color[1]};${color[2]}m${text}\x1b[0m`;
}

// C-like rules for TS, JS, Go, Rust, C++, C, Java, C#, PHP
const cLikeRules: HighlightRule[] = [
  { pattern: /\/\/.*|\/\*[\s\S]*?\*\//y, color: THEME.dim },
  { pattern: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'|`(\\.|[^`\\])*`/y, color: THEME.success },
  { pattern: /\b(break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|false|finally|for|function|if|import|in|instanceof|new|null|return|super|switch|this|throw|true|try|typeof|var|void|while|with|yield|let|package|private|protected|public|static|await|async|fn|func|type|struct|impl|interface|module|defer|select|chan|go|nil|namespace|using|virtual|override)\b/y, color: THEME.header },
  { pattern: /\b(string|number|boolean|any|void|int|float|double|char|long|short|unsigned|signed|byte|bool|int8|int16|int32|int64|uint8|uint16|uint32|uint64|float32|float64|complex64|complex128|uintptr|error|map|slice|interface|Promise|Object|Array|Map|Set)\b/y, color: THEME.main },
  { pattern: /\b[a-zA-Z_]\w*(?=\s*\()/y, color: THEME.tool },
  { pattern: /\b\d+(?:\.\d+)?\b/y, color: THEME.error }
];

const LanguageRules: Record<string, HighlightRule[]> = {
  javascript: cLikeRules,
  typescript: cLikeRules,
  go: cLikeRules,
  rust: cLikeRules,
  cpp: cLikeRules,
  java: cLikeRules,
  csharp: cLikeRules,
  php: cLikeRules,
  python: [
    { pattern: /#.*/y, color: THEME.dim },
    { pattern: /r?"""[\s\S]*?"""|r?'''[\s\S]*?'''|r?"(\\.|[^"\\])*"|r?'(\\.|[^'\\])*'/y, color: THEME.success },
    { pattern: /\b(False|None|True|and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield|print|len|range)\b/y, color: THEME.header },
    { pattern: /\b[a-zA-Z_]\w*(?=\s*\()/y, color: THEME.tool },
    { pattern: /\b\d+(?:\.\d+)?\b/y, color: THEME.error }
  ],
  bash: [
    { pattern: /#.*/y, color: THEME.dim },
    { pattern: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/y, color: THEME.success },
    { pattern: /\b(if|then|elif|else|fi|case|esac|for|while|until|do|done|in|function|exit|return|local|export|alias)\b/y, color: THEME.header },
    { pattern: /\s-[a-zA-Z0-9_-]+/y, color: THEME.main }
  ],
  json: [
    { pattern: /"(\\.|[^"\\])*"(?=\s*:)/y, color: THEME.main },
    { pattern: /"(\\.|[^"\\])*"/y, color: THEME.success },
    { pattern: /\b(true|false|null)\b/y, color: THEME.header },
    { pattern: /\b\d+(?:\.\d+)?\b/y, color: THEME.error }
  ],
  yaml: [
    { pattern: /#.*/y, color: THEME.dim },
    { pattern: /^\s*[a-zA-Z0-9_-]+(?=\s*:)/y, color: THEME.main },
    { pattern: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/y, color: THEME.success },
    { pattern: /\b(true|false|null|yes|no)\b/y, color: THEME.header },
    { pattern: /\b\d+(?:\.\d+)?\b/y, color: THEME.error }
  ],
  html: [
    { pattern: /<!--[\s\S]*?-->/y, color: THEME.dim },
    { pattern: /(?<=<\/?)[a-zA-Z0-9:-]+/y, color: THEME.header },
    { pattern: /\b[a-zA-Z0-9:-]+(?=\s*=)/y, color: THEME.main },
    { pattern: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/y, color: THEME.success }
  ],
  css: [
    { pattern: /\/\*[\s\S]*?\*\//y, color: THEME.dim },
    { pattern: /[.#][a-zA-Z0-9_-]+/y, color: THEME.main },
    { pattern: /\b[a-zA-Z0-9_-]+(?=\s*:)/y, color: THEME.header },
    { pattern: /(?<=:\s*)[^;]+/y, color: THEME.success }
  ],
  sql: [
    { pattern: /--.*/y, color: THEME.dim },
    { pattern: /'(\\.|[^'\\])*'/y, color: THEME.success },
    { pattern: /\b(SELECT|FROM|WHERE|INSERT|INTO|UPDATE|DELETE|JOIN|ON|GROUP|BY|ORDER|HAVING|CREATE|TABLE|DROP|INDEX|ALTER|AS|AND|OR|NOT|IN|NULL|IS|LIKE|INNER|LEFT|RIGHT|OUTER|CROSS|UNION|ALL|VALUES|SET)\b/iy, color: THEME.header },
    { pattern: /\b\d+(?:\.\d+)?\b/y, color: THEME.error }
  ],
  markdown: [
    { pattern: /^#{1,6}\s+.+/y, color: THEME.header },
    { pattern: /`[^`]+`|```[a-zA-Z0-9_-]*/y, color: THEME.tool },
    { pattern: /\*\*[^*]+\*\*|\*[^*]+\*/y, color: THEME.main },
    { pattern: /\[[^\]]+\]\([^)]+\)/y, color: THEME.success }
  ]
};

/**
 * Automatically detects the language of a target file.
 */
export function detectLanguage(target: string, content: string[] = []): string {
  if (!target) return 'text';
  const cleanTarget = target.toLowerCase();
  
  if (cleanTarget.endsWith('.ts') || cleanTarget.endsWith('.tsx')) return 'typescript';
  if (cleanTarget.endsWith('.js') || cleanTarget.endsWith('.jsx') || cleanTarget.endsWith('.mjs')) return 'javascript';
  if (cleanTarget.endsWith('.py')) return 'python';
  if (cleanTarget.endsWith('.go')) return 'go';
  if (cleanTarget.endsWith('.rs')) return 'rust';
  if (cleanTarget.endsWith('.cpp') || cleanTarget.endsWith('.cc') || cleanTarget.endsWith('.h') || cleanTarget.endsWith('.hpp') || cleanTarget.endsWith('.c')) return 'cpp';
  if (cleanTarget.endsWith('.java')) return 'java';
  if (cleanTarget.endsWith('.cs')) return 'csharp';
  if (cleanTarget.endsWith('.php')) return 'php';
  if (cleanTarget.endsWith('.html') || cleanTarget.endsWith('.xml')) return 'html';
  if (cleanTarget.endsWith('.css')) return 'css';
  if (cleanTarget.endsWith('.json')) return 'json';
  if (cleanTarget.endsWith('.yaml') || cleanTarget.endsWith('.yml')) return 'yaml';
  if (cleanTarget.endsWith('.sh') || cleanTarget.endsWith('.bash')) return 'bash';
  if (cleanTarget.endsWith('.md')) return 'markdown';
  if (cleanTarget.endsWith('.sql')) return 'sql';
  
  // Quick heuristic content check
  const joined = content.slice(0, 5).join('\n');
  if (joined.includes('import ') || (joined.includes('const ') && joined.includes('='))) return 'javascript';
  if (joined.includes('def ') && joined.includes(':')) return 'python';
  if (joined.includes('package main')) return 'go';
  if (joined.includes('fn main') || joined.includes('pub struct ')) return 'rust';
  
  return 'text';
}

/**
 * Highlights a single line of code based on the language.
 */
export function highlightLine(line: string, language: string): string {
  if (language === 'text') {
    return colorText(THEME.data, line);
  }

  const rules = LanguageRules[language] || LanguageRules['javascript'];
  let result = '';
  let index = 0;

  while (index < line.length) {
    let bestMatch: { start: number; end: number; color: [number, number, number] } | null = null;

    for (const rule of rules) {
      rule.pattern.lastIndex = index;
      const match = rule.pattern.exec(line);
      if (match) {
        const matchLength = match[0].length;
        if (!bestMatch || matchLength > (bestMatch.end - bestMatch.start)) {
          bestMatch = {
            start: index,
            end: index + matchLength,
            color: rule.color
          };
        }
      }
    }

    if (bestMatch) {
      const matchText = line.substring(bestMatch.start, bestMatch.end);
      result += colorText(bestMatch.color, matchText);
      index = bestMatch.end;
    } else {
      result += colorText(THEME.data, line[index]);
      index++;
    }
  }

  return result;
}
