/**
 * Base Component class.
 * All UI widgets (Spinner, Selector, Prompt) inherit from this.
 */
export default class Component {
  constructor(props = {}) {
    this.props = props;
    this.state = {};
    this.engine = null; // Assigned when mounted in TerminalEngine
  }

  /**
   * Updates component state and schedules a reactive re-render frame.
   * @param {Object} newState 
   */
  setState(newState) {
    this.state = { ...this.state, ...newState };
    if (this.engine) {
      this.engine.requestFrame();
    }
  }

  /**
   * Returns an array of lines to draw for this component.
   * Override in child classes.
   * @returns {string[]}
   */
  render() {
    return [];
  }
}
