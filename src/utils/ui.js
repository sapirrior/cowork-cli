import { formatSecondary } from './logger.js';

/**
 * A simple terminal spinner for "thinking" animations.
 */
export class Spinner {
  constructor() {
    this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.interval = null;
    this.currentFrame = 0;
    this.text = '';
    this.isSpinning = false;
  }

  /**
   * Starts the spinner with a message.
   * @param {string} text The message to display next to the spinner.
   */
  start(text) {
    if (this.isSpinning) this.stop(true);
    process.stdout.write('\x1b[?25l'); // Hide cursor
    this.text = text;
    this.isSpinning = true;
    this.render();
    this.interval = setInterval(() => {
      this.render();
    }, 80);
  }

  /**
   * Updates the text message without restarting the spinner.
   * @param {string} text New message.
   */
  update(text) {
    this.text = text;
    if (this.isSpinning) this.render();
  }

  /**
   * Stops the spinner and restores the cursor.
   * @param {boolean} clear If true, clears the spinner line. If false, moves to the next line.
   */
  stop(clear = true) {
    if (!this.isSpinning) {
      process.stdout.write('\x1b[?25h'); // Ensure cursor is shown
      return;
    }
    clearInterval(this.interval);
    this.isSpinning = false;
    if (clear) {
      process.stdout.write('\r\x1b[K'); // Clear entire line
    } else {
      process.stdout.write('\n'); // Stay on the current text and move down
    }
    process.stdout.write('\x1b[?25h'); // Show cursor
  }

  /**
   * @private
   */
  render() {
    const frame = this.frames[this.currentFrame];
    process.stdout.write(`\r${formatSecondary(`${frame} ${this.text}`)}`);
    this.currentFrame = (this.currentFrame + 1) % this.frames.length;
  }
}

export const spinner = new Spinner();
