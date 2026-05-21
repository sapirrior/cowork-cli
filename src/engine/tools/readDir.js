import fs from 'fs/promises';
import { getIgnorePatterns, shouldIgnore } from '../../utils/fsUtils.js';

/**
 * Implementation of the readDir tool.
 * @param {Object} args Arguments from the model.
 * @param {string} args.dirPath Path to the directory.
 * @returns {Promise<string>} List of files and folders or error message.
 */
export default async function readDir({ dirPath }) {
  try {
    const ignoreList = await getIgnorePatterns();
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    
    const formattedItems = items
      .filter(item => !shouldIgnore(item.name, ignoreList))
      .map(item => {
        const type = item.isDirectory() ? '[DIR] ' : '[FILE]';
        return `${type} ${item.name}`;
      });

    if (formattedItems.length === 0) {
      return `Directory '${dirPath}' is empty (or all items are ignored).`;
    }

    return formattedItems.join('\n');
  } catch (err) {
    if (err.code === 'ENOENT') return `Error: Directory not found at '${dirPath}'.`;
    if (err.code === 'ENOTDIR') return `Error: '${dirPath}' is not a directory.`;
    return `Error reading directory: ${err.message}`;
  }
}
