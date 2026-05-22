import readlinePromises from 'readline/promises';
import readline from 'readline';
import { stdin as input, stdout as output } from 'process';
import { formatSecondary } from '../../utils/logger.js';

/**
 * Implementation of the askUser tool.
 * Asks the user a single question via the terminal.
 * 
 * @param {Object} args
 * @param {string} args.question The question to ask the user.
 * @returns {Promise<string>} JSON string with answer or error.
 */
export default async function askUser({ question }) {
  // 1. Input Validation
  if (!question) {
    return "Error: 'question' parameter is required.";
  }
  
  if (typeof question !== 'string' || question.trim().length === 0) {
    return "Error: 'question' must be a non-empty string.";
  }

  // 2. TTY Check: Ensure we have a terminal to interact with
  if (!input.isTTY) {
    return "Error: stdin is not a TTY. Cannot prompt user in non-interactive environments.";
  }

  const rl = readlinePromises.createInterface({ input, output });

  return new Promise((resolve) => {
    // 3. Graceful Signal Handling
    rl.on('SIGINT', () => {
      rl.close();
      process.stdout.write(formatSecondary(` cancelled\n`));
      resolve(JSON.stringify({ error: "user cancelled the request", dismissed: true }));
    });

    const doAsk = async () => {
      try {
        const answer = await rl.question(formatSecondary(`[asking] ${question} -> `));
        const trimmed = answer.trim();

        if (trimmed.length === 0) {
          // Move cursor up and clear line reliably using Node's readline methods
          readline.moveCursor(process.stdout, 0, -1);
          readline.clearLine(process.stdout, 0);
          readline.cursorTo(process.stdout, 0);
          doAsk();
        } else {
          rl.close();
          resolve(JSON.stringify({ answer: trimmed }));
        }
      } catch (err) {
        rl.close();
        resolve(JSON.stringify({ error: `System Error: ${err.message}`, dismissed: true }));
      }
    };

    doAsk();
  });
}
