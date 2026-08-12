import Spinner from '../engine/components/Spinner.js';
import { rgb } from './format.js';
import { THEME } from '../theme.js';

export interface UIInstance {
  engine: any;
  spinnerComponent: Spinner | null;
}

export function start(uiInstance: UIInstance, label: string, data: string = ''): void {
  abortActiveSpinner(uiInstance);
  uiInstance.spinnerComponent = new Spinner({ label, data, rotating: false });
  uiInstance.engine.mount(uiInstance.spinnerComponent);
  uiInstance.spinnerComponent.componentDidMount();
}

export function think(uiInstance: UIInstance): void {
  abortActiveSpinner(uiInstance);
  uiInstance.spinnerComponent = new Spinner({ label: 'Thinking...', data: '', rotating: true });
  uiInstance.engine.mount(uiInstance.spinnerComponent);
  uiInstance.spinnerComponent.componentDidMount();
}

export function update(uiInstance: UIInstance, data: string): void {
  if (uiInstance.spinnerComponent) {
    uiInstance.spinnerComponent.setState({ data });
  }
}

export function stop(uiInstance: UIInstance, msg?: string): void {
  commitSpinner(uiInstance, msg, THEME.success);
}

export function fail(uiInstance: UIInstance, msg?: string): void {
  commitSpinner(uiInstance, msg, THEME.error);
}

/**
 * Unmounts only the active spinner component \u2014 never calls unmountAll().
 * Cursor visibility is managed explicitly by the caller via keepCursorVisible.
 */
export function abortActiveSpinner(uiInstance: UIInstance): void {
  if (uiInstance.spinnerComponent) {
    uiInstance.engine.unmount(uiInstance.spinnerComponent);
    uiInstance.spinnerComponent = null;
  }
}

export function commitSpinner(uiInstance: UIInstance, msg: string | undefined, color: [number, number, number]): void {
  if (!uiInstance.spinnerComponent) return;

  const label = uiInstance.spinnerComponent.state.label === 'Thinking...' ? 'Thought' : uiInstance.spinnerComponent.state.label;
  const data = msg !== undefined ? msg : uiInstance.spinnerComponent.state.data;

  // Null out the reference first to prevent re-entrant checks seeing stale state,
  // then unmount the specific component \u2014 not everything on the tree.
  const spinner = uiInstance.spinnerComponent;
  uiInstance.spinnerComponent = null;
  uiInstance.engine.unmount(spinner);

  const dataStr = data ? ` ${rgb(THEME.main, '(')}${rgb(THEME.data, data)}${rgb(THEME.main, ')')}` : '';

  uiInstance.engine.commit('tool-result', [`${rgb(color, '\u25cf')} ${rgb(THEME.tool, label)}${dataStr}`]);
}
