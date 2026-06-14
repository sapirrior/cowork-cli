import fs from 'fs/promises';
import path from 'path';
import { Dirent } from 'fs';

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_IGNORES: string[] = [
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

const MAX_GITIGNORE_SIZE: number = 64 * 1024; // 64 KB

// ── Cache ────────────────────────────────────────────────────────────────────

export interface IgnorePattern {
  pattern: string;
  negated: boolean;
  dirOnly: boolean;
  hasGlob: boolean;
  hasSlash: boolean;
  regex: RegExp | null;
}

let _cachedPatterns: IgnorePattern[] | null = null;

// ── Internal: Glob-to-RegExp (zero dependencies) ────────────────────────────

/**
 * Converts a gitignore-style glob pattern to a RegExp.
 * Supports `*`, `**`, `?`, and bracket classes `[abc]`.
 */
function globToRegex(pattern: string): RegExp {
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
 */
function parseGitignoreContent(content: string): IgnorePattern[] {
  const patterns: IgnorePattern[] = [];

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
 */
function buildPatterns(list: string[]): IgnorePattern[] {
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
 */
async function loadGitignoreFromDir(dirPath: string): Promise<IgnorePattern[]> {
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
 */
export async function getIgnorePatterns(): Promise<IgnorePattern[]> {
  if (_cachedPatterns) return _cachedPatterns;

  const defaults = buildPatterns(DEFAULT_IGNORES);
  const gitignore = await loadGitignoreFromDir(process.cwd());

  _cachedPatterns = [...defaults, ...gitignore];
  return _cachedPatterns;
}

/**
 * Loads additional `.gitignore` patterns from a nested directory and
 * merges them **after** the parent list so they can override via negation.
 */
export async function loadNestedIgnores(dirPath: string, parentList: IgnorePattern[]): Promise<IgnorePattern[]> {
  const nested = await loadGitignoreFromDir(dirPath);
  if (nested.length === 0) return parentList;
  return [...parentList, ...nested];
}

/**
 * Invalidates the cached ignore patterns.
 */
export function clearIgnoreCache(): void {
  _cachedPatterns = null;
}

/**
 * Checks if a name should be ignored.
 *
 * Pattern evaluation order matters — patterns are processed sequentially
 * and the **last matching pattern wins**.  Negation patterns (`!`) can
 * therefore un-ignore a previously ignored name.
 */
export function shouldIgnore(
  name: string,
  ignoreList: IgnorePattern[],
  options: { isDirectory?: boolean; relativePath?: string } = {}
): boolean {
  const { isDirectory, relativePath } = options;
  let ignored = false;

  for (const entry of ignoreList) {
    // Directory-only patterns (`build/`) don't apply to files.
    // When `isDirectory` is undefined the caller didn't say, so we match
    // to preserve backward compat with callers that only pass basenames.
    if (entry.dirOnly && isDirectory === false) continue;

    let matches = false;

    if (entry.hasSlash) {
      // Path-scoped pattern — needs a full relative path to evaluate.
      // Without one we conservatively skip it (backward-compatible).
      if (!relativePath) continue;

      if (entry.hasGlob && entry.regex) {
        matches = entry.regex.test(relativePath);
      } else {
        // Exact segment match: the pattern must equal the relative path
        // OR appear as a leading path prefix followed by a separator.
        matches =
          relativePath === entry.pattern ||
          relativePath.startsWith(entry.pattern + '/');
      }
    } else {
      // Basename-only pattern — match against the entry name.
      matches = entry.hasGlob && entry.regex
        ? entry.regex.test(name)
        : name === entry.pattern;
    }

    if (matches) {
      ignored = !entry.negated;
    }
  }

  return ignored;
}

/**
 * Resolves a path and verifies it stays within `process.cwd()`.
 * Prevents directory-traversal attacks (e.g. `../../etc/passwd`).
 */
export function safePath(inputPath: string): string {
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
 *  2. Names matched by the ignore list (basename AND path-scoped patterns).
 *  3. Paths that resolve outside `process.cwd()`.
 */
export function isSafeEntry(dirent: Dirent, parentPath: string, ignoreList: IgnorePattern[]): boolean {
  if (dirent.isSymbolicLink()) return false;

  const root = process.cwd();
  const resolved = path.resolve(parentPath, dirent.name);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return false;

  const isDir = dirent.isDirectory();
  // Compute the relative path so shouldIgnore() can evaluate path-scoped
  // patterns like `tests/fixtures/` in addition to bare-name patterns.
  const relativePath = path.relative(root, resolved);
  if (shouldIgnore(dirent.name, ignoreList, { isDirectory: isDir, relativePath })) return false;

  return true;
}
