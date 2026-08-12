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
 * Standard tool label resolver matching Sonnet tool conventions.
 */
function getToolLabel(toolName: string, action?: string): string {
  const clean = toolName.toLowerCase();
  if (clean.includes('write'))   return 'writing file';
  if (clean.includes('edit'))    return 'editing file';
  if (clean.includes('delete'))  return 'deleting file';
  if (clean.includes('command') || clean.includes('exec')) return 'running command';
  return action || toolName;
}

export async function ask(uiInstance: UIInstance, question: string): Promise<string> {
  if (activePromptLock) {
    throw new Error('Another interactive prompt is already active.');
  }
  activePromptLock = true;
  uiInstance._abortActiveSpinner();
  if (!process.stdin.isTTY) {
    activePromptLock = false;
    throw new Error('stdin is not a TTY');
  }

  const inputComp = new InputBox({ label: question, currentVal: '' });
  uiInstance.engine.mount(inputComp, { keepCursorVisible: true });

  let buffer = '';
  let cursorIndex = 0;
  let onData: (chunk: Buffer) => void;
  let cleanup: () => void;

  const promise = new Promise<string>((resolve, reject) => {
    onData = (chunk: Buffer) => {
      const str = chunk.toString();

      if (str === '\u0003') {
        cleanup();
        uiInstance.engine.unmountAll();
        uiInstance.engine.commit('raw', [
          `  ${rgb(THEME.tool, 'Ask:')} ${rgb(THEME.data, question)}`,
          `  ${rgb(THEME.error, 'cancelled')}`
        ]);
        reject({ cancelled: true });
        return;
      }

      // Arrow keys navigation
      if (str === '\u001b[D') { // Left Arrow
        cursorIndex = Math.max(0, cursorIndex - 1);
        inputComp.setState({ cursorIndex });
        return;
      }
      if (str === '\u001b[C') { // Right Arrow
        cursorIndex = Math.min(buffer.length, cursorIndex + 1);
        inputComp.setState({ cursorIndex });
        return;
      }

      // Home & End keys
      if (str === '\u001b[H' || str === '\u001bOH' || str === '\u001b[1~') { // Home
        cursorIndex = 0;
        inputComp.setState({ cursorIndex });
        return;
      }
      if (str === '\u001b[F' || str === '\u001bOF' || str === '\u001b[4~') { // End
        cursorIndex = buffer.length;
        inputComp.setState({ cursorIndex });
        return;
      }

      // Backspace
      if (str === '\u007f' || str === '\b') {
        if (cursorIndex > 0) {
          buffer = buffer.slice(0, cursorIndex - 1) + buffer.slice(cursorIndex);
          cursorIndex--;
          inputComp.setState({ currentVal: buffer, cursorIndex });
        }
        return;
      }

      // Delete key
      if (str === '\u001b[3~') {
        if (cursorIndex < buffer.length) {
          buffer = buffer.slice(0, cursorIndex) + buffer.slice(cursorIndex + 1);
          inputComp.setState({ currentVal: buffer });
        }
        return;
      }

      if (str === '\r' || str === '\n') {
        cleanup();
        uiInstance.engine.unmountAll();
        uiInstance.engine.commit('raw', [
          `  ${rgb(THEME.tool, 'Ask:')} ${rgb(THEME.data, question)}`,
          `  ${buffer}`
        ]);
        resolve(buffer.trim());
        return;
      }

      if (str.startsWith('\u001b')) {
        return;
      }

      const cleanStr = str.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
      if (cleanStr.length > 0) {
        buffer = buffer.slice(0, cursorIndex) + cleanStr + buffer.slice(cursorIndex);
        cursorIndex += cleanStr.length;
        inputComp.setState({ currentVal: buffer, cursorIndex });
      }
    };

    cleanup = () => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.off('data', onData);
    };

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.ref();
    process.stdin.resume();
    process.stdin.on('data', onData);
  });

  const exitCleanup = () => {
    if (cleanup) cleanup();
  };
  process.once('exit', exitCleanup);

  return promise.finally(() => {
    activePromptLock = false;
    process.off('exit', exitCleanup);
  });
}

export async function askFollowUp(uiInstance: UIInstance): Promise<string> {
  if (activePromptLock) {
    throw new Error('Another interactive prompt is already active.');
  }
  activePromptLock = true;
  uiInstance._abortActiveSpinner();
  if (!process.stdin.isTTY) {
    activePromptLock = false;
    throw new Error('stdin is not a TTY');
  }

  const inputComp = new FollowUpBox({ currentVal: '' });
  uiInstance.engine.mount(inputComp, { keepCursorVisible: true });

  let buffer = '';
  let cursorIndex = 0;
  let onData: (chunk: Buffer) => void;
  let cleanup: () => void;

  const promise = new Promise<string>((resolve, reject) => {
    onData = (chunk: Buffer) => {
      const str = chunk.toString();

      if (str === '\u0003') {
        cleanup();
        uiInstance.engine.unmountAll();
        uiInstance.engine.commit('raw', [
          `${THEME.formatMain('❯')} ${rgb(THEME.error, 'cancelled')}`
        ]);
        reject({ cancelled: true });
        return;
      }

      // Arrow keys navigation
      if (str === '\u001b[D') { // Left Arrow
        cursorIndex = Math.max(0, cursorIndex - 1);
        inputComp.setState({ cursorIndex });
        return;
      }
      if (str === '\u001b[C') { // Right Arrow
        cursorIndex = Math.min(buffer.length, cursorIndex + 1);
        inputComp.setState({ cursorIndex });
        return;
      }

      // Home & End keys
      if (str === '\u001b[H' || str === '\u001bOH' || str === '\u001b[1~') { // Home
        cursorIndex = 0;
        inputComp.setState({ cursorIndex });
        return;
      }
      if (str === '\u001b[F' || str === '\u001bOF' || str === '\u001b[4~') { // End
        cursorIndex = buffer.length;
        inputComp.setState({ cursorIndex });
        return;
      }

      // Backspace
      if (str === '\u007f' || str === '\b') {
        if (cursorIndex > 0) {
          buffer = buffer.slice(0, cursorIndex - 1) + buffer.slice(cursorIndex);
          cursorIndex--;
          inputComp.setState({ currentVal: buffer, cursorIndex });
        }
        return;
      }

      // Delete key
      if (str === '\u001b[3~') {
        if (cursorIndex < buffer.length) {
          buffer = buffer.slice(0, cursorIndex) + buffer.slice(cursorIndex + 1);
          inputComp.setState({ currentVal: buffer });
        }
        return;
      }

      if (str === '\r' || str === '\n') {
        cleanup();
        uiInstance.engine.unmountAll();
        
        // Print it as a formatted prompt query
        const formatted = formatPromptQuery(buffer);
        uiInstance.engine.commit('raw', formatted.split('\n'));
        
        resolve(buffer.trim());
        return;
      }

      if (str.startsWith('\u001b')) {
        return;
      }

      const cleanStr = str.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
      if (cleanStr.length > 0) {
        buffer = buffer.slice(0, cursorIndex) + cleanStr + buffer.slice(cursorIndex);
        cursorIndex += cleanStr.length;
        inputComp.setState({ currentVal: buffer, cursorIndex });
      }
    };

    cleanup = () => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.off('data', onData);
    };

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    try {
      process.stdin.read();
    } catch {}
    process.stdin.ref();
    process.stdin.resume();
    process.stdin.on('data', onData);
  });

  const exitCleanup = () => {
    if (cleanup) cleanup();
  };
  process.once('exit', exitCleanup);

  return promise.finally(() => {
    activePromptLock = false;
    process.off('exit', exitCleanup);
  });
}

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
  activePromptLock = true;

  uiInstance._abortActiveSpinner();
  if (!process.stdin.isTTY) {
    activePromptLock = false;
    return { confirmed: false, dismissed: true };
  }

  const cardComp = new ToolConfirmationCard({
    toolName: options.toolName || 'tool',
    action: options.action || 'confirm action',
    target: options.target || '',
    details: options.details || [],
    selectedIdx: 0,
    expanded: false, // Default preview off
  });

  uiInstance.engine.mount(cardComp);

  let onData: (chunk: Buffer) => void;
  let cleanup: () => void;

  const commitResult = (isAllowed: boolean) => {
    uiInstance.engine.unmountAll();
    const labelStr   = rgb(THEME.tool, getToolLabel(options.toolName || 'tool', options.action));
    const targetText = options.target || options.action || '';
    const dataStr    = targetText ? ` ${rgb(THEME.main, '(')}${rgb(THEME.data, targetText)}${rgb(THEME.main, ')')}` : '';

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
      if ((str === '\r' || str === '\n') && Date.now() - promptStartTime < 150) {
        return;
      }

      // SIGINT (Ctrl+C)
      if (str === '\u0003') {
        cleanup();
        commitResult(false);
        resolve({ confirmed: false, dismissed: true });
        return;
      }

      // Ctrl+Y or 'y' / 'Y' -> Confirm Allow immediately
      if (str === '\u0019' || str.toLowerCase() === 'y') {
        cleanup();
        commitResult(true);
        resolve({ confirmed: true });
        return;
      }

      // Ctrl+N or 'n' / 'N' or Esc -> Deny immediately
      if (str === '\u000e' || str.toLowerCase() === 'n' || str === '\u001b') {
        cleanup();
        commitResult(false);
        resolve({ confirmed: false });
        return;
      }

      // Tab or 'e' / 'E' or Ctrl+E -> Toggle Expand / Collapse preview
      if (str === '\t' || str.toLowerCase() === 'e' || str === '\u0005') {
        cardComp.setState({ expanded: !cardComp.state.expanded });
        return;
      }

      // Arrow keys navigation
      if (str === '\u001b[D' || str === '\u001b[C' || str === '\u001b[A' || str === '\u001b[B' || str === ' ') {
        selectedYes = !selectedYes;
        cardComp.setState({ selectedIdx: selectedYes ? 0 : 1 });
        return;
      }

      // Enter / Return -> Execute selected choice
      if (str === '\r' || str === '\n') {
        cleanup();
        commitResult(selectedYes);
        resolve({ confirmed: selectedYes });
        return;
      }
    };

    cleanup = () => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.off('data', onData);
    };

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    try {
      process.stdin.read();
    } catch {}
    process.stdin.ref();
    process.stdin.resume();
    process.stdin.on('data', onData);
  });

  const exitCleanup = () => {
    if (cleanup) cleanup();
  };
  process.once('exit', exitCleanup);

  return promise.finally(() => {
    activePromptLock = false;
    process.off('exit', exitCleanup);
  });
}

export async function confirm(
  uiInstance: UIInstance,
  question: string,
  options?: ToolConfirmOptions
): Promise<{ confirmed: boolean; dismissed?: boolean }> {
  if (options) {
    return confirmTool(uiInstance, options);
  }

  const lines = question.split('\n');
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
    return confirmTool(uiInstance, { toolName: 'executeCommand', action: 'Run bash shell command', target: firstLine, details: [commandText] });
  }

  return confirmTool(uiInstance, { toolName: 'confirm', action: question });
}
