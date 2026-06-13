import Component from '../Component.js';

/**
 * StaticZone component allows rendering content (like logs or chat history)
 * once, then keeping it cached and stable without re-rendering it
 * unless new content is explicitly pushed.
 */
export default class StaticZone extends Component {
  constructor(props = {}) {
    super(props);
    this.lines = [];
    this._flushed = false;
  }

  /**
   * Pushes new lines into the static zone.
   * @param {string[]} lines 
   */
  push(lines) {
    this.lines.push(...lines);
    this._dirty = true;
    if (this.engine) {
      this.engine.requestFrame();
    }
  }

  /**
   * Clears all lines in the static zone.
   */
  clear() {
    this.lines = [];
    this._dirty = true;
    this._flushed = false;
    if (this.engine) {
      this.engine.requestFrame();
    }
  }

  render() {
    return this.lines;
  }

  _getLines(force) {
    if (this._flushed && !this._dirty && !force) {
      return this._cachedLines;
    }
    const result = super._getLines(force);
    this._flushed = true;
    return result;
  }
}
