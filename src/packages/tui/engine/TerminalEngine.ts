import Component from './Component.js';
import HistoryStore from './HistoryStore.js';
import StateRenderer from './StateRenderer.js';
import { DocumentTree, ComponentNode } from './DocumentTree.js';
import stringWidth from 'string-width';

class ComponentNodeAdapter implements ComponentNode {
  id: string;
  kind: 'spinner' | 'input' | 'select' | 'custom' = 'custom';
  comp: Component;

  constructor(id: string, comp: Component) {
    this.id = id;
    this.comp = comp;
  }

  getLines(width: number, forceAll?: boolean): string[] {
    return this.comp._getLines(forceAll);
  }

  getCursorPosition(): { line: number; column: number } | null {
    if (typeof this.comp.getCursorPosition === 'function') {
      return this.comp.getCursorPosition();
    }
    return null;
  }

  onMount(): void {
    if (typeof this.comp.onMount === 'function') {
      this.comp.onMount();
    }
  }

  onUnmount(): void {
    if (typeof this.comp.onUnmount === 'function') {
      this.comp.onUnmount();
    }
  }

  onResize(width: number, height: number): void {
    if (typeof this.comp.onResize === 'function') {
      this.comp.onResize(width, height);
    }
  }
}

export default class TerminalEngine {
  tree: DocumentTree;
  history: HistoryStore;
  components: Component[];
  private adapters: Map<Component, ComponentNodeAdapter>;
  private renderer: StateRenderer;
  dirty: boolean;
  cursorHidden: boolean;
  inAlternateScreen: boolean;
  scrollOffset: number;
  private resizeHandler: () => void;
  private inputHandler: (data: Buffer) => void;
  private resizeTimer: NodeJS.Timeout | null = null;
  private idCounter = 0;

  constructor() {
    this.tree = new DocumentTree();
    this.history = new HistoryStore();
    this.components = [];
    this.adapters = new Map();
    this.renderer = new StateRenderer();
    this.dirty = false;
    this.cursorHidden = false;
    this.inAlternateScreen = false;
    this.scrollOffset = 0;

    // Window resize & zoom handler: debounced for smooth reflow
    this.resizeHandler = () => {
      if (this.resizeTimer) {
        clearTimeout(this.resizeTimer);
      }
      this.resizeTimer = setTimeout(() => {
        const w = process.stdout.columns || 80;
        const h = process.stdout.rows || 24;
        for (const comp of this.components) {
          if (typeof comp.onResize === 'function') {
            comp.onResize(w, h);
          }
        }
        // After a resize, content re-wraps at the new width, invalidating any
        // raw-row scroll offset. Clamp to bottom (offset=0) so the user always
        // sees the most recent content rather than a stale offset pointing into
        // nothing. If the user was scrolled up intentionally, they lose position,
        // but that is far better than history appearing to vanish.
        if (this.scrollOffset > 0) {
          this.scrollOffset = 0;
        }
        this.requestFrame(true);
      }, 50);
    };

    // Input handler for scroll events & arrow navigation in Alternate Screen mode
    this.inputHandler = (data: Buffer) => {
      if (!this.inAlternateScreen) return;
      const str = data.toString();

      // Check if an interactive input component is handling keyboard navigation
      const hasInteractiveComponent = this.components.some(c => typeof (c as any).handleInput === 'function');

      if (!hasInteractiveComponent) {
        // Up Arrow key: scroll up 1 line
        if (str === '\x1b[A') {
          this.scrollUp(1);
          return;
        }
        // Down Arrow key: scroll down 1 line
        if (str === '\x1b[B') {
          this.scrollDown(1);
          return;
        }
      }

      // Mouse wheel scroll up / PageUp: \x1b[<64; or \x1b[5~
      if (str.includes('\x1b[<64;') || str.includes('\x1b[5~')) {
        this.scrollUp(3);
      }
      // Mouse wheel scroll down / PageDown: \x1b[<65; or \x1b[6~
      else if (str.includes('\x1b[<65;') || str.includes('\x1b[6~')) {
        this.scrollDown(3);
      }
      // Home key (scroll to top): \x1b[1~
      else if (str.includes('\x1b[1~')) {
        this.scrollUp(999999);
      }
      // End key (scroll to bottom): \x1b[4~
      else if (str.includes('\x1b[4~')) {
        this.scrollToBottom();
      }
    };

    // Restore terminal cursor visibility synchronously on exit if unhandled
    process.on('exit', () => {
      this.showCursor();
      if (this.inAlternateScreen) {
        process.stdout.write('\x1b[?1007l\x1b[?1006l\x1b[?1002l\x1b[?1000l\x1b[?1049l');
        this.inAlternateScreen = false;
        const lines = this.history.getPrimaryScreenLines();
        for (const line of lines) {
          process.stdout.write(line + '\n');
        }
      }
    });
  }

  /**
   * Scroll up into historical lines in Alternate Screen view.
   */
  scrollUp(amount: number = 3): void {
    this.scrollOffset += amount;
    this.requestFrame();
  }

  /**
   * Scroll down towards recent lines in Alternate Screen view.
   */
  scrollDown(amount: number = 3): void {
    this.scrollOffset = Math.max(0, this.scrollOffset - amount);
    this.requestFrame();
  }

  /**
   * Reset scroll position to bottom (most recent content).
   */
  scrollToBottom(): void {
    this.scrollOffset = 0;
    this.requestFrame();
  }

  /**
   * Enters Alternate Screen Buffer (\x1b[?1049h) with SGR mouse tracking & xterm Alternate Scroll (\x1b[?1007h) enabled.
   */
  ensureAlternateScreen(): void {
    if (!this.inAlternateScreen) {
      process.stdout.write('\x1b[?1049h\x1b[H\x1b[?1000h\x1b[?1002h\x1b[?1006h\x1b[?1007h');
      this.inAlternateScreen = true;
      if (process.stdin.isTTY) {
        process.stdin.on('data', this.inputHandler);
      }
      process.stdout.on('resize', this.resizeHandler);
    }
  }

  /**
   * Asynchronously exits Alternate Screen Buffer (\x1b[?1049l), flushes full execution history cleanly to primary terminal scrollback,
   * and waits for stdout stream drain before returning.
   */
  async flushHistoryToPrimaryScreen(): Promise<void> {
    this.showCursor();
    if (this.inAlternateScreen) {
      process.stdout.write('\x1b[?1007l\x1b[?1006l\x1b[?1002l\x1b[?1000l\x1b[?1049l');
      this.inAlternateScreen = false;
      if (process.stdin.isTTY) {
        process.stdin.off('data', this.inputHandler);
      }
      if (this.resizeTimer) {
        clearTimeout(this.resizeTimer);
        this.resizeTimer = null;
      }
      process.stdout.off('resize', this.resizeHandler);

      const lines = this.history.getPrimaryScreenLines();
      for (const line of lines) {
        process.stdout.write(line + '\n');
      }

      // Asynchronous stdout drain delay to guarantee terminal emulator receives and renders all flushed lines
      await new Promise<void>((resolve) => {
        const canWrite = process.stdout.write('');
        if (canWrite) {
          setTimeout(resolve, 60);
        } else {
          process.stdout.once('drain', () => {
            setTimeout(resolve, 60);
          });
        }
      });
    }
  }

  /**
   * Hide cursor safely.
   */
  hideCursor(): void {
    if (!this.cursorHidden) {
      process.stdout.write('\x1b[?25l');
      this.cursorHidden = true;
    }
  }

  /**
   * Show cursor safely.
   */
  showCursor(): void {
    if (this.cursorHidden) {
      process.stdout.write('\x1b[?25h');
      this.cursorHidden = false;
    }
  }

  /**
   * Commit static content to DocumentTree history and schedule a frame render.
   */
  commit(kind: 'log' | 'header' | 'footer' | 'tool-result' | 'assistant-message' | 'raw' | 'logo' | 'prompt', lines: string[]): void {
    this.ensureAlternateScreen();
    this.history.push(kind, lines);
    this.tree.addText(lines);
    this.requestFrame();
  }

  /**
   * Mounts a component to the engine document tree.
   */
  mount(component: Component, options: { keepCursorVisible?: boolean } = {}): void {
    this.ensureAlternateScreen();
    component.engine = this;
    this.components.push(component);

    const adapter = new ComponentNodeAdapter(`comp-${this.idCounter++}`, component);
    this.adapters.set(component, adapter);
    this.tree.mountNode(adapter);

    if (options.keepCursorVisible) {
      this.showCursor();
    } else {
      this.hideCursor();
    }

    this.requestFrame();
  }

  /**
   * Unmount a specific component from DocumentTree.
   */
  unmount(component: Component): void {
    const adapter = this.adapters.get(component);
    if (adapter) {
      this.tree.unmountNode(adapter);
      this.adapters.delete(component);
    }
    this.components = this.components.filter(c => c !== component);
    this.requestFrame();
  }

  /**
   * Clears current visual buffer record.
   */
  clear(): void {
    this.renderer.clearPreviousFrameRecord();
  }

  /**
   * Unmounts all live components from DocumentTree.
   */
  unmountAll(): void {
    this.showCursor();
    for (const comp of this.components) {
      const adapter = this.adapters.get(comp);
      if (adapter) {
        this.tree.unmountNode(adapter);
      }
    }
    this.components = [];
    this.adapters.clear();
    this.dirty = false;
    this.requestFrame();
  }

  /**
   * Request a redraw frame on the next tick.
   */
  requestFrame(forceFull = false): void {
    if (this.dirty) return;
    this.dirty = true;

    process.nextTick(() => {
      if (this.dirty) {
        this.dirty = false;
        if (this.inAlternateScreen) {
          const frame = this.renderer.render(this.tree, this.scrollOffset, forceFull);
          this.scrollOffset = frame.currentScrollOffset;
        }
      }
    });
  }
}
