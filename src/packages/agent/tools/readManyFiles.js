import fs from 'fs/promises';
import path from 'path';
import { Buffer } from 'buffer';
import { getIgnorePatterns, isSafeEntry, loadNestedIgnores, safePath } from '../../utils/index.js';

const MAX_DEPTH = 10;
const MAX_FILES = 30;
const MAX_FILE_SIZE = 64 * 1024; // 64 KB individual file size limit
const MAX_TOTAL_SIZE = 300 * 1024; // 300 KB total content ceiling

/**
 * Converts a glob pattern into a RegExp.
 * Normalizes slashes and translates '*' and '**' wildcards.
 * @param {string} pattern Glob pattern.
 * @returns {RegExp} RegExp matching the glob pattern.
 */
function compileGlob(pattern) {
  let re = '';
  let i = 0;
  const norm = pattern.replace(/\\/g, '/');
  
  while (i < norm.length) {
    const c = norm[i];
    if (c === '*') {
      if (norm[i + 1] === '*') {
        re += '.*';
        i += 2;
        if (norm[i] === '/') i++; // consume trailing slash
        continue;
      }
      re += '[^/]*';
    } else if (c === '?') {
      re += '[^/]';
    } else if ('.+^${}()|\\'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
    i++;
  }
  return new RegExp(`^${re}$`, 'i');
}

/**
 * readManyFiles tool: reads and concatenates the content of multiple text files matching include/exclude glob patterns.
 * @param {Object} args Arguments from the model.
 * @param {string[]} args.include Glob patterns of files to read.
 * @param {string[]} [args.exclude=[]] Glob patterns of files to ignore.
 * @param {boolean} [args.useDefaultExcludes=true] Whether to apply default ignores.
 * @param {boolean} [args.respectGitIgnore=true] Whether to apply .gitignore patterns.
 */
export default async function readManyFiles({
  include,
  exclude = [],
  useDefaultExcludes = true,
  respectGitIgnore = true
}) {
  if (!include || !Array.isArray(include) || include.length === 0) {
    return "Error: The 'include' parameter must be a non-empty array of glob patterns.";
  }

  const includeRegexes = include.map(compileGlob);
  const excludeRegexes = Array.isArray(exclude) ? exclude.map(compileGlob) : [];

  const root = process.cwd();
  const filesToConsider = new Set();
  const skippedFiles = [];

  let rootIgnoreList = [];
  if (respectGitIgnore || useDefaultExcludes) {
    rootIgnoreList = await getIgnorePatterns();
  }

  const walk = async (currentPath, depth = 0, ignoreList = rootIgnoreList) => {
    if (depth > MAX_DEPTH) return;

    let items;
    try {
      items = await fs.readdir(currentPath, { withFileTypes: true });
    } catch (err) {
      return; // Skip directories that cannot be read
    }

    for (const item of items) {
      const fullPath = path.join(currentPath, item.name);
      
      // Basic safety: reject symbolic links or directory escapes
      if (item.isSymbolicLink()) continue;
      try {
        safePath(fullPath);
      } catch (err) {
        continue;
      }

      // Respect gitignore / default ignore lists if enabled
      if ((respectGitIgnore || useDefaultExcludes) && !isSafeEntry(item, currentPath, ignoreList)) {
        continue;
      }

      if (item.isDirectory()) {
        const childIgnores = (respectGitIgnore || useDefaultExcludes)
          ? await loadNestedIgnores(fullPath, ignoreList)
          : [];
        await walk(fullPath, depth + 1, childIgnores);
      } else if (item.isFile()) {
        const relativePath = path.relative(root, fullPath).replace(/\\/g, '/');

        // Check if it fits any include glob pattern
        const isIncluded = includeRegexes.some(rx => rx.test(relativePath));
        if (!isIncluded) continue;

        // Check if it fits any exclude glob pattern
        const isExcluded = excludeRegexes.some(rx => rx.test(relativePath));
        if (isExcluded) {
          skippedFiles.push({ path: relativePath, reason: 'Excluded by exclude pattern' });
          continue;
        }

        filesToConsider.add(fullPath);
      }
    }
  };

  await walk(root, 0, rootIgnoreList);

  if (filesToConsider.size === 0) {
    return "No matching files found.";
  }

  const sortedFiles = Array.from(filesToConsider).sort();
  const processedFiles = [];
  let totalOutput = "";
  let totalSize = 0;
  let fileCount = 0;

  for (const filePath of sortedFiles) {
    const relativePath = path.relative(root, filePath).replace(/\\/g, '/');

    if (fileCount >= MAX_FILES) {
      skippedFiles.push({ path: relativePath, reason: `Skipped: maximum file count limit (${MAX_FILES}) reached` });
      continue;
    }

    if (totalSize >= MAX_TOTAL_SIZE) {
      skippedFiles.push({ path: relativePath, reason: 'Skipped: total content size limit reached' });
      continue;
    }

    // Binary check: read first 1KB and scan for null bytes
    let isBinary = false;
    let handle;
    try {
      handle = await fs.open(filePath, 'r');
      const { bytesRead, buffer } = await handle.read(Buffer.alloc(1024), 0, 1024, 0);
      for (let i = 0; i < bytesRead; i++) {
        if (buffer[i] === 0) {
          isBinary = true;
          break;
        }
      }
    } catch (err) {
      skippedFiles.push({ path: relativePath, reason: `Failed to open: ${err.message}` });
      continue;
    } finally {
      if (handle) await handle.close();
    }

    // Asset safety check: Skip binary files unless explicitly requested by name or extension in the include list
    if (isBinary) {
      const fileExtension = path.extname(filePath).toLowerCase();
      const fileNameWithoutExtension = path.basename(filePath, fileExtension);
      const requestedExplicitly = include.some(
        pattern => pattern.toLowerCase().includes(fileExtension) || pattern.includes(fileNameWithoutExtension)
      );

      if (!requestedExplicitly) {
        skippedFiles.push({ path: relativePath, reason: 'Binary asset not explicitly requested' });
        continue;
      }
    }

    // Read file contents (handling optional truncation at MAX_FILE_SIZE)
    let content;
    let truncated = false;
    try {
      const stats = await fs.stat(filePath);
      if (stats.size > MAX_FILE_SIZE) {
        const fh = await fs.open(filePath, 'r');
        const buffer = Buffer.alloc(MAX_FILE_SIZE);
        const { bytesRead } = await fh.read(buffer, 0, MAX_FILE_SIZE, 0);
        await fh.close();
        content = buffer.toString('utf8', 0, bytesRead);
        truncated = true;
      } else {
        content = await fs.readFile(filePath, 'utf8');
      }
    } catch (err) {
      skippedFiles.push({ path: relativePath, reason: `Failed to read: ${err.message}` });
      continue;
    }

    let fileContent = `--- ${relativePath} ---\n`;
    if (truncated) {
      fileContent += `[WARNING: This file was truncated because it exceeded the 64KB limit. Use 'readFileChunk' to inspect further.]\n`;
    }
    fileContent += content.trim() + "\n\n";

    totalOutput += fileContent;
    totalSize += fileContent.length;
    processedFiles.push(relativePath);
    fileCount++;
  }

  let finalOutput = totalOutput.trim();

  // If there are skipped files, append the summary details
  if (skippedFiles.length > 0) {
    const skipSummaries = skippedFiles.map(f => `- ${f.path} (${f.reason})`).join('\n');
    finalOutput += `\n\n[Summary: Processed ${fileCount} files successfully. Skipped/ignored ${skippedFiles.length} files:\n${skipSummaries}]`;
  }

  return finalOutput;
}
