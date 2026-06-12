import Spinner from '../engine/components/Spinner.js';
import { rgb } from './format.js';

export function start(uiInstance, label, data = '') {
  abortActiveSpinner(uiInstance);
  uiInstance.spinnerComponent = new Spinner({ label, data, rotating: false });
  uiInstance.engine.mount(uiInstance.spinnerComponent);
  uiInstance.spinnerComponent.componentDidMount();
}

export function think(uiInstance) {
  abortActiveSpinner(uiInstance);
  uiInstance.spinnerComponent = new Spinner({ label: 'Thinking...', data: '', rotating: true });
  uiInstance.engine.mount(uiInstance.spinnerComponent);
  uiInstance.spinnerComponent.componentDidMount();
}

export function update(uiInstance, data) {
  if (uiInstance.spinnerComponent) {
    uiInstance.spinnerComponent.setState({ data });
  }
}

export function stop(uiInstance, msg) {
  commitSpinner(uiInstance, msg, [122, 195, 145]);
}

export function fail(uiInstance, msg) {
  commitSpinner(uiInstance, msg, [224, 112, 112]);
}

export function abortActiveSpinner(uiInstance) {
  if (uiInstance.spinnerComponent) {
    uiInstance.spinnerComponent.componentWillUnmount();
    uiInstance.engine.unmountAll();
    uiInstance.spinnerComponent = null;
  }
}

export function commitSpinner(uiInstance, msg, color) {
  if (!uiInstance.spinnerComponent) return;

  uiInstance.spinnerComponent.componentWillUnmount();
  uiInstance.engine.clear();

  const label = uiInstance.spinnerComponent.state.label === 'Thinking...' ? 'Thought' : uiInstance.spinnerComponent.state.label;
  const data = msg !== undefined ? msg : uiInstance.spinnerComponent.state.data;

  const blueColor = [123, 165, 218];
  const dataStr = data ? ` ${rgb(blueColor, '(')}${rgb([194, 198, 197], data)}${rgb(blueColor, ')')}` : '';
  process.stdout.write(`${rgb(color, '●')} ${rgb([242, 207, 110], label)}${dataStr}\n`);

  uiInstance.engine.unmountAll();
  uiInstance.spinnerComponent = null;
}
