import TerminalEngine from '../engine/TerminalEngine.js';
import * as format from './format.js';
import * as spinner from './spinner.js';
import * as prompt from './prompt.js';
import Spinner from '../engine/components/Spinner.js';

class UIEngine {
  engine: TerminalEngine;
  spinnerComponent: Spinner | null;

  constructor() {
    this.engine = new TerminalEngine();
    this.spinnerComponent = null;
  }

  _rgb(rgbArr: [number, number, number], text: string): string { return format.rgb(rgbArr, text); }
  _bold(text: string): string { return format.bold(text); }
  _dim(text: string): string { return format.dim(text); }

  start(label: string, data: string = ''): void { spinner.start(this, label, data); }
  think(): void { spinner.think(this); }
  update(data: string): void { spinner.update(this, data); }
  stop(msg?: string): void { spinner.stop(this, msg); }
  fail(msg?: string): void { spinner.fail(this, msg); }
  _abortActiveSpinner(): void { spinner.abortActiveSpinner(this); }
  _commitSpinner(msg: string | undefined, color: [number, number, number]): void { spinner.commitSpinner(this, msg, color); }

  log(text: string): void {
    const hasActiveComponents = this.engine.components.length > 0;
    if (hasActiveComponents) {
      this.engine.clear();
      process.stdout.write(text + '\n');
      this.engine.render();
    } else {
      process.stdout.write(text + '\n');
    }
  }

  header(title: string): void {
    const purple: [number, number, number] = [163, 122, 204];
    const blue: [number, number, number] = [123, 165, 218];
    this.log(`${this._rgb(purple, '●')} ${this._rgb(blue, this._bold(title.toLowerCase()))}`);
  }

  footer(duration: string | number): void {
    const blue: [number, number, number] = [123, 165, 218];
    this.log(`${this._dim('time')} ${this._rgb(blue, duration + 's')}`);
  }

  async ask(question: string): Promise<string> {
    return prompt.ask(this, question);
  }

  async confirm(question: string): Promise<{ confirmed: boolean; dismissed?: boolean }> {
    return prompt.confirm(this, question);
  }

  cleanup(): void {
    this._abortActiveSpinner();
  }
}

export const ui = new UIEngine();
export type { UIEngine };
