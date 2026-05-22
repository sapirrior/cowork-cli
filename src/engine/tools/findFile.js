import fs from 'fs/promises';
import path from 'path';
import { getIgnorePatterns, shouldIgnore } from '../../utils/fsUtils.js';

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

    const ignoreList = await getIgnorePatterns();
    const results = [];
    let totalFound = 0;

    async function walk(currentPath) {
      if (results.length >= finalLimit) return;

      let items;
      try {
        items = await fs.readdir(currentPath, { withFileTypes: true });
      } catch (err) {
        return; // Skip unreadable directories
      }

      for (const item of items) {
        if (results.length >= finalLimit) break;
        if (shouldIgnore(item.name, ignoreList)) continue;

        const fullPath = path.join(currentPath, item.name);
        
        if (item.isDirectory()) {
          if (recursive) {
            await walk(fullPath);
          }
        } else if (item.isFile()) {
          if (regex.test(item.name)) {
            results.push(path.relative(process.cwd(), fullPath));
          }
        }
      }
    }

    await walk(dirPath);

    if (results.length === 0) {
      return `No files found matching pattern "${pattern}" in "${dirPath}".`;
    }

    let output = `FOUND FILES (${results.length}):\n${results.join('\n')}`;
    if (results.length >= finalLimit) {
      output += `\n[Warning: Results limited to ${finalLimit}. Try a more specific pattern.]`;
    }
    return output;

  } catch (err) {
    return `Error searching for files: ${err.message}`;
  }
}
