import fs from 'fs';
import path from 'path';
import os from 'os';
import dotenv from 'dotenv';
import { logger } from './logger.js';

const CONFIG_PATH = path.join(os.homedir(), '.env');

/**
 * Loads the user configuration from ~/.env file.
 * @returns {Object|null} The configuration object or null if it doesn't exist or is invalid.
 */
export const loadConfig = () => {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const content = fs.readFileSync(CONFIG_PATH, 'utf8');
      const envConfig = dotenv.parse(content);
      
      const config = {
        model_name: envConfig.BTW_MODEL_NAME || envConfig.MODEL_NAME,
        model_url: envConfig.BTW_MODEL_URL || envConfig.MODEL_URL,
        model_api_key: envConfig.BTW_MODEL_API_KEY || envConfig.MODEL_API_KEY,
        model_type: envConfig.BTW_MODEL_TYPE || envConfig.MODEL_TYPE
      };

      // Remove undefined/empty values
      const filteredConfig = Object.fromEntries(
        Object.entries(config).filter(([_, v]) => v !== undefined && v !== '')
      );

      if (Object.keys(filteredConfig).length > 0) {
        return filteredConfig;
      }
    }
  } catch (err) {
    logger.error(`Error loading configuration from ~/.env: ${err.message}`);
  }
  return null;
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
