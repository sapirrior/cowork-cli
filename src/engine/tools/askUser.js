import { ui } from '../../utils/ui.js';

/**
 * Implementation of the askUser tool.
 * Delegates rendering and input handling to the UIEngine singleton.
 *
 * @param {Object} args
 * @param {string} args.question  The question to ask the user.
 * @returns {Promise<string>}     JSON string: { answer } or { error, dismissed }.
 */
export default async function askUser({ question }) {
  // 1. Input validation
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return JSON.stringify({ error: "'question' must be a non-empty string.", dismissed: true });
  }

  // 2. TTY check
  if (!process.stdin.isTTY) {
    return JSON.stringify({ error: 'stdin is not a TTY. Cannot prompt in non-interactive environments.', dismissed: true });
  }

  try {
    const answer = await ui.ask(question);
    return JSON.stringify({ answer });
  } catch (err) {
    // ui.ask() rejects with { cancelled: true } on SIGINT, or an Error otherwise.
    if (err && err.cancelled) {
      return JSON.stringify({ error: 'User cancelled the request.', dismissed: true });
    }
    return JSON.stringify({ error: `System Error: ${err.message}`, dismissed: true });
  }
}
