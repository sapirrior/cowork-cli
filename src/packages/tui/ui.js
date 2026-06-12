import TerminalEngine from './engine/TerminalEngine.js';
import Spinner from './engine/components/Spinner.js';
import SelectionList from './engine/components/SelectionList.js';
import PromptInput from './engine/components/PromptInput.js';
import { outputFormatted } from './outputFormatter.js';

class UIEngine {
  constructor() {
    this.engine = new TerminalEngine();
    this.spinnerComponent = null;
  }

  // Formatting helpers matching traditional COLORS
  _rgb(rgbArr, text) {
    return `\x1b[38;2;${rgbArr[0]};${rgbArr[1]};${rgbArr[2]}m${text}\x1b[0m`;
  }
  _bold(text) { return `\x1b[1m${text}\x1b[0m`; }
  _dim(text)  { return `\x1b[2m${text}\x1b[0m`; }

  /**
   * Enter spinning loading state.
   */
  start(label, data = '') {
    this._abortActiveSpinner();
    this.spinnerComponent = new Spinner({ label, data, rotating: false });
    this.engine.mount(this.spinnerComponent);
    this.spinnerComponent.componentDidMount();
  }

  /**
   * Enter thinking animation state (words rotate).
   */
  think() {
    this._abortActiveSpinner();
    this.spinnerComponent = new Spinner({ label: 'Thinking...', data: '', rotating: true });
    this.engine.mount(this.spinnerComponent);
    this.spinnerComponent.componentDidMount();
  }

  /**
   * Update active spinner parameters inline without flickering.
   */
  update(data) {
    if (this.spinnerComponent) {
      this.spinnerComponent.setState({ data });
    }
  }

  /**
   * Stop active spinner and output clean success line.
   */
  stop(msg) {
    this._commitSpinner(msg, [122, 195, 145]); // green dot
  }

  /**
   * Stop active spinner and output failure line.
   */
  fail(msg) {
    this._commitSpinner(msg, [224, 112, 112]); // red dot
  }

  /**
   * Write logs safely without breaking components layout.
   */
  /**
   * Write logs safely without breaking components layout.
   */
  log(text) {
    const hasActiveComponents = this.engine.components.length > 0;
    if (hasActiveComponents) {
      this.engine.clear();
      process.stdout.write(text + '\n');
      this.engine.render();
    } else {
      process.stdout.write(text + '\n');
    }
  }

  /**
   * Print colored section header dot.
   */
  header(title) {
    const purple = [163, 122, 204];
    const blue = [123, 165, 218];
    this.log(`${this._rgb(purple, '●')} ${this._rgb(blue, this._bold(title.toLowerCase()))}`);
  }

  /**
   * Render execution duration metadata.
   */
  footer(duration) {
    const blue = [123, 165, 218];
    this.log(`${this._dim('time')} ${this._rgb(blue, duration + 's')}`);
  }

  /**
   * Prompt user for text inputs inline.
   */
  /**
   * Prompt user for text inputs inline.
   */
  async ask(question) {
    this._abortActiveSpinner();
    if (!process.stdin.isTTY) {
      throw new Error('stdin is not a TTY');
    }

    const inputComp = new PromptInput({ question, currentVal: '' });
    this.engine.mount(inputComp, { keepCursorVisible: true });

    return new Promise((resolve, reject) => {
      let buffer = '';

      const onData = (chunk) => {
        const str = chunk.toString();

        // Ctrl+C handling
        if (str === '\u0003') {
          cleanup();
          this.engine.unmountAll();
          const blueColor = [123, 165, 218];
          const yellowColor = [242, 207, 110];
          const silverColor = [194, 198, 197];
          const redColor = [224, 112, 112];
          process.stdout.write(`${this._rgb(blueColor, '◇')} ${this._rgb(yellowColor, 'Ask:')} ${this._rgb(silverColor, question)}\n`);
          process.stdout.write(`${this._rgb(blueColor, '➔')} ${this._rgb(redColor, 'cancelled')}\n`);
          reject({ cancelled: true });
          return;
        }

        // Backspace
        if (str === '\u007f' || str === '\b') {
          if (buffer.length > 0) {
            buffer = buffer.slice(0, -1);
            inputComp.setState({ currentVal: buffer });
          }
          return;
        }

        // Enter
        if (str === '\r' || str === '\n') {
          cleanup();
          this.engine.unmountAll();
          const blueColor = [123, 165, 218];
          const yellowColor = [242, 207, 110];
          const silverColor = [194, 198, 197];
          process.stdout.write(`${this._rgb(blueColor, '◇')} ${this._rgb(yellowColor, 'Ask:')} ${this._rgb(silverColor, question)}\n`);
          process.stdout.write(`${this._rgb(blueColor, '➔')}  ${buffer}\n`);
          resolve(buffer.trim());
          return;
        }

        // Normal text inputs
        if (str.length === 1 && str >= ' ') {
          buffer += str;
          inputComp.setState({ currentVal: buffer });
        }
      };

      const cleanup = () => {
        process.stdin.setRawMode(false);
        process.stdin.off('data', onData);
        process.stdin.pause();
      };

      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', onData);
    });
  }

  /**
   * Toggle boolean prompts.
   */
  async confirm(question) {
    this._abortActiveSpinner();
    if (!process.stdin.isTTY) {
      return { confirmed: false, dismissed: true };
    }

    const blueColor = [123, 165, 218];
    
    // Mount toggle prompt component
    const listComp = new SelectionList({ question, items: ['Yes', 'No'], selectedIdx: 0 });
    this.engine.mount(listComp);

    return new Promise((resolve) => {
      let selectedYes = true;

      const onData = (chunk) => {
        const str = chunk.toString();

        if (str === '\u0003') {
          cleanup();
          this.engine.unmountAll();
          const yellowColor = [242, 207, 110];
          const silverColor = [194, 198, 197];
          process.stdout.write(`${this._rgb(blueColor, '◇')} ${this._rgb(yellowColor, 'Ask Confirm:')} ${this._rgb(silverColor, question)}\n`);
          process.stdout.write(`${this._rgb(blueColor, '➔')} ${this._dim('cancelled')}\n`);
          resolve({ confirmed: false, dismissed: true });
          return;
        }

        if (str === '\r' || str === '\n') {
          cleanup();
          this.engine.unmountAll();
          const yellowColor = [242, 207, 110];
          const silverColor = [194, 198, 197];
          const finalColor = selectedYes ? [122, 195, 145] : [224, 112, 112];
          const finalStr = selectedYes ? 'yes' : 'no';
          process.stdout.write(`${this._rgb(blueColor, '◇')} ${this._rgb(yellowColor, 'Ask Confirm:')} ${this._rgb(silverColor, question)}\n`);
          process.stdout.write(`${this._rgb(blueColor, '➔')} ${this._rgb(finalColor, finalStr)}\n`);
          resolve({ confirmed: selectedYes });
          return;
        }

        if (str === '\u001b[D' || str === '\u001b[C' || str === '\u001b[A' || str === '\u001b[B' || str === '\t' || str === ' ') {
          selectedYes = !selectedYes;
          listComp.setState({ selectedIdx: selectedYes ? 0 : 1 });
        } else if (str.toLowerCase() === 'y') {
          selectedYes = true;
          listComp.setState({ selectedIdx: 0 });
        } else if (str.toLowerCase() === 'n') {
          selectedYes = false;
          listComp.setState({ selectedIdx: 1 });
        }
      };

      const cleanup = () => {
        process.stdin.setRawMode(false);
        process.stdin.off('data', onData);
        process.stdin.pause();
      };

      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', onData);
    });
  }

  cleanup() {
    this._abortActiveSpinner();
  }

  _abortActiveSpinner() {
    if (this.spinnerComponent) {
      this.spinnerComponent.componentWillUnmount();
      this.engine.unmountAll();
      this.spinnerComponent = null;
    }
  }

  _commitSpinner(msg, color) {
    if (!this.spinnerComponent) return;

    this.spinnerComponent.componentWillUnmount();
    this.engine.clear();

    const label = this.spinnerComponent.state.label === 'Thinking...' ? 'Thought' : this.spinnerComponent.state.label;
    const data = msg !== undefined ? msg : this.spinnerComponent.state.data;

    const blueColor = [123, 165, 218];
    const dataStr = data ? ` ${this._rgb(blueColor, '(')}${this._rgb([194, 198, 197], data)}${this._rgb(blueColor, ')')}` : '';
    process.stdout.write(`${this._rgb(color, '●')} ${this._rgb([242, 207, 110], label)}${dataStr}\n`);

    this.engine.unmountAll();
    this.spinnerComponent = null;
  }
}

export const ui = new UIEngine();
export { outputFormatted };
