import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const GIT_TIMEOUT_MS = 10_000;
const GIT_MAX_BUFFER = 1024 * 1024; // 1 MB raw output cap

/**
 * Runs a git command safely using execFile (no shell — args are an array).
 * @param {string[]} args  Git sub-command and flags.
 * @param {string}   cwd   Working directory.
 * @returns {Promise<{ok: boolean, output?: string, error?: string}>}
 */
async function runGit(args, cwd = process.cwd()) {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd,
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: GIT_MAX_BUFFER,
    });
    return { ok: true, output: stdout };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { ok: false, error: 'Error: Git is not installed or not found in PATH.' };
    }
    const msg = (err.stderr || err.message || '').trim();
    return { ok: false, error: `Error: ${msg || 'Unknown git error.'}` };
  }
}

// Porcelain v1 two-character status codes → human description
const STATUS_LABELS = {
  M:  'modified',
  A:  'added',
  D:  'deleted',
  R:  'renamed',
  C:  'copied',
  U:  'unmerged',
  '?': 'untracked',
  '!': 'ignored',
};

/**
 * Parses `git status --porcelain` output into grouped sections.
 * @param {string} raw  Raw porcelain output.
 * @returns {string}    Formatted status string.
 */
function parsePorcelain(raw) {
  if (!raw.trim()) return 'Working tree is clean. Nothing to report.';

  const staged    = [];
  const unstaged  = [];
  const untracked = [];

  for (const line of raw.split('\n')) {
    if (!line) continue;

    const x    = line[0]; // index (staged) status
    const y    = line[1]; // worktree (unstaged) status
    const file = line.slice(3);

    if (x === '?' && y === '?') {
      untracked.push(file);
      continue;
    }
    if (x !== ' ' && x !== '?') {
      staged.push(`  ${STATUS_LABELS[x] ?? x}  ${file}`);
    }
    if (y !== ' ' && y !== '?') {
      unstaged.push(`  ${STATUS_LABELS[y] ?? y}  ${file}`);
    }
  }

  const sections = [];
  if (staged.length)    sections.push(`Staged changes:\n${staged.join('\n')}`);
  if (unstaged.length)  sections.push(`Unstaged changes:\n${unstaged.join('\n')}`);
  if (untracked.length) sections.push(`Untracked files:\n${untracked.map(f => `  ${f}`).join('\n')}`);

  return sections.join('\n\n');
}

/**
 * gitStatus tool: Shows the working tree status grouped into staged, unstaged, and untracked sections.
 * No parameters — always operates on process.cwd().
 */
export default async function gitStatus() {
  const result = await runGit(['status', '--porcelain']);
  if (!result.ok) return result.error;

  return parsePorcelain(result.output);
}
