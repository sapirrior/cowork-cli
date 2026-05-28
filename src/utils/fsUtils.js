import fs from 'fs/promises';
import path from 'path';

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_IGNORES = [
  // VCS
  '.git', '.svn', '.hg',
  // Dependencies & build output
  'node_modules', 'dist', 'build', '.npm',
  // OS artifacts
  '.DS_Store', 'Thumbs.db',
  // Secrets — defense-in-depth even if .gitignore already covers them
  '.env', '.env.*',
  // Test / coverage artifacts
  'coverage', '__pycache__', '.cache',
  // IDE metadata
  '.vscode', '.idea',
];

const MAX_GITIGNORE_SIZE = 64 * 1024; // 64 KB

// ── Cache ────────────────────────────────────────────────────────────────────

let _cachedPatterns = null;

// ── Internal: Glob-to-RegExp (zero dependencies) ────────────────────────────

/**
 * Converts a gitignore-style glob pattern to a RegExp.
 * Supports `*`, `**`, `?`, and bracket classes `[abc]`.
 * @param {string} pattern
 * @returns {RegExp}
 */
function globToRegex(pattern) {
  let i = 0;
  let re = '';

  while (i < pattern.length) {
    const c = pattern[i];

    if (c === '*') {
      if (pattern[i + 1] === '*') {
        // `**` — match everything including path separators
        re += '.*';
        i += 2;
        if (pattern[i] === '/') i++;        // consume optional trailing `/`
        continue;
      }
      re += '[^/]*';                         // `*` — any non-separator chars
    } else if (c === '?') {
      re += '[^/]';                          // `?` — single non-separator char
    } else if (c === '[') {
      // Bracket expression — locate the closing `]`
      let j = i + 1;
      if (j < pattern.length && pattern[j] === '!') j++;
      if (j < pattern.length && pattern[j] === ']') j++;
      while (j < pattern.length && pattern[j] !== ']') j++;

      if (j >= pattern.length) {
        re += '\\[';                         // no closing bracket → literal `[`
      } else {
        let cls = pattern.slice(i + 1, j).replace(/\\/g, '\\\\');
        if (cls[0] === '!') cls = '^' + cls.slice(1);
        re += `[${cls}]`;
        i = j;                               // advance past `]`
      }
    } else if ('.+^${}()|\\'.includes(c)) {
      re += '\\' + c;                        // escape regex meta chars
    } else {
      re += c;
    }
    i++;
  }

  return new RegExp(`^${re}$`);
}

// ── Internal: .gitignore Parser ──────────────────────────────────────────────

/**
 * Parses raw `.gitignore` content into structured pattern objects.
 * Handles: comments, blank lines, negation (`!`), directory-only (`/`),
 *          Windows `\r` line endings, and glob detection.
 * @param {string} content
 * @returns {Object[]}
 */
function parseGitignoreContent(content) {
  const patterns = [];

  for (const raw of content.split('\n')) {
    let line = raw.replace(/\r$/, '').trim();   // strip Windows CR
    if (!line || line.startsWith('#')) continue; // skip blanks & comments

    // Negation
    let negated = false;
    if (line.startsWith('!')) {
      negated = true;
      line = line.slice(1).trim();
      if (!line) continue;
    }

    // Directory-only marker
    const dirOnly = line.endsWith('/');
    if (dirOnly) line = line.slice(0, -1);

    const hasGlob = /[*?[\]]/.test(line);
    const hasSlash = line.includes('/');

    patterns.push({
      pattern: line,
      negated,
      dirOnly,
      hasGlob,
      hasSlash,
      regex: hasGlob ? globToRegex(line) : null,
    });
  }

  return patterns;
}

/**
 * Builds structured pattern objects from a plain-string array
 * (used for the hard-coded DEFAULT_IGNORES list).
 * @param {string[]} list
 * @returns {Object[]}
 */
function buildPatterns(list) {
  return list.map(raw => {
    const dirOnly = raw.endsWith('/');
    const cleaned = dirOnly ? raw.slice(0, -1) : raw;
    const hasGlob = /[*?[\]]/.test(cleaned);
    return {
      pattern: cleaned,
      negated: false,
      dirOnly,
      hasGlob,
      hasSlash: cleaned.includes('/'),
      regex: hasGlob ? globToRegex(cleaned) : null,
    };
  });
}

// ── Internal: .gitignore Loader ──────────────────────────────────────────────

/**
 * Reads and parses the `.gitignore` file inside a directory.
 * Returns an empty array if the file is missing, unreadable, or oversized.
 * @param {string} dirPath Absolute directory path.
 * @returns {Promise<Object[]>}
 */
async function loadGitignoreFromDir(dirPath) {
  try {
    const gitignorePath = path.join(dirPath, '.gitignore');
    const stats = await fs.stat(gitignorePath);
    if (stats.size > MAX_GITIGNORE_SIZE) return [];

    const content = await fs.readFile(gitignorePath, 'utf8');
    return parseGitignoreContent(content);
  } catch {
    return [];
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Loads ignore patterns from `DEFAULT_IGNORES` + the root `.gitignore`.
 * Results are cached for the lifetime of the process.
 * @returns {Promise<Object[]>} Structured pattern objects.
 */
export async function getIgnorePatterns() {
  if (_cachedPatterns) return _cachedPatterns;

  const defaults = buildPatterns(DEFAULT_IGNORES);
  const gitignore = await loadGitignoreFromDir(process.cwd());

  _cachedPatterns = [...defaults, ...gitignore];
  return _cachedPatterns;
}

/**
 * Loads additional `.gitignore` patterns from a nested directory and
 * merges them **after** the parent list so they can override via negation.
 * @param {string} dirPath     Absolute path of the directory to inspect.
 * @param {Object[]} parentList Patterns inherited from the parent scope.
 * @returns {Promise<Object[]>} Merged pattern list (parent + nested).
 */
export async function loadNestedIgnores(dirPath, parentList) {
  const nested = await loadGitignoreFromDir(dirPath);
  if (nested.length === 0) return parentList;
  return [...parentList, ...nested];
}

/**
 * Invalidates the cached ignore patterns.
 */
export function clearIgnoreCache() {
  _cachedPatterns = null;
}

/**
 * Checks if a name should be ignored.
 *
 * Pattern evaluation order matters — patterns are processed sequentially
 * and the **last matching pattern wins**.  Negation patterns (`!`) can
 * therefore un-ignore a previously ignored name.
 *
 * @param {string}   name       Item basename.
 * @param {Object[]} ignoreList Structured pattern objects.
 * @param {Object}   [options]
 * @param {boolean}  [options.isDirectory] Whether the item is a directory.
 *                   When omitted, directory-only patterns match regardless
 *                   (backward-compatible with existing callers).
 * @returns {boolean} `true` if the item should be skipped.
 */
export function shouldIgnore(name, ignoreList, options = {}) {
  const { isDirectory } = options;
  let ignored = false;

  for (const entry of ignoreList) {
    // Path-containing patterns (e.g. `docs/internal`) require full
    // relative-path matching which callers don't supply — skip them.
    if (entry.hasSlash) continue;

    // Directory-only patterns (`build/`) don't apply to files.
    // When `isDirectory` is undefined the caller didn't say, so we match
    // to preserve backward compat with callers that only pass basenames.
    if (entry.dirOnly && isDirectory === false) continue;

    const matches = entry.hasGlob && entry.regex
      ? entry.regex.test(name)
      : name === entry.pattern;

    if (matches) {
      ignored = !entry.negated;
    }
  }

  return ignored;
}

/**
 * Resolves a path and verifies it stays within `process.cwd()`.
 * Prevents directory-traversal attacks (e.g. `../../etc/passwd`).
 *
 * @param {string} inputPath The user- or model-supplied path.
 * @returns {string} Resolved absolute path guaranteed to be inside the project.
 * @throws {Error}  If the resolved path escapes the project root.
 */
export function safePath(inputPath) {
  const root = process.cwd();
  const resolved = path.resolve(root, inputPath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Access denied: '${inputPath}' resolves outside the project directory.`);
  }
  return resolved;
}

/**
 * Decides whether a directory entry is safe to traverse / read.
 *
 * Rejects:
 *  1. Symbolic links (could escape the project sandbox).
 *  2. Names matched by the ignore list.
 *  3. Paths that resolve outside `process.cwd()`.
 *
 * @param {import('fs').Dirent} dirent      Directory entry from `readdir`.
 * @param {string}              parentPath  Absolute path of the parent dir.
 * @param {Object[]}            ignoreList  Structured pattern objects.
 * @returns {boolean} `true` when the entry is safe to process.
 */
export function isSafeEntry(dirent, parentPath, ignoreList) {
  if (dirent.isSymbolicLink()) return false;

  const isDir = dirent.isDirectory();
  if (shouldIgnore(dirent.name, ignoreList, { isDirectory: isDir })) return false;

  const resolved = path.resolve(parentPath, dirent.name);
  const root = process.cwd();
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return false;

  return true;
}
