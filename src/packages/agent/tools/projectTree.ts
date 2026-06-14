import fs from 'fs/promises';
import path from 'path';
import { getIgnorePatterns, isSafeEntry, loadNestedIgnores, safePath, IgnorePattern } from '../../utils/index.js';

const MAX_DEPTH = 10;
const MAX_ITEMS = 500;

/**
 * Generates a robust, visual tree of the project structure.
 * @param {Object} args Arguments.
 * @param {string} args.dirPath The root directory to start from.
 * @returns {Promise<string>} Tree-like string representation.
 */
interface ProjectTreeArgs {
  dirPath: string;
}

export default async function projectTree({ dirPath }: ProjectTreeArgs): Promise<string> {
  let itemCount = 0;
  let isTruncated = false;

  let absolutePath: string;
  try {
    absolutePath = safePath(dirPath);
  } catch (err: any) {
    return `Error: ${err.message}`;
  }

  try {
    const stats = await fs.stat(absolutePath);

    if (!stats.isDirectory()) {
      return `Error: '${dirPath}' is not a directory.`;
    }

    const rootIgnoreList = await getIgnorePatterns();

    async function buildTree(
      currentDir: string,
      depth: number = 0,
      currentPrefix: string = '',
      ignoreList: IgnorePattern[] = rootIgnoreList
    ): Promise<string> {
      if (depth > MAX_DEPTH || itemCount >= MAX_ITEMS) {
        if (itemCount >= MAX_ITEMS) isTruncated = true;
        return '';
      }

      let items;
      try {
        items = await fs.readdir(currentDir, { withFileTypes: true });
      } catch (err: any) {
        if (err.code === 'EACCES') return `${currentPrefix}└[Permission Denied]\n`;
        return `${currentPrefix}└[Error: ${err.code}]\n`;
      }

      const filteredItems = items
        .filter(item => isSafeEntry(item, currentDir, ignoreList))
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
          const childIgnores = await loadNestedIgnores(fullPath, ignoreList);
          result += await buildTree(fullPath, depth + 1, currentPrefix + childPrefix, childIgnores);
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

  } catch (err: any) {
    if (err.code === 'ENOENT') return `Error: Directory not found at '${dirPath}'.`;
    return `Error generating tree: ${err.message}`;
  }
}
