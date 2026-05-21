import fs from 'fs';

/**
 * Implementation of the readDir tool.
 * @param {Object} args Arguments from the model.
 * @param {string} args.dirPath Path to the directory.
 * @returns {Promise<string>} List of files and folders or error message.
 */
export default async function readDir({ dirPath }) {
  try {
    const items = fs.readdirSync(dirPath);
    return items.join('\n');
  } catch (err) {
    return `Error reading directory: ${err.message}`;
  }
}
