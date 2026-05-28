import fs from 'fs/promises';
import path from 'path';
import { Buffer } from 'buffer';
import { getIgnorePatterns, isSafeEntry, loadNestedIgnores, safePath } from '../../utils/fsUtils.js';

const MAX_MATCHES_PER_FILE = 20;
const MAX_TOTAL_MATCHES = 100;
const MAX_DEPTH = 10;

/**
 * Enhanced searchText tool with recursion, ignore rules, and safety limits.
 */
export default async function searchText({ pattern, path: searchPath, recursive = false }) {
  let totalMatches = 0;
  let isTruncated = false;

  let resolvedPath;
  try {
    resolvedPath = safePath(searchPath);
  } catch (err) {
    return `Error: ${err.message}`;
  }

  try {
    const stats = await fs.stat(resolvedPath);
    if (!pattern) return "Error: Search pattern cannot be empty.";

    let regex;
    try {
      regex = new RegExp(pattern, 'i');
    } catch (e) {
      return `Error: Invalid regex pattern '${pattern}': ${e.message}`;
    }

    const rootIgnoreList = await getIgnorePatterns();
    const results = [];

    const walk = async (currentPath, depth = 0, ignoreList = rootIgnoreList) => {
      if (totalMatches >= MAX_TOTAL_MATCHES) {
        isTruncated = true;
        return;
      }

      if (depth > MAX_DEPTH) return;

      let items;
      try {
        items = await fs.readdir(currentPath, { withFileTypes: true });
      } catch (err) {
        return; // Skip unreadable directories
      }

      for (const item of items) {
        if (totalMatches >= MAX_TOTAL_MATCHES) {
          isTruncated = true;
          break;
        }

        if (!isSafeEntry(item, currentPath, ignoreList)) continue;

        const fullPath = path.join(currentPath, item.name);

        if (item.isDirectory()) {
          if (recursive || depth === 0) {
            const childIgnores = await loadNestedIgnores(fullPath, ignoreList);
            await walk(fullPath, depth + 1, childIgnores);
          }
        } else if (item.isFile()) {
          const fileMatches = await searchInFile(fullPath, regex);
          if (fileMatches.length > 0) {
            const allowedInFile = Math.min(fileMatches.length, MAX_TOTAL_MATCHES - totalMatches);
            results.push({
              file: path.relative(process.cwd(), fullPath),
              matches: fileMatches.slice(0, allowedInFile)
            });
            totalMatches += allowedInFile;
            if (fileMatches.length > allowedInFile) isTruncated = true;
          }
        }
      }
    };

    if (stats.isFile()) {
      const fileMatches = await searchInFile(resolvedPath, regex);
      if (fileMatches.length > 0) {
        const allowed = Math.min(fileMatches.length, MAX_TOTAL_MATCHES);
        results.push({
          file: path.relative(process.cwd(), resolvedPath),
          matches: fileMatches.slice(0, allowed)
        });
        totalMatches = allowed;
        if (fileMatches.length > allowed) isTruncated = true;
      }
    } else {
      await walk(resolvedPath);
    }

    if (results.length === 0) return "No matches found.";

    let output = results.map(res => {
      return `[${res.file}]\n${res.matches.join('\n')}`;
    }).join('\n');

    if (isTruncated) {
      output += `\n[Warning: Truncated at ${MAX_TOTAL_MATCHES} matches]`;
    }

    return output;

  } catch (err) {
    if (err.code === 'ENOENT') return `Error: Path not found at '${searchPath}'.`;
    return `Error searching text: ${err.message}`;
  }
}

async function searchInFile(filePath, regex) {
  try {
    const handle = await fs.open(filePath, 'r');
    const { bytesRead, buffer } = await handle.read(Buffer.alloc(1024), 0, 1024, 0);
    await handle.close();

    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0) return []; // Skip binary
    }

    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    const matches = [];

    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        matches.push(`${i + 1}:${lines[i].trim()}`);
        if (matches.length >= MAX_MATCHES_PER_FILE) break;
      }
    }
    return matches;
  } catch (err) {
    return [];
  }
}
