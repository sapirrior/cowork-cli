import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, '../configs/config.json');

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

function hexToAnsi(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `\x1b[38;2;${r};${g};${b}m`;
}

const colors = {
  main: hexToAnsi(config.accents.orangex),
  secondary: hexToAnsi(config.accents.greyx),
  normal: hexToAnsi(config.accents.resetx),
  reset: '\x1b[0m'
};

export const formatMain = (text) => `${colors.main}${text}${colors.reset}`;
export const formatSecondary = (text) => `${colors.secondary}${text}${colors.reset}`;
export const formatNormal = (text) => `${colors.normal}${text}${colors.reset}`;

export const logger = {
  main: (msg) => console.log(formatMain(msg)),
  secondary: (msg) => console.log(formatSecondary(msg)),
  normal: (msg) => console.log(formatNormal(msg)),
  error: (msg) => console.error(formatMain(msg))
};
