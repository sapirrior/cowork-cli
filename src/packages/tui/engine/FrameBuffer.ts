import stringWidth from 'string-width';
import { DocumentTree, ComponentNode } from './DocumentTree.js';

export interface DocumentFrame {
  lines: string[];
  cursor: { line: number; column: number } | null;
  totalVisualRows: number;
  maxScrollOffset: number;
  currentScrollOffset: number;
}

function getStringWidth(str: string): number {
  return stringWidth(str);
}

export function computeDocumentFrame(
  tree: DocumentTree,
  termWidth: number,
  termHeight: number,
  scrollOffset: number = 0,
  forceAll: boolean = false
): DocumentFrame {
  const nodes = tree.getNodes();
  const allLines: string[] = [];
  let cursor: DocumentFrame['cursor'] = null;
  let lineOffset = 0;

  for (const node of nodes) {
    const nodeLines = node.getLines(termWidth, forceAll);
    if (node.getCursorPosition) {
      const pos = node.getCursorPosition();
      if (pos) {
        cursor = {
          line: lineOffset + pos.line,
          column: pos.column,
        };
      }
    }
    allLines.push(...nodeLines);
    lineOffset += nodeLines.length;
  }

  // Measure visual row count for every line at current termWidth (handles zooming)
  const visualRowHeights: number[] = [];
  let totalVisualRows = 0;
  for (const line of allLines) {
    const width = getStringWidth(line);
    const rows = Math.max(1, Math.ceil(width / termWidth));
    visualRowHeights.push(rows);
    totalVisualRows += rows;
  }

  const maxRows = Math.max(1, termHeight - 1);
  const maxScrollOffset = Math.max(0, totalVisualRows - maxRows);
  const clampedScroll = Math.max(0, Math.min(scrollOffset, maxScrollOffset));

  // Slicing for scroll offset (0 = bottom-anchored most recent content)
  let accumulatedRowsFromBottom = 0;
  let endIndex = allLines.length;
  let startIndex = 0;

  for (let i = allLines.length - 1; i >= 0; i--) {
    if (accumulatedRowsFromBottom >= clampedScroll) {
      endIndex = i + 1;
      break;
    }
    accumulatedRowsFromBottom += visualRowHeights[i];
  }

  let viewportRows = 0;
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

  const hiddenLinesAbove = startIndex;
  let adjustedCursor: DocumentFrame['cursor'] = null;
  if (cursor) {
    const effectiveLine = cursor.line - hiddenLinesAbove;
    if (effectiveLine >= 0 && effectiveLine < viewportLines.length) {
      adjustedCursor = { line: effectiveLine, column: cursor.column };
    }
  }

  return {
    lines: viewportLines,
    cursor: adjustedCursor,
    totalVisualRows,
    maxScrollOffset,
    currentScrollOffset: clampedScroll,
  };
}
