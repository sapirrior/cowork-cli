import fs from 'fs/promises';
import path from 'path';
import { getIgnorePatterns, shouldIgnore } from '../../utils/fsUtils.js';

const MAX_DEPTH = 10;
const MAX_ITEMS = 500;

/**
 * Generates a robust, visual tree of the project structure.
 * @param {Object} args Arguments.
 * @param {string} args.dirPath The root directory to start from.
 * @returns {Promise<string>} Tree-like string representation.
 */
export default async function projectTree({ dirPath }) {
  let itemCount = 0;
  let isTruncated = false;

  try {
    const absolutePath = path.resolve(dirPath);
    const stats = await fs.stat(absolutePath);
    
    if (!stats.isDirectory()) {
      return `Error: '${dirPath}' is not a directory.`;
    }

    const ignoreList = await getIgnorePatterns();

    async function buildTree(currentDir, depth = 0, currentPrefix = '') {
      if (depth > MAX_DEPTH || itemCount >= MAX_ITEMS) {
        if (itemCount >= MAX_ITEMS) isTruncated = true;
        return '';
      }

      let items;
      try {
        items = await fs.readdir(currentDir, { withFileTypes: true });
      } catch (err) {
        if (err.code === 'EACCES') return `${currentPrefix}└[Permission Denied]\n`;
        return `${currentPrefix}└[Error: ${err.code}]\n`;
      }

      const filteredItems = items
        .filter(item => !shouldIgnore(item.name, ignoreList))
        .sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) return -1;
          if (!a.isDirectory() && b.isDirectory()) return 1;
          return a.name.localeCompare(b.name);
        });

      let result = '';
      for (let i = 0; i < filteredItems.length; i++) {
        if (itemCount >= MAX_ITEMS) {
          isTruncated = true;
          break;
        }

        const item = filteredItems[i];
        const isLast = i === filteredItems.length - 1 || itemCount + 1 >= MAX_ITEMS;
        const marker = isLast ? '└' : '├';
        const childPrefix = isLast ? ' ' : '│';

        result += `${currentPrefix}${marker}${item.name}${item.isDirectory() ? '/' : ''}\n`;
        itemCount++;

        if (item.isDirectory()) {
          const fullPath = path.join(currentDir, item.name);
          result += await buildTree(fullPath, depth + 1, currentPrefix + childPrefix);
        }
      }
      return result;
    }

    const rootName = path.basename(absolutePath) || absolutePath;
    const tree = await buildTree(absolutePath);
    
    let finalOutput = `${rootName}/\n${tree || '└(empty)'}`;
    finalOutput = finalOutput.trimEnd();

    if (isTruncated) {
      finalOutput += `\n[Warning: Truncated at ${MAX_ITEMS} items]`;
    }

    return finalOutput;

  } catch (err) {
    if (err.code === 'ENOENT') return `Error: Directory not found at '${dirPath}'.`;
    return `Error generating tree: ${err.message}`;
  }
}
