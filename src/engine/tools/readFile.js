import fs from 'fs';

/**
 * Implementation of the readFile tool.
 * @param {Object} args Arguments from the model.
 * @param {string} args.filePath Path to the file.
 * @returns {Promise<string>} File content or error message.
 */
export default async function readFile({ filePath }) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content;
  } catch (err) {
    return `Error reading file: ${err.message}`;
  }
}
