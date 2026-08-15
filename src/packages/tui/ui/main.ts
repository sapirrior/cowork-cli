import TerminalEngine from '../engine/TerminalEngine.js';
import * as format from './format.js';
import * as spinner from './spinner.js';
import * as prompt from './prompt.js';
import Spinner from '../engine/components/Spinner.js';
import { THEME } from '../theme.js';

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
    const lines = text.split('\n');
    if (lines.length > 1 && lines[lines.length - 1] === '') {
      lines.pop();
    }
    this.engine.commit('log', lines);
  }

  logo(lines: string[]): void {
    this.engine.commit('logo', lines);
  }

  prompt(text: string): void {
    const lines = text.split('\n');
    if (lines.length > 1 && lines[lines.length - 1] === '') {
      lines.pop();
    }
    this.engine.commit('prompt', lines);
  }

  header(title: string): void {
    this.log(`${this._rgb(THEME.header, '●')} ${this._rgb(THEME.main, this._bold(title.toLowerCase()))}`);
  }

  footer(duration: string | number): void {
    this.log(`${this._dim('time')} ${this._rgb(THEME.main, duration + 's')}`);
  }

  async ask(question: string): Promise<string> {
    return prompt.ask(this, question);
  }

  async askFollowUp(): Promise<string> {
    return prompt.askFollowUp(this);
  }

  async confirm(question: string, options?: prompt.ToolConfirmOptions): Promise<{ confirmed: boolean; dismissed?: boolean }> {
    return prompt.confirm(this, question, options);
  }

  async confirmTool(options: prompt.ToolConfirmOptions): Promise<{ confirmed: boolean; dismissed?: boolean }> {
    return prompt.confirmTool(this, options);
  }

  async waitForExit(): Promise<'exit' | 'followup'> {
    if (!process.stdin.isTTY) return 'exit';

    this.log('');
    this.log(format.dim('(q to exit · f for follow-up · k/j scroll · g/G top/bottom · Ctrl+U/D half page)'));

    return new Promise<'exit' | 'followup'>((resolve) => {
      const onData = (chunk: Buffer) => {
        const str = chunk.toString();

        if (str.toLowerCase() === 'q' || str === '\u0003') {
          cleanup();
          resolve('exit');
        } else if (str.toLowerCase() === 'f' || str === '\u0006') {
          cleanup();
          resolve('followup');
        }
      };

      // TerminalEngine owns rawMode — don't toggle it here.
      const cleanup = () => { process.stdin.off('data', onData); };

      process.stdin.ref();
      process.stdin.resume();
      process.stdin.on('data', onData);
    });
  }

  async cleanup(): Promise<void> {
    this._abortActiveSpinner();
    await this.engine.flushHistoryToPrimaryScreen();
  }
}

export const ui = new UIEngine();
(globalThis as any).__tui_log = (text: string) => ui.log(text);
export type { UIEngine };
