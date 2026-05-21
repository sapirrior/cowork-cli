import { formatSecondary } from './logger.js';

/**
 * A minimalist terminal spinner that uses text-based dot animations.
 */
export class Spinner {
  constructor() {
    this.frames = ['', '.', '..', '...'];
    this.interval = null;
    this.currentFrame = 0;
    this.text = '';
    this.isSpinning = false;
  }

  /**
   * Starts the spinner with a base message.
   */
  start(text) {
    if (this.isSpinning) this.stop(true);
    process.stdout.write('\x1b[?25l'); // Hide cursor
    this.text = text;
    this.isSpinning = true;
    this.render();
    this.interval = setInterval(() => {
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
      this.render();
    }, 400); // Slower interval for dot cycle
  }

  /**
   * Updates the base text message.
   */
  update(text) {
    this.text = text;
    if (this.isSpinning) this.render();
  }

  /**
   * Stops the spinner and restores the cursor.
   * @param {boolean} clear If true, clears the entire line.
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
      process.stdout.write('\n'); 
    }
    process.stdout.write('\x1b[?25h'); // Show cursor
    this.currentFrame = 0;
  }

  /**
   * @private
   */
  render() {
    const dots = this.frames[this.currentFrame];
    // Renders the text followed by the cycling dots
    process.stdout.write(`\r\x1b[K${formatSecondary(`${this.text}${dots}`)}`);
  }
}

export const spinner = new Spinner();
