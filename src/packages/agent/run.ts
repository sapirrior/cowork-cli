import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/index.js';
import { DefaultModel, GeminiModel } from '../providers/index.js';
import { OpenAI } from 'openai';
import { Config } from '../config/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Executes a chat completion query using the appropriate model handler.
 * @param client The initialized OpenAI client.
 * @param config The user configuration (from .env).
 * @param query The user query string.
 */
export default async function runQuery(
  client: OpenAI,
  config: Config | null,
  query: string
): Promise<void> {
  if (!query) {
    logger.error("Error: No query provided.");
    return;
  }

  if (!config) {
    logger.error("Error: Configuration not loaded.");
    return;
  }

  try {
    // 1. Load and format system prompt from internal sys.txt
    let systemPrompt: string | null = null;
    try {
      const promptPath = path.join(__dirname, '../config/configs/sys.txt');
      if (fs.existsSync(promptPath)) {
        systemPrompt = fs.readFileSync(promptPath, 'utf8')
          .replace('${folder}', process.cwd())
          .replace(/\${year}/g, String(new Date().getFullYear()));
      }
    } catch (e) {
      // Fallback if prompt is missing - proceed without system prompt
    }

    const isGemini = config.model_type.toLowerCase() === 'gemini';
    const modelHandler = isGemini 
      ? new GeminiModel(client, config.model_name) 
      : new DefaultModel(client, config.model_name);

    await modelHandler.run(query, systemPrompt);
  } catch (err: any) {
    logger.error(`Error during AI execution: ${err.message}`);
    if (err.status === 401) {
      logger.secondary("Tip: Check if your API key is correct in your ~/.env file.");
    } else if (err.status === 404) {
      logger.secondary("Tip: The specified model or base URL might be incorrect.");
    }
  }
}

