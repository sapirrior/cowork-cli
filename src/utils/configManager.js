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
        model_name: envConfig.CWK_MODEL_NAME || envConfig.BTW_MODEL_NAME || envConfig.MODEL_NAME,
        model_url: envConfig.CWK_MODEL_URL || envConfig.BTW_MODEL_URL || envConfig.MODEL_URL,
        model_api_key: envConfig.CWK_MODEL_API_KEY || envConfig.BTW_MODEL_API_KEY || envConfig.MODEL_API_KEY,
        model_type: envConfig.CWK_MODEL_TYPE || envConfig.BTW_MODEL_TYPE || envConfig.MODEL_TYPE
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
  const hasAllKeys = requiredKeys.every(key => config[key] && config[key].trim() !== '');
  
  if (!hasAllKeys) return false;

  const validTypes = ['openai', 'gemini'];
  return validTypes.includes(config.model_type.toLowerCase());
};

/**
 * Verifies the connectivity and credentials by listing models.
 * @param {Object} client The initialized OpenAI client.
 * @returns {Promise<boolean>} True if connectivity is verified, false otherwise.
 */
export const verifyConnectivity = async (client) => {
  try {
    // This call verifies both the API Key and the Base URL
    await client.models.list();
    return true;
  } catch (err) {
    logger.error(`Connection verification failed: ${err.message}`);
    return false;
  }
};
