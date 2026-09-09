import stringWidth from 'string-width';
import { DocumentTree, ComponentNode } from './DocumentTree.js';

export interface PhysicalRow {
  /** The literal string to draw for this row (may contain ANSI SGR codes). */
  text: string;
  /** Index of the logical line (within the whole document) this row was wrapped from. */
  sourceLineIndex: number;
  /** Which wrapped segment of that logical line this is (0 = first segment). */
  wrapSegmentIndex: number;
}

export interface CellCursor {
  /** Absolute physical row (0-indexed, within the full unscrolled document). */
  row: number;
  /** 1-indexed physical column, matching existing ANSI CUP convention used by StateRenderer. */
  column: number;
}

export interface CellLayoutResult {
  /** Every physical row of the full (unscrolled) document, in order. */
  physicalRows: PhysicalRow[];
  /** Absolute physical cursor position, or null if no node reports one. */
  cursor: CellCursor | null;
  /** physicalRows.length, kept explicit for viewport math parity with existing totalVisualRows. */
  totalPhysicalRows: number;
}

interface AnsiToken {
  type: 'ansi' | 'char';
  value: string;
  width: number;
}

/**
 * Tokenizes a string into ANSI escape sequences and individual Unicode codepoints/characters.
 */
function tokenizeAnsi(text: string): AnsiToken[] {
  const tokens: AnsiToken[] = [];
  const ansiRegex = /\x1b\[[0-9;]*[a-zA-Z]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ansiRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const plainSegment = text.slice(lastIndex, match.index);
      for (const char of plainSegment) {
        tokens.push({
          type: 'char',
          value: char,
          width: stringWidth(char)
        });
      }
    }
    tokens.push({
      type: 'ansi',
      value: match[0],
      width: 0
    });
    lastIndex = ansiRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    const plainSegment = text.slice(lastIndex);
    for (const char of plainSegment) {
      tokens.push({
        type: 'char',
        value: char,
        width: stringWidth(char)
      });
    }
  }

  return tokens;
}

/**
 * Wraps `text` into lines that do not exceed `maxCols` display columns.
 * Preserves Unicode characters (CJK, emoji) and carries active ANSI styles
 * across wrap boundaries cleanly without splitting escape sequences.
 */
export function wrapVisualLine(text: string, maxCols: number): string[] {
  if (text.length === 0) return [''];
  if (maxCols <= 0) return [text];

  // Quick check: if no ANSI sequences exist, use fast Unicode codepoint iteration
  if (!text.includes('\x1b[')) {
    const lines: string[] = [];
    let currentLine = '';
    let currentWidth = 0;

    for (const char of text) {
      const cw = stringWidth(char);
      if (currentWidth + cw > maxCols && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = char;
        currentWidth = cw;
      } else {
        currentLine += char;
        currentWidth += cw;
      }
    }
    if (currentLine.length > 0 || lines.length === 0) {
      lines.push(currentLine);
    }
    return lines;
  }

  const tokens = tokenizeAnsi(text);
  const lines: string[] = [];
  let currentTokens: AnsiToken[] = [];
  let currentWidth = 0;
  let activeStyles: string[] = [];

  for (const token of tokens) {
    if (token.type === 'ansi') {
      currentTokens.push(token);
      if (token.value === '\x1b[0m' || token.value === '\x1b[39m' || token.value === '\x1b[49m') {
        if (token.value === '\x1b[0m') {
          activeStyles = [];
        } else {
          activeStyles = activeStyles.filter(s => s !== token.value);
        }
      } else {
        activeStyles.push(token.value);
      }
      continue;
    }

    const cw = token.width;
    if (currentWidth + cw > maxCols && currentWidth > 0) {
      // Close active styling for this segment if needed
      let lineStr = currentTokens.map(t => t.value).join('');
      if (activeStyles.length > 0 && !lineStr.endsWith('\x1b[0m')) {
        lineStr += '\x1b[0m';
      }
      lines.push(lineStr);

      // Start new segment carrying forward current active styles
      currentTokens = [];
      if (activeStyles.length > 0) {
        for (const s of activeStyles) {
          currentTokens.push({ type: 'ansi', value: s, width: 0 });
        }
      }
      currentTokens.push(token);
      currentWidth = cw;
    } else {
      currentTokens.push(token);
      currentWidth += cw;
    }
  }

  if (currentTokens.length > 0 || lines.length === 0) {
    let lineStr = currentTokens.map(t => t.value).join('');
    if (activeStyles.length > 0 && lines.length > 0 && !lineStr.endsWith('\x1b[0m')) {
      lineStr += '\x1b[0m';
    }
    lines.push(lineStr);
  }

  return lines;
}

/**
 * Backward-compatible alias for wrapVisualLine.
 */
export function wrapByVisualWidth(text: string, maxCols: number): string[] {
  return wrapVisualLine(text, maxCols);
}

/**
 * Phase A: Measures a single ComponentNode and breaks its logical lines into PhysicalRows.
 */
export function measureNode(
  node: ComponentNode,
  contentWidth: number,
  forceAll: boolean = false
): { rows: PhysicalRow[]; cursorWithinNode: { row: number; column: number } | null } {
  const logicalLines = node.getLines(contentWidth, forceAll);
  const rows: PhysicalRow[] = [];
  const wrapSegmentCounts: number[] = [];

  for (let lIdx = 0; lIdx < logicalLines.length; lIdx++) {
    const line = logicalLines[lIdx];
    const segments = wrapVisualLine(line, contentWidth);
    wrapSegmentCounts.push(segments.length);
    for (let sIdx = 0; sIdx < segments.length; sIdx++) {
      rows.push({
        text: segments[sIdx],
        sourceLineIndex: lIdx,
        wrapSegmentIndex: sIdx
      });
    }
  }

  let cursorWithinNode: { row: number; column: number } | null = null;
  if (node.getCursorPosition) {
    const pos = node.getCursorPosition();
    if (pos) {
      let physicalRow = 0;
      if (pos.line < logicalLines.length) {
        for (let i = 0; i < pos.line; i++) {
          physicalRow += wrapSegmentCounts[i] || 1;
        }
        const colOffset = Math.max(0, pos.column - 1);
        const wrapRowOffset = Math.floor(colOffset / contentWidth);
        const colRemainder = (colOffset % contentWidth) + 1;
        physicalRow += wrapRowOffset;
        cursorWithinNode = {
          row: physicalRow,
          column: colRemainder
        };
      } else {
        cursorWithinNode = {
          row: pos.line,
          column: pos.column
        };
      }
    }
  }

  return { rows, cursorWithinNode };
}

/**
 * Phase B: Lays out the full document tree and computes flat PhysicalRows and absolute CellCursor.
 */
export function layoutDocument(
  tree: DocumentTree,
  termWidth: number,
  forceAll: boolean = false,
  _lineWidthCache?: Map<string, number>
): CellLayoutResult {
  const nodes = tree.getNodes();
  const physicalRows: PhysicalRow[] = [];
  let absoluteCursor: CellCursor | null = null;

  let runningPhysicalRow = 0;

  for (const node of nodes) {
    const { rows, cursorWithinNode } = measureNode(node, termWidth, forceAll);

    if (cursorWithinNode && absoluteCursor === null) {
      absoluteCursor = {
        row: runningPhysicalRow + cursorWithinNode.row,
        column: cursorWithinNode.column
      };
    }

    for (const r of rows) {
      physicalRows.push(r);
    }
    runningPhysicalRow += rows.length;
  }

  return {
    physicalRows,
    cursor: absoluteCursor,
    totalPhysicalRows: physicalRows.length
  };
}
