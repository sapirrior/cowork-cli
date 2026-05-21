import { logger } from '../utils/logger.js';
import DefaultModel from './models/default.js';
import GeminiModel from './models/gemini.js';

/**
 * Executes a chat completion query using the appropriate model handler.
 * @param {import('openai').OpenAI} client The initialized OpenAI client.
 * @param {Object} config The user configuration.
 * @param {string} query The user query string.
 */
export default async function runQuery(client, config, query) {
  if (!query) {
    logger.error("Error: No query provided.");
    return;
  }

  try {
    const isGemini = config.model_type.toLowerCase() === 'gemini';
    const modelHandler = isGemini 
      ? new GeminiModel(client, config.model_name) 
      : new DefaultModel(client, config.model_name);

    await modelHandler.run(query);
  } catch (err) {
    logger.error(`\nError during AI execution: ${err.message}`);
    if (err.status === 401) {
      logger.secondary("Tip: Check if your API key is correct in 'btw --config'.");
    } else if (err.status === 404) {
      logger.secondary("Tip: The specified model or base URL might be incorrect.");
    }
  }
}
