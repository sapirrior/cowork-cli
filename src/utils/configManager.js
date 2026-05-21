import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '../configs/user.json');

/**
 * Loads the user configuration from the JSON file.
 * @returns {Object|null} The configuration object or null if it doesn't exist or is invalid.
 */
export const loadConfig = () => {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    logger.error(`Error loading configuration: ${err.message}`);
  }
  return null;
};

/**
 * Saves the user configuration to the JSON file.
 * @param {Object} config The configuration object to save.
 */
export const saveConfig = (config) => {
  try {
    const configDir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    logger.error(`Error saving configuration: ${err.message}`);
    process.exit(1);
  }
};

/**
 * Validates the configuration object.
 * @param {Object} config The configuration object to validate.
 * @returns {boolean} True if valid, false otherwise.
 */
export const validateConfig = (config) => {
  if (!config) return false;
  const requiredKeys = ['model_name', 'model_url', 'model_api_key', 'model_type'];
  return requiredKeys.every(key => config[key] && config[key].trim() !== '');
};
