export interface ComponentNode {
  id: string;
  kind: 'text' | 'spinner' | 'input' | 'select' | 'custom';
  getLines(width: number, forceAll?: boolean): string[];
  getCursorPosition?(): { line: number; column: number } | null;
  onMount?(): void;
  onUnmount?(): void;
  onResize?(width: number, height: number): void;
}

export class TextNode implements ComponentNode {
  id: string;
  kind: 'text' = 'text';
  lines: string[];

  constructor(id: string, lines: string[]) {
    this.id = id;
    this.lines = lines;
  }

  getLines(): string[] {
    return this.lines;
  }
}

export class DocumentTree {
  private nodes: ComponentNode[] = [];
  private idCounter = 0;

  addText(lines: string[]): TextNode {
    const node = new TextNode(`node-${this.idCounter++}`, lines);
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
