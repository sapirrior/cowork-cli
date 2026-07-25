import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, '../config/configs/config.json');

interface AccentConfig {
  accents: {
    main: string;
    tool: string;
    data: string;
    success: string;
    error: string;
    dim: string;
    header: string;
  };
}

let config: AccentConfig;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
  config = {
    accents: {
      main:    '#7BA5DA',
      tool:    '#F2CF6E',
      data:    '#C2C6C5',
      success: '#7AC391',
      error:   '#E07070',
      dim:     '#8F9399',
      header:  '#A37ACC',
    }
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function rgb(rgbArr: [number, number, number], text: string): string {
  return `\x1b[38;2;${rgbArr[0]};${rgbArr[1]};${rgbArr[2]}m${text}\x1b[0m`;
}

export const THEME = {
  main: hexToRgb(config.accents.main),
  tool: hexToRgb(config.accents.tool),
  data: hexToRgb(config.accents.data),
  success: hexToRgb(config.accents.success),
  error: hexToRgb(config.accents.error),
  dim: hexToRgb(config.accents.dim),
  header: hexToRgb(config.accents.header),

  // Pre-colored string formatting helpers
  formatMain: (text: string) => rgb(hexToRgb(config.accents.main), text),
  formatTool: (text: string) => rgb(hexToRgb(config.accents.tool), text),
  formatNormal: (text: string) => rgb(hexToRgb(config.accents.data), text),
  formatSuccess: (text: string) => rgb(hexToRgb(config.accents.success), text),
  formatError: (text: string) => rgb(hexToRgb(config.accents.error), text),
  formatDim: (text: string) => rgb(hexToRgb(config.accents.dim), text),
  formatHeader: (text: string) => rgb(hexToRgb(config.accents.header), text),

  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
  faint: (text: string) => `\x1b[2m${text}\x1b[0m`,
};
