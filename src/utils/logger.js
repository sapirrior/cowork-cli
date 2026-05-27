import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, '../configs/config.json');

let config;
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
      dim:     '#606060',
      header:  '#A37ACC',
    }
  };
}

function hexToAnsi(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `\x1b[38;2;${r};${g};${b}m`;
}

const reset = '\x1b[0m';

const colors = {
  main:    hexToAnsi(config.accents.main),
  tool:    hexToAnsi(config.accents.tool),
  data:    hexToAnsi(config.accents.data),
  success: hexToAnsi(config.accents.success),
  error:   hexToAnsi(config.accents.error),
  dim:     hexToAnsi(config.accents.dim),
  header:  hexToAnsi(config.accents.header),
};

export const formatMain      = (text) => `${colors.main}${text}${reset}`;
export const formatSecondary = (text) => `${colors.tool}${text}${reset}`;
export const formatNormal    = (text) => `${colors.data}${text}${reset}`;
export const formatError     = (text) => `${colors.error}${text}${reset}`;
export const formatDim       = (text) => `${colors.dim}${text}${reset}`;
export const formatHeader    = (text) => `${colors.header}${text}${reset}`;

export const logger = {
  main:      (msg) => console.log(formatMain(msg)),
  secondary: (msg) => console.log(formatSecondary(msg)),
  normal:    (msg) => console.log(formatNormal(msg)),
  error:     (msg) => console.error(formatError(msg)),
};
