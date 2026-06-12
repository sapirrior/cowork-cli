import PromptInput from '../engine/components/PromptInput.js';
import SelectionList from '../engine/components/SelectionList.js';
import { rgb, dim } from './format.js';

export async function ask(uiInstance, question) {
  uiInstance._abortActiveSpinner();
  if (!process.stdin.isTTY) {
    throw new Error('stdin is not a TTY');
  }

  const inputComp = new PromptInput({ question, currentVal: '' });
  uiInstance.engine.mount(inputComp, { keepCursorVisible: true });

  return new Promise((resolve, reject) => {
    let buffer = '';

    const onData = (chunk) => {
      const str = chunk.toString();

      if (str === '\u0003') {
        cleanup();
        uiInstance.engine.unmountAll();
        const blueColor = [123, 165, 218];
        const yellowColor = [242, 207, 110];
        const silverColor = [194, 198, 197];
        const redColor = [224, 112, 112];
        process.stdout.write(`${rgb(blueColor, '◇')} ${rgb(yellowColor, 'Ask:')} ${rgb(silverColor, question)}\n`);
        process.stdout.write(`${rgb(blueColor, '➔')} ${rgb(redColor, 'cancelled')}\n`);
        reject({ cancelled: true });
        return;
      }

      if (str === '\u007f' || str === '\b') {
        if (buffer.length > 0) {
          buffer = buffer.slice(0, -1);
          inputComp.setState({ currentVal: buffer });
        }
        return;
      }

      if (str === '\r' || str === '\n') {
        cleanup();
        uiInstance.engine.unmountAll();
        const blueColor = [123, 165, 218];
        const yellowColor = [242, 207, 110];
        const silverColor = [194, 198, 197];
        process.stdout.write(`${rgb(blueColor, '◇')} ${rgb(yellowColor, 'Ask:')} ${rgb(silverColor, question)}\n`);
        process.stdout.write(`${rgb(blueColor, '➔')}  ${buffer}\n`);
        resolve(buffer.trim());
        return;
      }

      if (str.length === 1 && str >= ' ') {
        buffer += str;
        inputComp.setState({ currentVal: buffer });
      }
    };

    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.off('data', onData);
      process.stdin.pause();
    };

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

export async function confirm(uiInstance, question) {
  uiInstance._abortActiveSpinner();
  if (!process.stdin.isTTY) {
    return { confirmed: false, dismissed: true };
  }

  const blueColor = [123, 165, 218];
  const listComp = new SelectionList({ question, items: ['Yes', 'No'], selectedIdx: 0 });
  uiInstance.engine.mount(listComp);

  return new Promise((resolve) => {
    let selectedYes = true;

    const onData = (chunk) => {
      const str = chunk.toString();

      if (str === '\u0003') {
        cleanup();
        uiInstance.engine.unmountAll();
        const yellowColor = [242, 207, 110];
        const silverColor = [194, 198, 197];
        process.stdout.write(`${rgb(blueColor, '◇')} ${rgb(yellowColor, 'Ask Confirm:')} ${rgb(silverColor, question)}\n`);
        process.stdout.write(`${rgb(blueColor, '➔')} ${dim('cancelled')}\n`);
        resolve({ confirmed: false, dismissed: true });
        return;
      }

      if (str === '\r' || str === '\n') {
        cleanup();
        uiInstance.engine.unmountAll();
        const yellowColor = [242, 207, 110];
        const silverColor = [194, 198, 197];
        const finalColor = selectedYes ? [122, 195, 145] : [224, 112, 112];
        const finalStr = selectedYes ? 'yes' : 'no';
        process.stdout.write(`${rgb(blueColor, '◇')} ${rgb(yellowColor, 'Ask Confirm:')} ${rgb(silverColor, question)}\n`);
        process.stdout.write(`${rgb(blueColor, '➔')} ${rgb(finalColor, finalStr)}\n`);
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

    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.off('data', onData);
      process.stdin.pause();
    };

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}
