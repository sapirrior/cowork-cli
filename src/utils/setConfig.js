import readline from 'readline';
import { saveConfig } from './configManager.js';
import { logger, formatSecondary } from './logger.js';

/**
 * Orchestrates the interactive configuration process.
 */
export default async function setConfig() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const ask = (query) => new Promise((resolve) => rl.question(formatSecondary(query), (answer) => resolve(answer.trim())));

  logger.main("\n---- btw Tool Configuration ----");
  logger.main("Please provide your AI model details below.\n");

  const model_name = await ask("1. Enter Model Name (e.g., gpt-4, mistral): ");
  const model_url = await ask("2. Enter Model Base URL (e.g., https://api.openai.com/v1): ");
  const model_api_key = await ask("3. Enter API Key: ");
  const model_type = await ask("4. Enter Provider/Type (e.g., openai, gemini): ");

  if (!model_name || !model_url || !model_api_key || !model_type) {
    logger.error("\nError: All configuration fields are required.");
    rl.close();
    process.exitCode = 1;
    return;
  }

  const config = { model_name, model_url, model_api_key, model_type };
  try {
    saveConfig(config);
    logger.main("\nConfiguration successfully updated!\n");
  } catch (err) {
    logger.error(`\nFailed to save configuration: ${err.message}`);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}
