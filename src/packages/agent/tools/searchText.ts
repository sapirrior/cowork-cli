import fs from 'fs/promises';
import path from 'path';
import { Buffer } from 'buffer';
import { getIgnorePatterns, isSafeEntry, loadNestedIgnores, safePath } from '../../utils/index.js';

const MAX_MATCHES_PER_FILE = 20;
const MAX_TOTAL_MATCHES = 100;
const MAX_DEPTH = 10;
const CONTEXT_LINES = 2;

/**
 * Enhanced searchText tool with recursion, ignore rules, and safety limits.
 */
interface SearchTextArgs {
  pattern: string;
  path: string;
  recursive?: boolean;
  context?: number;
}

export default async function searchText({
  pattern,
  path: searchPath,
  recursive = false,
  context = CONTEXT_LINES
}: SearchTextArgs): Promise<string> {
  let totalMatches = 0;
  let isTruncated = false;

  let resolvedPath: string;
  try {
    resolvedPath = safePath(searchPath);
  } catch (err: any) {
    return `Error: ${err.message}`;
  }

  try {
    const stats = await fs.stat(resolvedPath);
    if (!pattern) return "Error: Search pattern cannot be empty.";

    let regex: RegExp;
    try {
      regex = new RegExp(pattern, 'i');
    } catch (e: any) {
      return `Error: Invalid regex pattern '${pattern}': ${e.message}`;
    }

    const rootIgnoreList = await getIgnorePatterns();
    const results: { file: string; blocks: string[] }[] = [];

    const walk = async (currentPath: string, depth = 0, ignoreList = rootIgnoreList): Promise<void> => {
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
          const allowed = MAX_TOTAL_MATCHES - totalMatches;
          const fileMatches = await searchInFile(fullPath, regex, context);
          if (fileMatches.length > 0) {
            const allowedInFile = Math.min(fileMatches.length, allowed);
            results.push({
              file: path.relative(process.cwd(), fullPath),
              blocks: fileMatches.slice(0, allowedInFile)
            });
            totalMatches += allowedInFile;
            if (fileMatches.length > allowedInFile) isTruncated = true;
          }
        }
      }
    };

    if (stats.isFile()) {
      const fileMatches = await searchInFile(resolvedPath, regex, context);
      if (fileMatches.length > 0) {
        const allowed = Math.min(fileMatches.length, MAX_TOTAL_MATCHES);
        results.push({
          file: path.relative(process.cwd(), resolvedPath),
          blocks: fileMatches.slice(0, allowed)
        });
        totalMatches = allowed;
        if (fileMatches.length > allowed) isTruncated = true;
      }
    } else {
      await walk(resolvedPath);
    }

    if (results.length === 0) return "No matches found.";

    let output = results.map(res => {
      return `[${res.file}]\n${res.blocks.join('\n---\n')}`;
    }).join('\n');

    if (isTruncated) {
      output += `\n[Warning: Truncated at ${MAX_TOTAL_MATCHES} matches]`;
    }

    return output;

  } catch (err: any) {
    if (err.code === 'ENOENT') return `Error: Path not found at '${searchPath}'.`;
    return `Error searching text: ${err.message}`;
  }
}

interface Block {
  start: number;
  end: number;
  matchIndices: Set<number>;
}

async function searchInFile(filePath: string, regex: RegExp, contextLines = CONTEXT_LINES): Promise<string[]> {
  const CTX = Math.min(Math.max(0, contextLines), 5);

  try {
    // Binary check — read first 1KB
    const handle = await fs.open(filePath, 'r');
    const { bytesRead, buffer } = await handle.read(Buffer.alloc(1024), 0, 1024, 0);
    await handle.close();

    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0) return []; // Skip binary
    }

    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n');

    // Collect all matching line indices (0-based)
    const matchIndices: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        matchIndices.push(i);
        if (matchIndices.length >= MAX_MATCHES_PER_FILE * 3) break; // Internal safety cap
      }
    }

    if (matchIndices.length === 0) return [];

    // Build context windows, merging overlapping ones
    const blocks: string[] = [];
    let currentBlock: Block | null = null;

    for (const idx of matchIndices) {
      const start = Math.max(0, idx - CTX);
      const end = Math.min(lines.length - 1, idx + CTX);

      if (currentBlock && start <= currentBlock.end + 1) {
        // Overlapping or adjacent — merge into current block
        currentBlock.end = Math.max(currentBlock.end, end);
        currentBlock.matchIndices.add(idx);
      } else {
        if (currentBlock) blocks.push(formatBlock(lines, currentBlock));
        if (blocks.length >= MAX_MATCHES_PER_FILE) break;
        currentBlock = { start, end, matchIndices: new Set([idx]) };
      }
    }
    if (currentBlock && blocks.length < MAX_MATCHES_PER_FILE) {
      blocks.push(formatBlock(lines, currentBlock));
    }

    return blocks;
  } catch (err) {
    return [];
  }
}

function formatBlock(lines: string[], block: Block): string {
  let output = "";
  for (let i = block.start; i <= block.end; i++) {
    const prefix = block.matchIndices.has(i) ? "► " : "  ";
    output += `${i + 1}:${prefix}${lines[i]}\n`;
  }
  return output.trim();
}

