import { OpenAI } from 'openai';
import { loadConfig, validateConfig } from '../config/index.js';

/**
 * Initializes and returns an OpenAI client instance.
 * @returns {OpenAI} An instance of the OpenAI client.
 */
function clientLoader(): OpenAI {
  const config = loadConfig();
  
  if (!validateConfig(config)) {
    throw new Error("Configuration missing or invalid. Please configure your ~/.env file (run 'cowork --help' for details).");
  }

  // Normalize baseURL: remove trailing slashes as the SDK appends paths starting with /
  const baseURL = config.model_url.replace(/\/+$/, '');

  return new OpenAI({
    apiKey: config.model_api_key,
    baseURL: baseURL,
    timeout: 60000, // 60 seconds timeout
    maxRetries: 0,  // Disable SDK's built-in retries to prevent overlapping attempts with BaseModel's retry loop.
  });
}

export default clientLoader;
