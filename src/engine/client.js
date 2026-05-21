import { OpenAI } from 'openai';
import { loadConfig, validateConfig } from '../utils/configManager.js';
import { logger } from '../utils/logger.js';

/**
 * Initializes and returns an OpenAI client instance.
 * @returns {OpenAI} An instance of the OpenAI client.
 */
function clientLoader() {
  const config = loadConfig();
  
  if (!validateConfig(config)) {
    throw new Error("Configuration missing or invalid. Please configure your ~/.env file (run 'btw --help' for details).");
  }

  // Normalize baseURL: remove trailing slashes as the SDK appends paths starting with /
  const baseURL = config.model_url.replace(/\/+$/, '');

  return new OpenAI({
    apiKey: config.model_api_key,
    baseURL: baseURL,
    timeout: 60000 // 60 seconds timeout
  });
}

export default clientLoader;
