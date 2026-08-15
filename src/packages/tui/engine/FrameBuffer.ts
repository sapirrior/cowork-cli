import stringWidth from 'string-width';
import { DocumentTree, ComponentNode } from './DocumentTree.js';

export interface DocumentFrame {
  lines: string[];
  cursor: { line: number; column: number } | null;
  totalVisualRows: number;
  maxScrollOffset: number;
  currentScrollOffset: number;
}

function getStringWidth(str: string, cache: Map<string, number>): number {
  let w = cache.get(str);
  if (w === undefined) {
    w = stringWidth(str);
    cache.set(str, w);
  }
  return w;
}

export function computeDocumentFrame(
  tree: DocumentTree,
  termWidth: number,
  termHeight: number,
  scrollOffset: number = 0,
  forceAll: boolean = false,
  lineWidthCache: Map<string, number> = new Map()
): DocumentFrame {
  const nodes = tree.getNodes();
  const allLines: string[] = [];
  let cursorLineIndex = -1;
  let cursorColumn = 0;

  for (const node of nodes) {
    const nodeLines = node.getLines(termWidth, forceAll);
    const startLineIndex = allLines.length;

    if (node.getCursorPosition) {
      const pos = node.getCursorPosition();
      if (pos) {
        cursorLineIndex = startLineIndex + pos.line;
        cursorColumn = pos.column;
      }
    }
    allLines.push(...nodeLines);
  }

  // Measure visual row height for every line at current termWidth
  const visualRowHeights: number[] = [];
  let totalVisualRows = 0;
  for (const line of allLines) {
    const width = getStringWidth(line, lineWidthCache);
    const rows = Math.max(1, Math.ceil(width / termWidth));
    visualRowHeights.push(rows);
    totalVisualRows += rows;
  }

  const maxRows = Math.max(1, termHeight - 1);
  const maxScrollOffset = Math.max(0, totalVisualRows - maxRows);
  const clampedScroll = Math.max(0, Math.min(scrollOffset, maxScrollOffset));

  // Determine viewport lines based on scroll offset
  let accumulatedRowsFromBottom = 0;
  let endIndex = allLines.length;

  for (let i = allLines.length - 1; i >= 0; i--) {
    if (accumulatedRowsFromBottom >= clampedScroll) {
      endIndex = i + 1;
      break;
    }
    accumulatedRowsFromBottom += visualRowHeights[i];
  }

  let viewportRows = 0;
  let startIndex = 0;
  const viewportLines: string[] = [];
  for (let i = endIndex - 1; i >= 0; i--) {
    const rows = visualRowHeights[i];
    if (viewportRows + rows > maxRows && viewportLines.length > 0) {
      startIndex = i + 1;
      break;
    }
    viewportLines.unshift(allLines[i]);
    viewportRows += rows;
  }

  // Calculate physical screen row for cursor
  let cursorViewportRow = -1;
  if (cursorLineIndex >= startIndex && cursorLineIndex < endIndex) {
    let physicalRow = 0;
    for (let i = startIndex; i < cursorLineIndex; i++) {
      physicalRow += visualRowHeights[i];
    }
    cursorViewportRow = physicalRow;
  }

  const adjustedCursor = (cursorViewportRow >= 0 && cursorViewportRow < maxRows)
    ? { line: cursorViewportRow, column: cursorColumn }
    : null;

  return {
    lines: viewportLines,
    cursor: adjustedCursor,
    totalVisualRows,
    maxScrollOffset,
    currentScrollOffset: clampedScroll,
  };
}
