import fs from 'fs/promises';
import path from 'path';

const MAX_MATCHES_PER_FILE = 20;
const MAX_TOTAL_MATCHES = 100;
const DEFAULT_IGNORES = ['.git', 'node_modules', 'dist', 'build', '.npm'];

/**
 * Enhanced searchText tool with recursion, ignore rules, and safety limits.
 */
export default async function searchText({ pattern, path: searchPath, recursive = false }) {
  let totalMatches = 0;
  let isTruncated = false;

  try {
    const stats = await fs.stat(searchPath);
    let regex;
    try {
      regex = new RegExp(pattern, 'i');
    } catch (e) {
      return `Error: Invalid regex pattern '${pattern}': ${e.message}`;
    }

    // Load .gitignore if available
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    const ignoreList = [...DEFAULT_IGNORES];
    try {
      const gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
      const lines = gitignoreContent.split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'));
      ignoreList.push(...lines);
    } catch (e) {
      // .gitignore not found or unreadable, ignore
    }

    const results = [];

    const shouldIgnore = (name, fullPath) => {
      if (ignoreList.includes(name)) return true;
      // Simple prefix/match for gitignore-style patterns
      for (const ignore of ignoreList) {
        if (ignore.endsWith('/') && name === ignore.slice(0, -1)) return true;
        if (name === ignore) return true;
      }
      return false;
    };

    const walk = async (currentPath, depth = 0) => {
      if (totalMatches >= MAX_TOTAL_MATCHES) {
        isTruncated = true;
        return;
      }

      const items = await fs.readdir(currentPath, { withFileTypes: true });
      for (const item of items) {
        if (totalMatches >= MAX_TOTAL_MATCHES) {
          isTruncated = true;
          break;
        }

        const fullPath = path.join(currentPath, item.name);
        if (shouldIgnore(item.name, fullPath)) continue;

        if (item.isDirectory()) {
          if (recursive || depth === 0) {
            await walk(fullPath, depth + 1);
          }
        } else if (item.isFile()) {
          const fileMatches = await searchInFile(fullPath, regex);
          if (fileMatches.length > 0) {
            const allowedMatches = Math.min(fileMatches.length, MAX_TOTAL_MATCHES - totalMatches);
            const slice = fileMatches.slice(0, allowedMatches);
            results.push({
              file: path.relative(process.cwd(), fullPath),
              matches: slice
            });
            totalMatches += allowedMatches;
            if (fileMatches.length > allowedMatches || fileMatches.length > MAX_MATCHES_PER_FILE) {
              isTruncated = true;
            }
          }
        }
      }
    };

    if (stats.isFile()) {
      const fileMatches = await searchInFile(searchPath, regex);
      if (fileMatches.length > 0) {
        results.push({
          file: path.relative(process.cwd(), searchPath),
          matches: fileMatches.slice(0, MAX_MATCHES_PER_FILE)
        });
        totalMatches = Math.min(fileMatches.length, MAX_MATCHES_PER_FILE);
        if (fileMatches.length > MAX_MATCHES_PER_FILE) isTruncated = true;
      }
    } else {
      await walk(searchPath);
    }

    if (results.length === 0) return "No matches found.";

    let output = results.map(res => {
      return `--- ${res.file} ---\n${res.matches.join('\n')}`;
    }).join('\n\n');

    if (isTruncated) {
      output += `\n\n[Warning: Results truncated due to safety limits (Max ${MAX_TOTAL_MATCHES} total matches)]`;
    }

    return output;

  } catch (err) {
    return `Error searching text: ${err.message}`;
  }
}

async function searchInFile(filePath, regex) {
  try {
    // Basic check for binary files (search first 1KB for null bytes)
    const fd = await fs.open(filePath, 'r');
    const { buffer } = await fd.read(Buffer.alloc(1024), 0, 1024, 0);
    await fd.close();
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] === 0) return []; // Skip binary
    }

    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    const matches = [];
    
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        matches.push(`${i + 1}: ${lines[i].trim()}`);
        if (matches.length >= MAX_MATCHES_PER_FILE) break;
      }
    }
    return matches;
  } catch (err) {
    return []; // Skip files that can't be read
  }
}
