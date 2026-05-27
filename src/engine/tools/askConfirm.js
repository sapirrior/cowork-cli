import { ui } from '../../utils/ui.js';

/**
 * askConfirm tool — asks the user a yes/no question via the terminal.
 *
 * Accepted inputs (case-insensitive):
 *   yes → y, yes
 *   no  → n, no
 *   cancel → Ctrl+C (treated as no, with dismissed flag)
 *
 * Any other input is silently erased and the prompt re-appears.
 *
 * @param {Object} args
 * @param {string} args.question  The yes/no question to ask.
 * @returns {Promise<string>}     JSON: { confirmed } or { confirmed, dismissed }
 */
export default async function askConfirm({ question }) {
  // 1. Input validation
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return JSON.stringify({ error: "'question' must be a non-empty string.", dismissed: true });
  }

  // 2. TTY guard — cannot prompt in pipes or CI environments
  if (!process.stdin.isTTY) {
    return JSON.stringify({
      error: 'stdin is not a TTY. Cannot prompt in non-interactive environments.',
      dismissed: true,
    });
  }

  // 3. Delegate entirely to UIEngine — it owns all terminal state
  const result = await ui.confirm(question);
  return JSON.stringify(result);
}
