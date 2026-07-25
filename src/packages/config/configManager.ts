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
  version?: number;
  active: string | null;
  providers: Record<string, Config>;
}

/**
 * Validates a single provider config object.
 */
function isValidConfigObject(c: any): c is Config {
  if (!c || typeof c !== 'object') return false;
  return (
    typeof c.model_name === 'string' && c.model_name.trim() !== '' &&
    typeof c.model_url === 'string' && c.model_url.trim() !== '' &&
    typeof c.model_api_key === 'string' && c.model_api_key.trim() !== '' &&
    typeof c.model_type === 'string' && ['openai', 'gemini'].includes(c.model_type.toLowerCase())
  );
}

/**
 * Loads the user configuration from ~/.config/cowork/auth.json (or fallback ~/.env).
 * @returns {Config|null} The configuration object or null if it doesn't exist or is invalid.
 */
export const loadConfig = (): Config | null => {
  // 1. Try reading the modern auth.json multi-provider configuration
  if (fs.existsSync(AUTH_JSON_PATH)) {
    try {
      const content = fs.readFileSync(AUTH_JSON_PATH, 'utf8');
      const authConfig: AuthConfig = JSON.parse(content);
      
      if (!authConfig || typeof authConfig !== 'object') {
        logger.error(`Error loading configuration: ~/.config/cowork/auth.json is not a valid JSON object.`);
      } else if (!authConfig.active) {
        logger.error(`Error loading configuration: active provider is not set in ~/.config/cowork/auth.json.`);
      } else if (!authConfig.providers || typeof authConfig.providers !== 'object') {
        logger.error(`Error loading configuration: providers dictionary is missing in ~/.config/cowork/auth.json.`);
      } else {
        const activeConfig = authConfig.providers[authConfig.active];
        if (!activeConfig) {
          logger.error(`Error loading configuration: active provider '${authConfig.active}' details are missing in ~/.config/cowork/auth.json.`);
        } else if (!isValidConfigObject(activeConfig)) {
          logger.error(`Error loading configuration: active provider '${authConfig.active}' config in ~/.config/cowork/auth.json is invalid or incomplete.`);
        } else {
          return {
            model_name: activeConfig.model_name,
            model_url: activeConfig.model_url,
            model_api_key: activeConfig.model_api_key,
            model_type: activeConfig.model_type
          };
        }
      }
    } catch (err: any) {
      logger.error(`Error parsing ~/.config/cowork/auth.json: ${err.message}`);
    }
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
        if (isValidConfigObject(filteredConfig)) {
          return filteredConfig as Config;
        } else {
          logger.error(`Legacy ~/.env configuration is invalid or incomplete.`);
        }
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
  return isValidConfigObject(config);
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
