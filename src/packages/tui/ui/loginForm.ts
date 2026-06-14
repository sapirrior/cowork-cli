import ProviderSelector from '../engine/components/ProviderSelector.js';
import InputBox from '../engine/components/InputBox.js';
import { rgb, dim } from './format.js';

interface SelectorItem {
  label: string;
  configured: boolean;
  active: boolean;
}

interface UIInstance {
  _abortActiveSpinner(): void;
  engine: any;
}

interface InputFieldOptions {
  label: string;
  hint?: string;
  masked?: boolean;
  required?: boolean;
  fallback?: string;
  key?: string;
}

/**
 * 1. Provider selection step
 * Resolves with selectedIdx (number) or rejects if cancelled.
 */
export async function selectProvider(uiInstance: UIInstance, items: SelectorItem[]): Promise<number> {
  uiInstance._abortActiveSpinner();
  if (!process.stdin.isTTY) {
    throw new Error('stdin is not a TTY. Cannot select provider.');
  }

  const selectorComp = new ProviderSelector({ items, selectedIdx: 0 });
  uiInstance.engine.mount(selectorComp);

  return new Promise((resolve, reject) => {
    let selectedIdx = 0;

    const onData = (chunk: Buffer) => {
      const str = chunk.toString();

      if (str === '\u0003') { // Ctrl+C
        cleanup();
        uiInstance.engine.unmountAll();
        
        const blueColor: [number, number, number] = [123, 165, 218];
        const redColor: [number, number, number] = [224, 112, 112];
        const dimColor: [number, number, number] = [194, 198, 197];
        
        process.stdout.write(`${rgb(blueColor, '◇')} ${rgb(dimColor, 'cowork login')}\n`);
        process.stdout.write(`${rgb(blueColor, '➔')} ${rgb(redColor, 'cancelled')}\n`);
        
        reject({ cancelled: true });
        return;
      }

      if (str === '\r' || str === '\n') {
        cleanup();
        uiInstance.engine.unmountAll();
        
        const blueColor: [number, number, number] = [123, 165, 218];
        const greenColor: [number, number, number] = [122, 195, 145];
        const dimColor: [number, number, number] = [194, 198, 197];
        const selectedItem = items[selectedIdx];
        
        process.stdout.write(`${rgb(blueColor, '◇')} ${rgb(dimColor, 'cowork login')}\n`);
        process.stdout.write(`${rgb(blueColor, '➔')} ${rgb(greenColor, `Selected: ${selectedItem.label}`)}\n`);
        
        resolve(selectedIdx);
        return;
      }

      if (str === '\u001b[A' || str === '\u001b[D') { // Up / Left
        selectedIdx = (selectedIdx - 1 + items.length) % items.length;
        selectorComp.setState({ selectedIdx });
      } else if (str === '\u001b[B' || str === '\u001b[C' || str === '\t' || str === ' ') { // Down / Right / Tab / Space
        selectedIdx = (selectedIdx + 1) % items.length;
        selectorComp.setState({ selectedIdx });
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

/**
 * 2. Single field input step
 * Resolves with string value or rejects if cancelled.
 */
export async function inputField(
  uiInstance: UIInstance,
  { label, hint, masked = false, required = false, fallback = '' }: InputFieldOptions
): Promise<string> {
  uiInstance._abortActiveSpinner();
  if (!process.stdin.isTTY) {
    throw new Error('stdin is not a TTY');
  }

  const inputComp = new InputBox({
    label,
    hint,
    currentVal: '',
    masked,
    error: null
  });

  uiInstance.engine.mount(inputComp, { keepCursorVisible: true });

  return new Promise((resolve, reject) => {
    let buffer = '';
    let cursorIndex = 0;

    const onData = (chunk: Buffer) => {
      const str = chunk.toString();

      if (str === '\u0003') { // Ctrl+C
        cleanup();
        uiInstance.engine.unmountAll();
        
        const blueColor: [number, number, number] = [123, 165, 218];
        const redColor: [number, number, number] = [224, 112, 112];
        const silverColor: [number, number, number] = [194, 198, 197];
        
        process.stdout.write(`${rgb(blueColor, '◈')} ${rgb(silverColor, label)}${hint ? ' ' + dim(hint) : ''}\n`);
        process.stdout.write(`${rgb(blueColor, '➔')} ${rgb(redColor, 'cancelled')}\n`);
        
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

      // Backspace (Delete character behind the cursor)
      if (str === '\u007f' || str === '\b') {
        if (cursorIndex > 0) {
          buffer = buffer.slice(0, cursorIndex - 1) + buffer.slice(cursorIndex);
          cursorIndex--;
          inputComp.setState({ currentVal: buffer, cursorIndex, error: null });
        }
        return;
      }

      // Delete key (Delete character in front of the cursor)
      if (str === '\u001b[3~') {
        if (cursorIndex < buffer.length) {
          buffer = buffer.slice(0, cursorIndex) + buffer.slice(cursorIndex + 1);
          inputComp.setState({ currentVal: buffer, error: null });
        }
        return;
      }

      if (str === '\r' || str === '\n') {
        const finalVal = buffer.trim();

        if (!finalVal && required && !fallback) {
          inputComp.setState({ error: `${label} is required.` });
          return;
        }

        cleanup();
        uiInstance.engine.unmountAll();

        const blueColor: [number, number, number] = [123, 165, 218];
        const greenColor: [number, number, number] = [122, 195, 145];
        const silverColor: [number, number, number] = [194, 198, 197];
        
        const resolvedVal = finalVal || fallback;
        const displayVal = masked ? '•'.repeat(resolvedVal.length) : resolvedVal;

        process.stdout.write(`${rgb(blueColor, '◈')} ${rgb(silverColor, label)}${hint ? ' ' + dim(hint) : ''}\n`);
        process.stdout.write(`${rgb(blueColor, '➔')} ${rgb(greenColor, displayVal)}\n`);
        
        resolve(resolvedVal);
        return;
      }

      // Ignore other control sequences
      if (str.startsWith('\u001b')) {
        return;
      }

      // Insert printable characters at current cursor index
      if (str.length === 1 && str >= ' ') {
        buffer = buffer.slice(0, cursorIndex) + str + buffer.slice(cursorIndex);
        cursorIndex++;
        inputComp.setState({ currentVal: buffer, cursorIndex, error: null });
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

/**
 * 3. Full sequential form (runs fields one by one)
 * Resolves with a { [fieldKey]: value } object.
 */
export async function runFieldSequence(uiInstance: UIInstance, fields: InputFieldOptions[]): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  for (const field of fields) {
    const value = await inputField(uiInstance, field);
    results[field.key || field.label] = value;
  }
  return results;
}
