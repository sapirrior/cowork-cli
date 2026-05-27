import { createInterface } from 'node:readline';

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const COLORS = {
  main:    [123, 165, 218],  // #7BA5DA – blue    (chrome, glyphs, parens)
  tool:    [242, 207, 110],  // #F2CF6E – amber   (label / tool name)
  data:    [194, 198, 197],  // #C2C6C5 – silver  (args, data)
  success: [122, 195, 145],  // #7AC391 – green   (● on stop)
  error:   [224, 112, 112],  // #E07070 – red     (● on fail)
  dim:     [ 96,  96,  96],  // #606060 – grey    (dim annotations)
  header:  [163, 122, 204],  // #A37ACC – purple  (● header dot)
};

const THOUGHTS = [
  'Thinking...', 'Brewing...',      'Grooming...',     'Analyzing...',
  'Investigating...', 'Processing...', 'Synthesizing...', 'Exploring...',
  'Mapping...',  'Reasoning...',    'Meditating...',   'Computing...',
  'Crawling...', 'Scanning...',
];

const GLYPHS = {
  header:  '●',
  dot:     '●',   // color-coded: green = stop, red = fail
  ask:     '◇',
  input:   '>',
  spinner: ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'],
};

// ---------------------------------------------------------------------------
// State constants
// ---------------------------------------------------------------------------

const STATE = Object.freeze({
  IDLE:     'IDLE',
  SPINNING: 'SPINNING',
  THINKING: 'THINKING',
  ASKING:   'ASKING',
});

// ---------------------------------------------------------------------------
// UIEngine
// ---------------------------------------------------------------------------

/**
 * UIEngine – State-Based Reactive Terminal Interface.
 *
 * State machine:
 *
 *   IDLE ──start()──▶ SPINNING
 *   IDLE ──think()──▶ THINKING
 *   IDLE ──ask()───▶  ASKING
 *   SPINNING/THINKING ──stop()──▶ IDLE   (● green)
 *   SPINNING/THINKING ──fail()──▶ IDLE   (● red)
 *   ASKING ──resolve/cancel──▶ IDLE
 *
 * Reactive renderer:
 *   _vdom tracks { frame, label, data } currently on screen.
 *   Each tick diffs next values against _vdom and calls only the
 *   narrowest patch operation needed — no full-line clears on animation ticks.
 *
 *   Patch cost per tick (SPINNING, no update):
 *     \r + 1 colored char  ≈ 22 bytes  (no clear)
 *
 * Public API:
 *   ui.start(label, data?)   → SPINNING
 *   ui.think()               → THINKING (rotating thought words)
 *   ui.update(data)          – swap data field in-place
 *   ui.stop(msg?)            → IDLE  (● green)
 *   ui.fail(msg?)            → IDLE  (● red)
 *   ui.ask(question)         → Promise<string>
 *   ui.log(text)             – safe from any state
 *   ui.header(title)         – safe from any state
 *   ui.footer(secs)          – safe from any state
 *   ui.cleanup()             – restore cursor, safe from any state
 *   ui.state                 – read-only current state string
 */
export class UIEngine {
  constructor() {
    this._stream     = process.stdout;
    this._state      = STATE.IDLE;
    this._timer      = null;
    this._frameIdx   = 0;
    this._thoughtIdx = 0;

    // What the spinner is currently representing
    this._ctx = { label: '', data: '' };

    // What is actually rendered on the terminal right now
    // null = field not yet on screen / cleared
    this._vdom = { frame: null, label: null, data: null };

    // Re-render on resize — layout metrics change with terminal width
    this._stream.on('resize', () => {
      if (this._state === STATE.SPINNING || this._state === STATE.THINKING) {
        this._paint(); // full repaint: truncation bounds changed
      }
    });
  }

  // -------------------------------------------------------------------------
  // Public state getter
  // -------------------------------------------------------------------------

  /** @returns {'IDLE'|'SPINNING'|'THINKING'|'ASKING'} */
  get state() { return this._state; }

  // -------------------------------------------------------------------------
  // ANSI helpers (pure, no side-effects)
  // -------------------------------------------------------------------------

  _rgb([r, g, b], text) { return `\x1b[38;2;${r};${g};${b}m${text}\x1b[0m`; }
  _bold(text)  { return `\x1b[1m${text}\x1b[0m`; }
  _dim(text)   { return `\x1b[2m${text}\x1b[0m`; }

  // -------------------------------------------------------------------------
  // Terminal control
  // -------------------------------------------------------------------------

  _w(str)        { this._stream.write(str); }
  _clearLine()   { this._w('\r\x1b[K'); }
  _hideCursor()  { this._w('\x1b[?25l'); }
  _showCursor()  { this._w('\x1b[?25h'); }
  _moveUp(n = 1) { this._w(`\x1b[${n}A`); }
  /** Move cursor to visible column n (0-indexed). */
  _toCol(n)      { this._w(n > 0 ? `\r\x1b[${n}C` : '\r'); }

  // -------------------------------------------------------------------------
  // Layout helpers
  // -------------------------------------------------------------------------

  /**
   * How many visible chars are available for the data field,
   * given the current terminal width and label length.
   *
   * Line layout (visible columns):
   *   frame(1) space(1) label(L) space(1) open(1) data(D) close(1)
   *   total = 5 + L + D   →   D = width - 5 - L - margin(2)
   */
  _availWidth(label) {
    const w = this._stream.columns || 80;
    return Math.max(0, w - 7 - label.length);
  }

  /**
   * Column where '(' starts  =  frame(1) + space(1) + label(L) + space(1)
   *                          =  3 + L
   */
  _parenCol(label) { return 3 + label.length; }

  // -------------------------------------------------------------------------
  // Smart truncation
  // -------------------------------------------------------------------------

  /**
   * Truncate to maxWidth visible chars.
   * Paths: prefer …/parent/file → …/file → …tail.
   * Other: tail-ellipsis.
   */
  _truncate(text, maxWidth) {
    if (!text || text.length <= maxWidth) return text;
    if (maxWidth <= 2) return '…';

    if (text.includes('/')) {
      const parts = text.split('/');
      const file  = parts.pop();
      const par   = parts.pop() || '';

      const wp = `…/${par}/${file}`;
      if (wp.length <= maxWidth) return wp;

      const wf = `…/${file}`;
      if (wf.length <= maxWidth) return wf;

      return `…${file.slice(-(maxWidth - 1))}`;
    }

    return text.slice(0, maxWidth - 1) + '…';
  }

  // -------------------------------------------------------------------------
  // Patch operations — surgical cursor-positioned writes, no full-line clears
  // -------------------------------------------------------------------------

  /**
   * Overwrite only the spinner frame character at col 0.
   * Cost: \r + ~22 bytes of ANSI + 1 char. Rest of line untouched.
   */
  _patchFrame(frame) {
    this._w(`\r${this._rgb(COLORS.main, frame)}`);
    // cursor lands at col 1 — the rest of the line is physically untouched
  }

  /**
   * Overwrite label and everything to the right of it (col 2 onward).
   * Used when label changes (THINKING rotation) or on initial paint for label region.
   * Returns the truncated data string that was written.
   */
  _patchFromLabel(label, data) {
    const td = data ? this._truncate(data, this._availWidth(label)) : '';
    const dataStr = td
      ? ` ${this._rgb(COLORS.main, '(')}${this._rgb(COLORS.data, td)}${this._rgb(COLORS.main, ')')}`
      : '';
    // go to col 2, clear to EOL, write new label + optional data
    this._w(`\r\x1b[2C\x1b[K${this._rgb(COLORS.tool, label)}${dataStr}`);
    return td;
  }

  /**
   * Overwrite only the data field (from the '(' position onward).
   * Used when data changes via update() — label and frame untouched.
   * Returns the truncated data string that was written.
   */
  _patchFromData(label, data) {
    const td = data ? this._truncate(data, this._availWidth(label)) : '';
    const dataStr = td
      ? `${this._rgb(COLORS.main, '(')}${this._rgb(COLORS.data, td)}${this._rgb(COLORS.main, ')')}`
      : '';
    // jump to paren col, clear to EOL, write new data section
    this._toCol(this._parenCol(label));
    this._w(`\x1b[K${dataStr}`);
    return td;
  }

  // -------------------------------------------------------------------------
  // Full repaint — only at state transitions or terminal resize
  // -------------------------------------------------------------------------

  _paint() {
    const { label, data } = this._ctx;
    const frame = GLYPHS.spinner[this._frameIdx];
    const td = data ? this._truncate(data, this._availWidth(label)) : '';
    const dataStr = td
      ? ` ${this._rgb(COLORS.main, '(')}${this._rgb(COLORS.data, td)}${this._rgb(COLORS.main, ')')}`
      : '';

    this._clearLine(); // ← one of the very few places \r\x1b[K appears
    this._w(`${this._rgb(COLORS.main, frame)} ${this._rgb(COLORS.tool, label)}${dataStr}`);

    // Sync virtual DOM to match what's on screen
    this._vdom = { frame, label, data: td };
  }

  // -------------------------------------------------------------------------
  // Animation tick — diffed, minimal writes
  // -------------------------------------------------------------------------

  _tick() {
    this._frameIdx = (this._frameIdx + 1) % GLYPHS.spinner.length;

    const nextFrame = GLYPHS.spinner[this._frameIdx];
    let   nextLabel = this._ctx.label;

    // THINKING: rotate label every 8 ticks  (~800 ms at 100 ms interval)
    if (this._state === STATE.THINKING && this._frameIdx % 8 === 0) {
      this._thoughtIdx = (this._thoughtIdx + 1) % THOUGHTS.length;
      nextLabel = THOUGHTS[this._thoughtIdx];
      this._ctx.label = nextLabel;
    }

    const labelChanged = nextLabel !== this._vdom.label;
    const frameChanged = nextFrame !== this._vdom.frame;

    if (labelChanged) {
      // Repaint from col 2 onward (label + data)
      const td = this._patchFromLabel(nextLabel, this._ctx.data);
      this._vdom.label = nextLabel;
      this._vdom.data  = td; // avail width may have changed with new label length
    }

    if (frameChanged) {
      // Cheapest possible update: 1 char at col 0
      this._patchFrame(nextFrame);
      this._vdom.frame = nextFrame;
    }
  }

  // -------------------------------------------------------------------------
  // Internal transition helpers
  // -------------------------------------------------------------------------

  /**
   * Silently clear the active spinner line and stop the timer.
   * No completion line printed. Used when start()/think() replaces
   * an existing spinner, or on cleanup().
   */
  _abort() {
    if (this._state === STATE.IDLE || this._state === STATE.ASKING) return;
    clearInterval(this._timer);
    this._timer = null;
    this._clearLine();
    this._vdom  = { frame: null, label: null, data: null };
    this._state = STATE.IDLE;
    this._showCursor();
  }

  /**
   * Stop the spinner and commit a styled completion line.
   * @param {string|undefined} msg   - override data shown in parens
   * @param {number[]}         color - COLORS.success or COLORS.error
   */
  _commit(msg, color) {
    if (this._state === STATE.IDLE || this._state === STATE.ASKING) return;
    clearInterval(this._timer);
    this._timer = null;
    this._clearLine();

    const label = this._state === STATE.THINKING ? 'Thought' : this._ctx.label;
    const raw   = msg !== undefined ? msg : this._ctx.data;
    const td    = raw ? this._truncate(raw, this._availWidth(label)) : '';
    const dataStr = td
      ? ` ${this._rgb(COLORS.main, '(')}${this._rgb(COLORS.data, td)}${this._rgb(COLORS.main, ')')}`
      : '';

    this._w(`${this._rgb(color, GLYPHS.dot)} ${this._rgb(COLORS.tool, label)}${dataStr}\n`);
    this._vdom  = { frame: null, label: null, data: null };
    this._state = STATE.IDLE;
    this._showCursor();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Enter SPINNING state with a fixed label.
   * Silently replaces any active spinner.
   */
  start(label, data = '') {
    this._abort();
    this._ctx        = { label, data };
    this._frameIdx   = 0;
    this._state      = STATE.SPINNING;
    this._hideCursor();
    this._paint();
    this._timer = setInterval(() => this._tick(), 100);
  }

  /**
   * Enter THINKING state — label rotates through THOUGHTS words.
   * Silently replaces any active spinner.
   */
  think() {
    this._abort();
    this._thoughtIdx = 0;
    this._ctx        = { label: THOUGHTS[0], data: '' };
    this._frameIdx   = 0;
    this._state      = STATE.THINKING;
    this._hideCursor();
    this._paint();
    this._timer = setInterval(() => this._tick(), 100);
  }

  /**
   * Swap the data field of a running spinner without stopping it.
   * Only writes to terminal if the (truncated) value actually changed.
   */
  update(data) {
    if (this._state !== STATE.SPINNING && this._state !== STATE.THINKING) return;
    const td = data ? this._truncate(data, this._availWidth(this._ctx.label)) : '';
    if (td === this._vdom.data) return; // nothing visible changed
    this._ctx.data  = data;
    const written   = this._patchFromData(this._ctx.label, data);
    this._vdom.data = written;
  }

  /**
   * Finish the spinner with a green ● and an optional final message.
   * SPINNING/THINKING → IDLE.
   */
  stop(msg) { this._commit(msg, COLORS.success); }

  /**
   * Finish the spinner with a red ● and an optional final message.
   * SPINNING/THINKING → IDLE.
   */
  fail(msg) { this._commit(msg, COLORS.error); }

  /**
   * Print a line of text without disturbing the active spinner.
   * Safe from any state.
   * @param {string} text  Pre-formatted string (may contain ANSI codes).
   */
  log(text) {
    if (this._state === STATE.SPINNING || this._state === STATE.THINKING) {
      this._clearLine();
      this._w(`${text}\n`);
      this._paint(); // restore spinner below
    } else {
      this._w(`${text}\n`);
    }
  }

  /**
   * Print a ● header line. Safe from any state via log().
   */
  header(title) {
    this.log(
      `${this._rgb(COLORS.header, GLYPHS.header)} ${this._rgb(COLORS.main, this._bold(title.toLowerCase()))}`
    );
  }

  /**
   * Prompt the user for input with a styled ◇ Question prompt.
   * Auto-stops any active spinner first.
   * Resolves with the trimmed answer; rejects { cancelled: true } on SIGINT.
   * Re-prompts silently on empty input.
   * @param {string} question
   * @returns {Promise<string>}
   */
  ask(question) {
    this._abort();

    if (!process.stdin.isTTY) {
      return Promise.reject(new Error('stdin is not a TTY'));
    }

    this._state = STATE.ASKING;

    return new Promise((resolve, reject) => {
      const rl = createInterface({ input: process.stdin, output: this._stream });

      const w      = this._stream.columns || 80;
      const avail  = Math.max(0, w - 14); // ◇ Ask ( ... )
      const truncQ = this._truncate(question, avail);

      this._w(
        `${this._rgb(COLORS.main, GLYPHS.ask)} ` +
        `${this._rgb(COLORS.tool, 'Ask')} ` +
        `${this._rgb(COLORS.main, '(')}${this._rgb(COLORS.data, truncQ)}${this._rgb(COLORS.main, ')')}\n`
      );

      const prompt = `${this._rgb(COLORS.main, this._bold(GLYPHS.input))} `;

      rl.on('SIGINT', () => {
        rl.close();
        this._showCursor();
        this._state = STATE.IDLE;
        reject({ cancelled: true });
      });

      const doAsk = () => {
        rl.question(prompt, (raw) => {
          const ans = raw.trim();
          if (!ans) {
            this._moveUp(1);
            this._clearLine();
            doAsk();
            return;
          }
          rl.close();
          this._moveUp(1);
          this._clearLine();
          this._w(`${this._rgb(COLORS.main, this._bold(GLYPHS.input))} ${ans}\n`);
          this._state = STATE.IDLE;
          resolve(ans);
        });
      };

      doAsk();
    });
  }

  /**
   * Prompt the user for a yes/no confirmation with an interactive toggle.
   *
   * Behaviour:
   *  • Renders a `[ Yes ]  No` toggle selector.
   *  • Use Arrow Keys, Tab, or Space to toggle. Y/N to select directly.
   *  • Enter to confirm.
   *  • Ctrl+C (SIGINT) → resolves { confirmed: false, dismissed: true }.
   *  • Answer is echoed in green (yes) or red (no).
   *
   * @param {string} question
   * @returns {Promise<{ confirmed: boolean, dismissed?: true }>}
   */
  confirm(question) {
    this._abort();

    if (!process.stdin.isTTY) {
      return Promise.resolve({ confirmed: false, dismissed: true });
    }

    this._state = STATE.ASKING;

    return new Promise((resolve) => {
      const w      = this._stream.columns || 80;
      const avail  = Math.max(0, w - 14);
      const truncQ = this._truncate(question, avail);

      this._w(
        `${this._rgb(COLORS.main, GLYPHS.ask)} ` +
        `${this._rgb(COLORS.tool, 'Ask')} ` +
        `${this._rgb(COLORS.main, '(')}${this._rgb(COLORS.data, truncQ)}${this._rgb(COLORS.main, ')')}\n`
      );

      let selectedYes = true;

      const renderToggle = () => {
        this._clearLine();
        const yesLabel = selectedYes ? this._rgb(COLORS.main, this._bold('[ Yes ]')) : this._dim('  Yes  ');
        const noLabel  = !selectedYes ? this._rgb(COLORS.main, this._bold('[ No ]')) : this._dim('  No  ');
        this._w(`${this._rgb(COLORS.main, this._bold(GLYPHS.input))}  ${yesLabel}  ${noLabel}`);
      };

      this._hideCursor();
      renderToggle();

      const onData = (data) => {
        const str = data.toString();
        
        // Ctrl+C
        if (str === '\u0003') {
          cleanup();
          this._clearLine();
          this._w(`${this._rgb(COLORS.main, this._bold(GLYPHS.input))} ${this._dim('cancelled')}\n`);
          this._showCursor();
          this._state = STATE.IDLE;
          resolve({ confirmed: false, dismissed: true });
          return;
        }

        // Enter
        if (str === '\r' || str === '\n') {
          cleanup();
          this._clearLine();
          const finalColor = selectedYes ? COLORS.success : COLORS.error;
          const finalStr   = selectedYes ? 'yes' : 'no';
          this._w(`${this._rgb(COLORS.main, this._bold(GLYPHS.input))} ${this._rgb(finalColor, finalStr)}\n`);
          this._showCursor();
          this._state = STATE.IDLE;
          resolve({ confirmed: selectedYes });
          return;
        }

        // Toggle keys (Left, Right, Up, Down, Tab, Space)
        if (str === '\u001b[D' || str === '\u001b[C' || str === '\u001b[A' || str === '\u001b[B' || str === '\t' || str === ' ') {
          selectedYes = !selectedYes;
          renderToggle();
        } else if (str.toLowerCase() === 'y') {
          selectedYes = true;
          renderToggle();
        } else if (str.toLowerCase() === 'n') {
          selectedYes = false;
          renderToggle();
        }
      };

      const cleanup = () => {
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        process.stdin.off('data', onData);
        process.stdin.pause();
      };

      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();
      process.stdin.on('data', onData);
    });
  }


  footer(duration) {
    this.log(`${this._dim('time')} ${this._rgb(COLORS.main, duration + 's')}`);
  }

  /**
   * Restore cursor and stop timer. Safe to call from SIGINT / uncaughtException.
   */
  cleanup() {
    this._abort();
    this._showCursor();
  }
}

// Singleton — import { ui } wherever you need the terminal interface.
export const ui = new UIEngine();
