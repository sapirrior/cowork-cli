import { logger } from '../utils/logger.js';

/**
 * Executes a chat completion query using the provided OpenAI client.
 * @param {import('openai').OpenAI} client The initialized OpenAI client.
 * @param {string} model The model identifier to use.
 * @param {string} query The user query string.
 */
export default async function runQuery(client, model, query) {
  if (!query) {
    logger.error("Error: No query provided.");
    return;
  }

  try {
    const stream = await client.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: query }],
      stream: true,
    });

    console.log(""); // Start with a newline for visual separation

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        process.stdout.write(content);
      }
    }

    process.stdout.write("\n\n");
  } catch (err) {
    logger.error(`\nError during AI execution: ${err.message}`);
    if (err.status === 401) {
      logger.secondary("Tip: Check if your API key is correct in 'btw --config'.");
    } else if (err.status === 404) {
      logger.secondary("Tip: The specified model or base URL might be incorrect.");
    }
  }
}
