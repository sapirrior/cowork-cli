import fs from 'fs/promises';
import path from 'path';

const DEFAULT_IGNORES = ['.git', 'node_modules', 'dist', 'build', '.npm', '.DS_Store'];

/**
 * Loads .gitignore patterns from the current working directory.
 * @returns {Promise<string[]>} Array of ignore patterns.
 */
export async function getIgnorePatterns() {
  const ignoreList = [...DEFAULT_IGNORES];
  try {
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    const content = await fs.readFile(gitignorePath, 'utf8');
    const lines = content.split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'));
    ignoreList.push(...lines);
  } catch (e) {
    // Ignore if not found or unreadable
  }
  return ignoreList;
}

/**
 * Checks if a file or directory should be ignored.
 * @param {string} name Item name.
 * @param {string[]} ignoreList List of patterns.
 * @returns {boolean}
 */
export function shouldIgnore(name, ignoreList) {
  for (const ignore of ignoreList) {
    const pattern = ignore.endsWith('/') ? ignore.slice(0, -1) : ignore;
    if (name === pattern) return true;
  }
  return false;
}
