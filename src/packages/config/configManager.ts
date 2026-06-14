import fs from 'fs';
import path from 'path';
import os from 'os';
import dotenv from 'dotenv';
import { logger } from '../utils/index.js';
import { OpenAI } from 'openai';

const CONFIG_PATH = path.join(os.homedir(), '.env');
const AUTH_JSON_PATH = path.join(os.homedir(), '.config', 'cowork', 'auth.json');

export interface Config {
  model_name: string;
  model_url: string;
  model_api_key: string;
  model_type: string;
}

interface AuthConfig {
  active: string | null;
  providers: Record<string, Config>;
}

/**
 * Loads the user configuration from ~/.config/cowork/auth.json (or fallback ~/.env).
 * @returns {Config|null} The configuration object or null if it doesn't exist or is invalid.
 */
export const loadConfig = (): Config | null => {
  // 1. Try reading the modern auth.json multi-provider configuration
  try {
    if (fs.existsSync(AUTH_JSON_PATH)) {
      const content = fs.readFileSync(AUTH_JSON_PATH, 'utf8');
      const authConfig: AuthConfig = JSON.parse(content);
      if (authConfig && authConfig.active && authConfig.providers && authConfig.providers[authConfig.active]) {
        const activeConfig = authConfig.providers[authConfig.active];
        return {
          model_name: activeConfig.model_name,
          model_url: activeConfig.model_url,
          model_api_key: activeConfig.model_api_key,
          model_type: activeConfig.model_type
        };
      }
    }
  } catch (err: any) {
    logger.error(`Error loading configuration from ~/.config/cowork/auth.json: ${err.message}`);
  }

  // 2. Fall back to the legacy ~/.env file
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const content = fs.readFileSync(CONFIG_PATH, 'utf8');
      const envConfig = dotenv.parse(content);
      
      const config = {
        model_name: envConfig.CWK_MODEL_NAME || envConfig.MODEL_NAME,
        model_url: envConfig.CWK_MODEL_URL || envConfig.MODEL_URL,
        model_api_key: envConfig.CWK_MODEL_API_KEY || envConfig.MODEL_API_KEY,
        model_type: envConfig.CWK_MODEL_TYPE || envConfig.MODEL_TYPE
      };

      // Remove undefined/empty values
      const filteredConfig = Object.fromEntries(
        Object.entries(config).filter(([_, v]) => v !== undefined && v !== '')
      ) as Partial<Config>;

      if (Object.keys(filteredConfig).length > 0) {
        return filteredConfig as Config;
      }
    }
  } catch (err: any) {
    logger.error(`Error loading configuration from ~/.env: ${err.message}`);
  }
  return null;
};

/**
 * Validates the configuration object.
 * @param {Config|null|undefined} config The configuration object to validate.
 * @returns {config is Config} True if valid, false otherwise.
 */
export const validateConfig = (config: Config | null | undefined): config is Config => {
  if (!config) return false;
  const requiredKeys: (keyof Config)[] = ['model_name', 'model_url', 'model_api_key', 'model_type'];
  const hasAllKeys = requiredKeys.every(key => config[key] && config[key].trim() !== '');
  
  if (!hasAllKeys) return false;

  const validTypes = ['openai', 'gemini'];
  return validTypes.includes(config.model_type.toLowerCase());
};

/**
 * Verifies the connectivity and credentials by listing models.
 * @param {OpenAI} client The initialized OpenAI client.
 * @returns {Promise<boolean>} True if connectivity is verified, false otherwise.
 */
export const verifyConnectivity = async (client: OpenAI): Promise<boolean> => {
  try {
    // This call verifies both the API Key and the Base URL
    await client.models.list();
    return true;
  } catch (err: any) {
    logger.error(`Connection verification failed: ${err.message}`);
    return false;
  }
};
