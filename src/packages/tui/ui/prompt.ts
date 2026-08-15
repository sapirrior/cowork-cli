import InputBox from '../engine/components/InputBox.js';
import ToolConfirmationCard from '../engine/components/ToolConfirmationCard.js';
import FollowUpBox from '../engine/components/FollowUpBox.js';
import { formatPromptQuery } from './outputFormatter.js';
import { rgb, dim, bold } from './format.js';
import { THEME } from '../theme.js';

interface UIInstance {
  _abortActiveSpinner(): void;
  engine: any;
}

let activePromptLock = false;

export function isPromptActive(): boolean {
  return activePromptLock;
}

/**
 * Set the prompt active state both locally and on globalThis so TerminalEngine's
 * scroll handler knows to defer Up/Down arrow handling to the prompt.
 */
function setPromptActive(val: boolean): void {
  activePromptLock = val;
  (globalThis as any).__promptActive = val;
}

// ─── Word-navigation helpers ──────────────────────────────────────────────────

function wordRight(buf: string, idx: number): number {
  while (idx < buf.length && buf[idx] !== ' ') idx++;
  while (idx < buf.length && buf[idx] === ' ') idx++;
  return idx;
}

function wordLeft(buf: string, idx: number): number {
  while (idx > 0 && buf[idx - 1] === ' ') idx--;
  while (idx > 0 && buf[idx - 1] !== ' ') idx--;
  return idx;
}

// ─── Shared key handler ───────────────────────────────────────────────────────

interface InputState {
  buffer: string;
  cursorIndex: number;
}

type UpdateCallback = (state: InputState) => void;

/**
 * Handles a raw terminal keypress for a text input field.
 * Returns 'submit' when the user presses Enter, 'cancel' on Ctrl+C,
 * 'consumed' for all other handled keys, or 'unhandled' for unknown input.
 */
function handleInputKey(
  str: string,
  state: InputState,
  onUpdate: UpdateCallback
): 'submit' | 'cancel' | 'consumed' | 'unhandled' {
  let { buffer, cursorIndex } = state;

  // ── Cancel ────────────────────────────────────────────────────────
  if (str === '\u0003') return 'cancel';

  // ── Submit ────────────────────────────────────────────────────────
  if (str === '\r' || str === '\n') return 'submit';

  // ── Arrow keys: character navigation ─────────────────────────────
  if (str === '\u001b[D') {
    cursorIndex = Math.max(0, cursorIndex - 1);
    onUpdate({ buffer, cursorIndex });
    return 'consumed';
  }
  if (str === '\u001b[C') {
    cursorIndex = Math.min(buffer.length, cursorIndex + 1);
    onUpdate({ buffer, cursorIndex });
    return 'consumed';
  }

  // ── Word navigation (Ctrl+Left / Ctrl+Right / Alt+b / Alt+f) ─────
  if (str === '\u001b[1;5D' || str === '\u001bb') {
    cursorIndex = wordLeft(buffer, cursorIndex);
    onUpdate({ buffer, cursorIndex });
    return 'consumed';
  }
  if (str === '\u001b[1;5C' || str === '\u001bf') {
    cursorIndex = wordRight(buffer, cursorIndex);
    onUpdate({ buffer, cursorIndex });
    return 'consumed';
  }

  // ── Home / End ────────────────────────────────────────────────────
  if (str === '\u001b[H' || str === '\u001bOH' || str === '\u001b[1~') {
    cursorIndex = 0;
    onUpdate({ buffer, cursorIndex });
    return 'consumed';
  }
  if (str === '\u001b[F' || str === '\u001bOF' || str === '\u001b[4~') {
    cursorIndex = buffer.length;
    onUpdate({ buffer, cursorIndex });
    return 'consumed';
  }

  // ── Backspace ─────────────────────────────────────────────────────
  if (str === '\u007f' || str === '\b') {
    if (cursorIndex > 0) {
      buffer = buffer.slice(0, cursorIndex - 1) + buffer.slice(cursorIndex);
      cursorIndex--;
      onUpdate({ buffer, cursorIndex });
    }
    return 'consumed';
  }

  // ── Ctrl+W / Ctrl+Backspace — delete word to the left ────────────
  if (str === '\u0017') {
    const newIdx = wordLeft(buffer, cursorIndex);
    buffer = buffer.slice(0, newIdx) + buffer.slice(cursorIndex);
    cursorIndex = newIdx;
    onUpdate({ buffer, cursorIndex });
    return 'consumed';
  }

  // ── Delete key ────────────────────────────────────────────────────
  if (str === '\u001b[3~') {
    if (cursorIndex < buffer.length) {
      buffer = buffer.slice(0, cursorIndex) + buffer.slice(cursorIndex + 1);
      onUpdate({ buffer, cursorIndex });
    }
    return 'consumed';
  }

  // ── Drop remaining unhandled escape sequences ─────────────────────
  if (str.startsWith('\u001b')) return 'consumed';

  // ── Printable characters ──────────────────────────────────────────
  const cleanStr = str.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  if (cleanStr.length > 0) {
    buffer = buffer.slice(0, cursorIndex) + cleanStr + buffer.slice(cursorIndex);
    cursorIndex += cleanStr.length;
    onUpdate({ buffer, cursorIndex });
    return 'consumed';
  }

  return 'unhandled';
}

// ─── Standard label resolver ──────────────────────────────────────────────────

function getToolLabel(toolName: string, action?: string): string {
  const clean = toolName.toLowerCase();
  if (clean.includes('write'))                             return 'writing file';
  if (clean.includes('edit'))                              return 'editing file';
  if (clean.includes('delete'))                            return 'deleting file';
  if (clean.includes('command') || clean.includes('exec')) return 'running command';
  return action || toolName;
}

// ─── ask() ───────────────────────────────────────────────────────────────────

export async function ask(uiInstance: UIInstance, question: string): Promise<string> {
  if (activePromptLock) {
    throw new Error('Another interactive prompt is already active.');
  }
  setPromptActive(true);
  uiInstance._abortActiveSpinner();
  if (!process.stdin.isTTY) {
    setPromptActive(false);
    throw new Error('stdin is not a TTY');
  }

  const inputComp = new InputBox({ label: question, currentVal: '' });
  uiInstance.engine.mount(inputComp, { keepCursorVisible: true });

  const inputState: InputState = { buffer: '', cursorIndex: 0 };
  let onData: (chunk: Buffer) => void;
  let cleanup: () => void;

  const promise = new Promise<string>((resolve, reject) => {
    onData = (chunk: Buffer) => {
      const str = chunk.toString();

      const result = handleInputKey(str, inputState, (next) => {
        inputState.buffer      = next.buffer;
        inputState.cursorIndex = next.cursorIndex;
        inputComp.setState({ currentVal: next.buffer, cursorIndex: next.cursorIndex });
      });

      if (result === 'cancel') {
        cleanup();
        uiInstance.engine.unmountAll();
        uiInstance.engine.commit('raw', [
          `  ${rgb(THEME.tool, 'Ask:')} ${rgb(THEME.data, question)}`,
          `  ${rgb(THEME.error, 'cancelled')}`
        ]);
        reject({ cancelled: true });
        return;
      }
      if (result === 'submit') {
        cleanup();
        uiInstance.engine.unmountAll();
        uiInstance.engine.commit('raw', [
          `  ${rgb(THEME.tool, 'Ask:')} ${rgb(THEME.data, question)}`,
          `  ${inputState.buffer}`
        ]);
        resolve(inputState.buffer.trim());
      }
    };

    // TerminalEngine owns rawMode — we do NOT toggle it here.
    // We just add our listener on top of the engine's existing listener.
    cleanup = () => { process.stdin.off('data', onData); };

    process.stdin.ref();
    process.stdin.resume();
    process.stdin.on('data', onData);
  });

  const exitCleanup = () => { if (cleanup) cleanup(); };
  process.once('exit', exitCleanup);

  return promise.finally(() => {
    setPromptActive(false);
    process.off('exit', exitCleanup);
  });
}

// ─── askFollowUp() ────────────────────────────────────────────────────────────

export async function askFollowUp(uiInstance: UIInstance): Promise<string> {
  if (activePromptLock) {
    throw new Error('Another interactive prompt is already active.');
  }
  setPromptActive(true);
  uiInstance._abortActiveSpinner();
  if (!process.stdin.isTTY) {
    setPromptActive(false);
    throw new Error('stdin is not a TTY');
  }

  const inputComp = new FollowUpBox({ currentVal: '' });
  uiInstance.engine.mount(inputComp, { keepCursorVisible: true });

  const inputState: InputState = { buffer: '', cursorIndex: 0 };
  let onData: (chunk: Buffer) => void;
  let cleanup: () => void;

  const promise = new Promise<string>((resolve, reject) => {
    onData = (chunk: Buffer) => {
      const str = chunk.toString();

      const result = handleInputKey(str, inputState, (next) => {
        inputState.buffer      = next.buffer;
        inputState.cursorIndex = next.cursorIndex;
        inputComp.setState({ currentVal: next.buffer, cursorIndex: next.cursorIndex });
      });

      if (result === 'cancel') {
        cleanup();
        uiInstance.engine.unmountAll();
        uiInstance.engine.commit('raw', [
          `> ${rgb(THEME.error, 'cancelled')}`
        ]);
        reject({ cancelled: true });
        return;
      }
      if (result === 'submit') {
        cleanup();
        uiInstance.engine.unmountAll();
        const formatted = formatPromptQuery(inputState.buffer);
        uiInstance.engine.commit('raw', formatted.split('\n'));
        resolve(inputState.buffer.trim());
      }
    };

    // TerminalEngine owns rawMode — we do NOT toggle it here.
    cleanup = () => { process.stdin.off('data', onData); };

    process.stdin.ref();
    process.stdin.resume();
    process.stdin.on('data', onData);
  });

  const exitCleanup = () => { if (cleanup) cleanup(); };
  process.once('exit', exitCleanup);

  return promise.finally(() => {
    setPromptActive(false);
    process.off('exit', exitCleanup);
  });
}

// ─── confirmTool() ────────────────────────────────────────────────────────────

export interface ToolConfirmOptions {
  toolName?: string;
  action?: string;
  target?: string;
  details?: string[];
}

export async function confirmTool(
  uiInstance: UIInstance,
  options: ToolConfirmOptions
): Promise<{ confirmed: boolean; dismissed?: boolean }> {
  if (activePromptLock) {
    throw new Error('Another interactive prompt is already active.');
  }
  setPromptActive(true);

  uiInstance._abortActiveSpinner();
  if (!process.stdin.isTTY) {
    setPromptActive(false);
    return { confirmed: false, dismissed: true };
  }

  const cardComp = new ToolConfirmationCard({
    toolName:    options.toolName  || 'tool',
    action:      options.action    || 'confirm action',
    target:      options.target    || '',
    details:     options.details   || [],
    selectedIdx: 0,
    expanded:    false,
  });

  uiInstance.engine.mount(cardComp);

  let onData: (chunk: Buffer) => void;
  let cleanup: () => void;

  const commitResult = (isAllowed: boolean) => {
    uiInstance.engine.unmountAll();
    const labelStr   = rgb(THEME.tool, getToolLabel(options.toolName || 'tool', options.action));
    const targetText = options.target || options.action || '';
    const dataStr    = targetText
      ? ` ${rgb(THEME.main, '(')}${rgb(THEME.data, targetText)}${rgb(THEME.main, ')')}`
      : '';

    if (isAllowed) {
      const bullet = rgb(THEME.success, '●');
      uiInstance.engine.commit('tool-result', [`${bullet} ${labelStr}${dataStr}`]);
    } else {
      const bullet = rgb(THEME.error, '●');
      const deniedSuffix = ` ${rgb(THEME.main, '(')}${rgb(THEME.error, 'denied')}${rgb(THEME.main, ')')}`;
      uiInstance.engine.commit('tool-result', [`${bullet} ${labelStr}${dataStr}${deniedSuffix}`]);
    }
  };

  const promise = new Promise<{ confirmed: boolean; dismissed?: boolean }>((resolve) => {
    let selectedYes = true;
    const promptStartTime = Date.now();

    onData = (chunk: Buffer) => {
      const str = chunk.toString();

      // Guard against accidental buffered newline (< 150ms)
      if ((str === '\r' || str === '\n') && Date.now() - promptStartTime < 150) return;

      if (str === '\u0003') {
        cleanup();
        commitResult(false);
        resolve({ confirmed: false, dismissed: true });
        return;
      }
      if (str === '\u0019' || str.toLowerCase() === 'y') {
        cleanup();
        commitResult(true);
        resolve({ confirmed: true });
        return;
      }
      if (str === '\u000e' || str.toLowerCase() === 'n' || str === '\u001b') {
        cleanup();
        commitResult(false);
        resolve({ confirmed: false });
        return;
      }
      if (str === '\t' || str.toLowerCase() === 'e' || str === '\u0005') {
        cardComp.setState({ expanded: !cardComp.state.expanded });
        return;
      }
      if (
        str === '\u001b[D' || str === '\u001b[C' ||
        str === '\u001b[A' || str === '\u001b[B' || str === ' '
      ) {
        selectedYes = !selectedYes;
        cardComp.setState({ selectedIdx: selectedYes ? 0 : 1 });
        return;
      }
      if (str === '\r' || str === '\n') {
        cleanup();
        commitResult(selectedYes);
        resolve({ confirmed: selectedYes });
        return;
      }
    };

    // TerminalEngine owns rawMode — we do NOT toggle it here.
    cleanup = () => { process.stdin.off('data', onData); };

    process.stdin.ref();
    process.stdin.resume();
    process.stdin.on('data', onData);
  });

  const exitCleanup = () => { if (cleanup) cleanup(); };
  process.once('exit', exitCleanup);

  return promise.finally(() => {
    setPromptActive(false);
    process.off('exit', exitCleanup);
  });
}

// ─── confirm() ───────────────────────────────────────────────────────────────

export async function confirm(
  uiInstance: UIInstance,
  question: string,
  options?: ToolConfirmOptions
): Promise<{ confirmed: boolean; dismissed?: boolean }> {
  if (options) return confirmTool(uiInstance, options);

  const lines     = question.split('\n');
  const firstLine = lines[0] || '';

  if (firstLine.includes('Overwrite file:') || firstLine.includes('Create file:')) {
    const action = firstLine.startsWith('Overwrite') ? 'Overwrite file' : 'Create file';
    const target = firstLine.split(':')[1]?.trim().replace(/\?$/, '') || '';
    return confirmTool(uiInstance, { toolName: 'writeFile', action, target });
  }
  if (firstLine.includes('Apply edit to')) {
    const target = firstLine.replace(/^Apply edit to\s+/, '').replace(/\?$/, '');
    return confirmTool(uiInstance, { toolName: 'editFile', action: 'Apply string replacement', target });
  }
  if (firstLine.includes('Permanently delete file:')) {
    const target = firstLine.split(':')[1]?.trim().replace(/\?$/, '') || '';
    return confirmTool(uiInstance, { toolName: 'deleteFile', action: 'Permanently delete file', target });
  }
  if (firstLine.includes('Run command') || firstLine.includes('Run:')) {
    const commandText = lines.slice(1).join('\n').trim() || firstLine;
    return confirmTool(uiInstance, {
      toolName: 'executeCommand',
      action:   'Run bash shell command',
      target:   firstLine,
      details:  [commandText],
    });
  }
  return confirmTool(uiInstance, { toolName: 'confirm', action: question });
}
