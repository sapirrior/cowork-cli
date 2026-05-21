import readline from 'readline';
import { saveConfig } from './configManager.js';
import { logger, formatSecondary } from './logger.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Helper function to ask a question via readline.
 * @param {string} query The question to display.
 * @returns {Promise<string>} The user's answer.
 */
const ask = (query) => new Promise((resolve) => rl.question(formatSecondary(query), (answer) => resolve(answer.trim())));

/**
 * Orchestrates the interactive configuration process.
 */
export default async function setConfig() {
  logger.main("\n---- btw Tool Configuration ----");
  logger.main("Please provide your AI model details below.\n");

  const model_name = await ask("1. Enter Model Name (e.g., gpt-4, mistral): ");
  const model_url = await ask("2. Enter Model Base URL (e.g., https://api.openai.com/v1): ");
  const model_api_key = await ask("3. Enter API Key: ");

  if (!model_name || !model_url || !model_api_key) {
    logger.error("\nError: All configuration fields are required.");
    rl.close();
    process.exit(1);
  }

  const config = { model_name, model_url, model_api_key };
  saveConfig(config);

  rl.close();
  logger.main("\nConfiguration successfully updated!\n");
}
