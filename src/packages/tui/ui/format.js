export function rgb(rgbArr, text) {
  return `\x1b[38;2;${rgbArr[0]};${rgbArr[1]};${rgbArr[2]}m${text}\x1b[0m`;
}
export function bold(text) { return `\x1b[1m${text}\x1b[0m`; }
export function dim(text)  { return `\x1b[2m${text}\x1b[0m`; }
