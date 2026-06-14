import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, '../config/configs/config.json');

interface Config {
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

let config: Config;
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

function hexToAnsi(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `\x1b[38;2;${r};${g};${b}m`;
}

const reset = '\x1b[0m';

export const colors = {
  main:    hexToAnsi(config.accents.main),
  tool:    hexToAnsi(config.accents.tool),
  data:    hexToAnsi(config.accents.data),
  success: hexToAnsi(config.accents.success),
  error:   hexToAnsi(config.accents.error),
  dim:     hexToAnsi(config.accents.dim),
  header:  hexToAnsi(config.accents.header),
};

export const formatMain      = (text: string): string => `${colors.main}${text}${reset}`;
export const formatSecondary = (text: string): string => `${colors.tool}${text}${reset}`;
export const formatNormal    = (text: string): string => `${colors.data}${text}${reset}`;
export const formatError     = (text: string): string => `${colors.error}${text}${reset}`;
export const formatDim       = (text: string): string => `${colors.dim}${text}${reset}`;
export const formatHeader    = (text: string): string => `${colors.header}${text}${reset}`;

export const logger = {
  main:      (msg: string): void => console.log(formatMain(msg)),
  secondary: (msg: string): void => console.log(formatSecondary(msg)),
  normal:    (msg: string): void => console.log(formatNormal(msg)),
  error:     (msg: string): void => console.error(formatError(msg)),
};
