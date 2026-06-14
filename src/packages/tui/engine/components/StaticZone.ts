import Component from '../Component.js';

/**
 * StaticZone component allows rendering content (like logs or chat history)
 * once, then keeping it cached and stable without re-rendering it
 * unless new content is explicitly pushed.
 */
export default class StaticZone extends Component<Record<string, any>, Record<string, any>> {
  lines: string[];
  _flushed: boolean;

  constructor(props: Record<string, any> = {}) {
    super(props);
    this.lines = [];
    this._flushed = false;
  }

  /**
   * Pushes new lines into the static zone.
   */
  push(lines: string[]): void {
    this.lines.push(...lines);
    this._dirty = true;
    if (this.engine) {
      this.engine.requestFrame();
    }
  }

  /**
   * Clears all lines in the static zone.
   */
  clear(): void {
    this.lines = [];
    this._dirty = true;
    this._flushed = false;
    if (this.engine) {
      this.engine.requestFrame();
    }
  }

  override render(): string[] {
    return this.lines;
  }

  override _getLines(force: boolean = false): string[] {
    if (this._flushed && !this._dirty && !force) {
      return this._cachedLines;
    }
    const result = super._getLines(force);
    this._flushed = true;
    return result;
  }
}
