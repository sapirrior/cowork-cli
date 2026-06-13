/**
 * Base Component class.
 * All UI widgets (Spinner, Selector, Prompt) inherit from this.
 */
export default class Component {
  constructor(props = {}) {
    this.props = props;
    this.state = {};
    this.engine = null; // Assigned when mounted in TerminalEngine
    this._dirty = true; // NEW: starts dirty to force initial render
    this._cachedLines = []; // NEW: last rendered lines, used when clean
  }

  /**
   * Updates component state and schedules a reactive re-render frame.
   * @param {Object} newState 
   */
  setState(newState) {
    this.state = { ...this.state, ...newState };
    this._dirty = true;
    if (this.engine) {
      this.engine.requestFrame();
    }
  }

  /**
   * Explicitly marks component as dirty to force redraw.
   */
  markDirty() {
    this._dirty = true;
    if (this.engine) {
      this.engine.requestFrame();
    }
  }

  /**
   * Returns lines array, using cache if clean.
   * @param {boolean} forceRedraw
   * @returns {string[]}
   */
  _getLines(forceRedraw = false) {
    if (this._dirty || forceRedraw) {
      this._cachedLines = this.render();
      this._dirty = false;
    }
    return this._cachedLines;
  }

  /**
   * Optional: return { line, column } for cursor placement.
   * null = no custom cursor for this component.
   */
  getCursorPosition() { return null; }

  /** Lifecycle hooks */
  onMount() {
    if (typeof this.componentDidMount === 'function') {
      this.componentDidMount();
    }
  }

  onUnmount() {
    if (typeof this.componentWillUnmount === 'function') {
      this.componentWillUnmount();
    }
  }

  onResize(newWidth, newHeight) {
    this.markDirty();
  }

  render() {
    return [];
  }
}
