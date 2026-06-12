import TerminalEngine from '../engine/TerminalEngine.js';
import * as format from './format.js';
import * as spinner from './spinner.js';
import * as prompt from './prompt.js';

class UIEngine {
  constructor() {
    this.engine = new TerminalEngine();
    this.spinnerComponent = null;
  }

  _rgb(rgbArr, text) { return format.rgb(rgbArr, text); }
  _bold(text) { return format.bold(text); }
  _dim(text) { return format.dim(text); }

  start(label, data = '') { spinner.start(this, label, data); }
  think() { spinner.think(this); }
  update(data) { spinner.update(this, data); }
  stop(msg) { spinner.stop(this, msg); }
  fail(msg) { spinner.fail(this, msg); }
  _abortActiveSpinner() { spinner.abortActiveSpinner(this); }
  _commitSpinner(msg, color) { spinner.commitSpinner(this, msg, color); }

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

  header(title) {
    const purple = [163, 122, 204];
    const blue = [123, 165, 218];
    this.log(`${this._rgb(purple, '●')} ${this._rgb(blue, this._bold(title.toLowerCase()))}`);
  }

  footer(duration) {
    const blue = [123, 165, 218];
    this.log(`${this._dim('time')} ${this._rgb(blue, duration + 's')}`);
  }

  async ask(question) {
    return prompt.ask(this, question);
  }

  async confirm(question) {
    return prompt.confirm(this, question);
  }

  cleanup() {
    this._abortActiveSpinner();
  }
}

export const ui = new UIEngine();
