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
    logger.error("Configuration missing or invalid. Please run 'btw --config' first.");
    process.exit(1);
  }

  // Normalize baseURL: remove trailing slashes as the SDK appends paths starting with /
  const baseURL = config.model_url.replace(/\/+$/, '');

  return new OpenAI({
    apiKey: config.model_api_key,
    baseURL: baseURL
  });
}

export default clientLoader;
