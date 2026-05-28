import fs from 'fs/promises';
import path from 'path';
import { getIgnorePatterns, isSafeEntry, loadNestedIgnores, safePath } from '../../utils/fsUtils.js';

/**
 * findFile tool: Finds files by name using regex.
 * @param {Object} args
 * @param {string} args.pattern Regex pattern to match filenames.
 * @param {string} args.dirPath Root directory to search (default: current directory).
 * @param {boolean} args.recursive Whether to search subdirectories (default: true).
 * @param {number} args.limit Maximum number of results (default: 15, max: 15).
 */
export default async function findFile({ pattern, dirPath = '.', recursive = true, limit = 15 }) {
  try {
    if (!pattern) return "Error: Search pattern cannot be empty.";

    // Enforce max limit of 15
    const finalLimit = Math.min(limit, 15);

    let regex;
    try {
      regex = new RegExp(pattern, 'i');
    } catch (e) {
      return `Error: Invalid regex pattern '${pattern}': ${e.message}`;
    }

    let resolvedPath;
    try {
      resolvedPath = safePath(dirPath);
    } catch (err) {
      return `Error: ${err.message}`;
    }

    const rootIgnoreList = await getIgnorePatterns();
    const results = [];

    async function walk(currentPath, ignoreList) {
      if (results.length >= finalLimit) return;

      let items;
      try {
        items = await fs.readdir(currentPath, { withFileTypes: true });
      } catch (err) {
        return; // Skip unreadable directories
      }

      for (const item of items) {
        if (results.length >= finalLimit) break;
        if (!isSafeEntry(item, currentPath, ignoreList)) continue;

        const fullPath = path.join(currentPath, item.name);

        if (item.isDirectory()) {
          if (recursive) {
            const childIgnores = await loadNestedIgnores(fullPath, ignoreList);
            await walk(fullPath, childIgnores);
          }
        } else if (item.isFile()) {
          if (regex.test(item.name)) {
            results.push(path.relative(process.cwd(), fullPath));
          }
        }
      }
    }

    await walk(resolvedPath, rootIgnoreList);

    if (results.length === 0) {
      return `No files found matching "${pattern}" in "${dirPath}".`;
    }

    let output = results.join('\n');
    if (results.length >= finalLimit) {
      output += `\n[Warning: Truncated at ${finalLimit} matches]`;
    }
    return output;

  } catch (err) {
    return `Error searching for files: ${err.message}`;
  }
}
