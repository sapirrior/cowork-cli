import { wrapVisualLine } from './cell-layout.js';

export interface ComponentNode {
  id: string;
  kind: 'text' | 'spinner' | 'input' | 'select' | 'custom';
  getLines(width: number, forceAll?: boolean): string[];
  /**
   * Optional: physical row and column relative to this node's own physical rows.
   * line: 0-indexed physical row within this node's rendered physical rows.
   * column: 1-indexed column.
   */
  getCursorPosition?(): { line: number; column: number } | null;
  onMount?(): void;
  onUnmount?(): void;
  onResize?(width: number, height: number): void;
}

export class TextNode implements ComponentNode {
  id: string;
  kind: 'text' = 'text';
  lines: string[];
  wrappable: boolean;
  private _cachedWidth: number = -1;
  private _cachedWrapped: string[] = [];

  constructor(id: string, lines: string[], wrappable: boolean = true) {
    this.id = id;
    this.lines = lines;
    this.wrappable = wrappable;
  }

  getLines(width: number): string[] {
    if (!this.wrappable) return this.lines;
    if (width === this._cachedWidth) return this._cachedWrapped;
    this._cachedWidth = width;
    this._cachedWrapped = this.lines.flatMap(line => wrapVisualLine(line, width));
    return this._cachedWrapped;
  }
}

export class DocumentTree {
  private nodes: ComponentNode[] = [];
  private idCounter = 0;

  addText(lines: string[], wrappable: boolean = true): TextNode {
    const node = new TextNode(`node-${this.idCounter++}`, lines, wrappable);
    this.nodes.push(node);
    return node;
  }

  mountNode(node: ComponentNode): void {
    if (!this.nodes.includes(node)) {
      this.nodes.push(node);
      if (typeof node.onMount === 'function') {
        node.onMount();
      }
    }
  }

  unmountNode(node: ComponentNode): void {
    if (typeof node.onUnmount === 'function') {
      node.onUnmount();
    }
    this.nodes = this.nodes.filter(n => n !== node);
  }

  getNodes(): ComponentNode[] {
    return [...this.nodes];
  }

  clearAll(): void {
    for (const node of this.nodes) {
      if (typeof node.onUnmount === 'function') {
        node.onUnmount();
      }
    }
    this.nodes = [];
  }
}
