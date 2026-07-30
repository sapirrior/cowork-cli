import InputBox from '../engine/components/InputBox.js';
import SelectionList from '../engine/components/SelectionList.js';
import { rgb, dim } from './format.js';

interface UIInstance {
  _abortActiveSpinner(): void;
  engine: any;
}

export async function ask(uiInstance: UIInstance, question: string): Promise<string> {
  uiInstance._abortActiveSpinner();
  if (!process.stdin.isTTY) {
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
        const blueColor: [number, number, number] = [123, 165, 218];
        const yellowColor: [number, number, number] = [242, 207, 110];
        const silverColor: [number, number, number] = [194, 198, 197];
        const redColor: [number, number, number] = [224, 112, 112];
        uiInstance.engine.commit('raw', [
          `${rgb(blueColor, '◇')} ${rgb(yellowColor, 'Ask:')} ${rgb(silverColor, question)}`,
          `${rgb(blueColor, '➔')} ${rgb(redColor, 'cancelled')}`
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

      // Backspace (Delete character behind the cursor)
      if (str === '\u007f' || str === '\b') {
        if (cursorIndex > 0) {
          buffer = buffer.slice(0, cursorIndex - 1) + buffer.slice(cursorIndex);
          cursorIndex--;
          inputComp.setState({ currentVal: buffer, cursorIndex });
        }
        return;
      }

      // Delete key (Delete character in front of the cursor)
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
        const blueColor: [number, number, number] = [123, 165, 218];
        const yellowColor: [number, number, number] = [242, 207, 110];
        const silverColor: [number, number, number] = [194, 198, 197];
        uiInstance.engine.commit('raw', [
          `${rgb(blueColor, '◇')} ${rgb(yellowColor, 'Ask:')} ${rgb(silverColor, question)}`,
          `${rgb(blueColor, '➔')}  ${buffer}`
        ]);
        resolve(buffer.trim());
        return;
      }

      // Ignore other control sequences
      if (str.startsWith('\u001b')) {
        return;
      }

      // Allow pasting multiple characters by filtering out control characters
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
      process.stdin.pause();
      process.stdin.unref();
    };

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.on('data', onData);
  });

  const exitCleanup = () => {
    if (cleanup) cleanup();
  };
  process.once('exit', exitCleanup);

  return promise.finally(() => {
    process.off('exit', exitCleanup);
  });
}

export async function confirm(uiInstance: UIInstance, question: string): Promise<{ confirmed: boolean; dismissed?: boolean }> {
  uiInstance._abortActiveSpinner();
  if (!process.stdin.isTTY) {
    return { confirmed: false, dismissed: true };
  }

  const blueColor: [number, number, number] = [123, 165, 218];
  const listComp = new SelectionList({ question, items: ['Yes', 'No'], selectedIdx: 0 });
  uiInstance.engine.mount(listComp);

  let onData: (chunk: Buffer) => void;
  let cleanup: () => void;

  const promise = new Promise<{ confirmed: boolean; dismissed?: boolean }>((resolve) => {
    let selectedYes = true;

    onData = (chunk: Buffer) => {
      const str = chunk.toString();

      if (str === '\u0003') {
        cleanup();
        uiInstance.engine.unmountAll();
        const yellowColor: [number, number, number] = [242, 207, 110];
        const silverColor: [number, number, number] = [194, 198, 197];
        uiInstance.engine.commit('raw', [
          `${rgb(blueColor, '◇')} ${rgb(yellowColor, 'Ask Confirm:')} ${rgb(silverColor, question)}`,
          `${rgb(blueColor, '➔')} ${dim('cancelled')}`
        ]);
        resolve({ confirmed: false, dismissed: true });
        return;
      }

      if (str === '\r' || str === '\n') {
        cleanup();
        uiInstance.engine.unmountAll();
        const yellowColor: [number, number, number] = [242, 207, 110];
        const silverColor: [number, number, number] = [194, 198, 197];
        const finalColor: [number, number, number] = selectedYes ? [122, 195, 145] : [224, 112, 112];
        const finalStr = selectedYes ? 'yes' : 'no';
        uiInstance.engine.commit('raw', [
          `${rgb(blueColor, '◇')} ${rgb(yellowColor, 'Ask Confirm:')} ${rgb(silverColor, question)}`,
          `${rgb(blueColor, '➔')} ${rgb(finalColor, finalStr)}`
        ]);
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

    cleanup = () => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.off('data', onData);
      process.stdin.pause();
      process.stdin.unref();
    };

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.on('data', onData);
  });

  const exitCleanup = () => {
    if (cleanup) cleanup();
  };
  process.once('exit', exitCleanup);

  return promise.finally(() => {
    process.off('exit', exitCleanup);
  });
}
