import { DocumentTree } from './DocumentTree.js';
import { computeDocumentFrame, type DocumentFrame } from './FrameBuffer.js';

export default class StateRenderer {
  private syncActive = false;

  private beginSync(): string {
    if (this.syncActive) return '';
    this.syncActive = true;
    return '\x1b[?2026h';
  }

  private endSync(): string {
    if (!this.syncActive) return '';
    this.syncActive = false;
    return '\x1b[?2026l';
  }

  render(tree: DocumentTree, scrollOffset: number = 0, forceFull = false): DocumentFrame {
    const termWidth = process.stdout.columns || 80;
    const termHeight = process.stdout.rows || 24;

    const nextFrame = computeDocumentFrame(tree, termWidth, termHeight, scrollOffset, forceFull);

    let output = this.beginSync();

    // In Alternate Screen Buffer, clear from top-left (0,0) for clean scroll and zoom rendering
    output += '\x1b[H\x1b[J';

    for (let i = 0; i < nextFrame.lines.length; i++) {
      const line = nextFrame.lines[i];
      if (i === nextFrame.lines.length - 1) {
        output += '\r' + line;
      } else {
        output += '\r' + line + '\n';
      }
    }

    if (nextFrame.cursor) {
      output += `\x1b[${nextFrame.cursor.line + 1};${nextFrame.cursor.column}H`;
    }

    output += this.endSync();

    process.stdout.write(output);

    return nextFrame;
  }

  clearPreviousFrameRecord(): void {
    // No-op in Alternate Screen rendering
  }
}
