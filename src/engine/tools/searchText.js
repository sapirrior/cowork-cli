import fs from 'fs';
import path from 'path';

/**
 * Implementation of the searchText tool.
 * Performs a non-recursive search in a file or folder.
 * @param {Object} args Arguments from the model.
 * @param {string} args.pattern The regex or text pattern to search for.
 * @param {string} args.path Path to a file or directory.
 * @returns {Promise<string>} Search results or error message.
 */
export default async function searchText({ pattern, path: searchPath }) {
  try {
    const stats = fs.statSync(searchPath);
    const regex = new RegExp(pattern, 'i');

    if (stats.isFile()) {
      return searchInFile(searchPath, regex);
    } else if (stats.isDirectory()) {
      const items = fs.readdirSync(searchPath);
      let results = [];
      for (const item of items) {
        const fullPath = path.join(searchPath, item);
        const itemStats = fs.statSync(fullPath);
        if (itemStats.isFile()) {
          const fileResult = searchInFile(fullPath, regex);
          if (fileResult) {
            results.push(`--- ${item} ---\n${fileResult}`);
          }
        }
      }
      return results.length > 0 ? results.join('\n\n') : "No matches found.";
    }
  } catch (err) {
    return `Error searching text: ${err.message}`;
  }
}

function searchInFile(filePath, regex) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const matches = lines
    .map((line, index) => (regex.test(line) ? `${index + 1}: ${line}` : null))
    .filter(line => line !== null);
  return matches.length > 0 ? matches.join('\n') : null;
}
