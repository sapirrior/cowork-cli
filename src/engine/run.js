import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import DefaultModel from './models/default.js';
import GeminiModel from './models/gemini.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '../configs/config.json');

/**
 * Executes a chat completion query using the appropriate model handler.
 * @param {import('openai').OpenAI} client The initialized OpenAI client.
 * @param {Object} config The user configuration (from .env).
 * @param {string} query The user query string.
 */
export default async function runQuery(client, config, query) {
  if (!query) {
    logger.error("Error: No query provided.");
    return;
  }

  try {
    // 1. Load and format system prompt from internal config
    let systemPrompt = null;
    try {
      const internalConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      if (internalConfig.systemPrompt) {
        systemPrompt = internalConfig.systemPrompt
          .replace('${folder}', process.cwd())
          .replace('${year}', new Date().getFullYear());
      }
    } catch (e) {
      // Fallback if config is missing - proceed without system prompt
    }

    const isGemini = config.model_type.toLowerCase() === 'gemini';
    const modelHandler = isGemini 
      ? new GeminiModel(client, config.model_name) 
      : new DefaultModel(client, config.model_name);

    await modelHandler.run(query, systemPrompt);
  } catch (err) {
    logger.error(`Error during AI execution: ${err.message}`);
    if (err.status === 401) {
      logger.secondary("Tip: Check if your API key is correct in your ~/.env file.");
    } else if (err.status === 404) {
      logger.secondary("Tip: The specified model or base URL might be incorrect.");
    }
  }
}
