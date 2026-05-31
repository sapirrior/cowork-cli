import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;
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

/**
 * gitLog tool: Returns recent commit history in a readable format.
 * @param {Object}  args
 * @param {number}  [args.limit=10]       Number of commits to retrieve (max: 50).
 * @param {boolean} [args.oneline=false]  Compact single-line format per commit.
 */
export default async function gitLog({ limit = DEFAULT_LIMIT, oneline = false }) {
  // Clamp limit
  const count = Math.min(Math.max(1, limit), MAX_LIMIT);

  const args = ['log', '--no-color', `-n`, String(count)];
  if (oneline) {
    args.push('--oneline');
  } else {
    // Human-readable multi-line format: hash | author | date | subject
    args.push('--pretty=format:commit %H%nauthor: %an <%ae>%ndate:   %ad%n%n    %s%n%b%n---');
    args.push('--date=short');
  }

  const result = await runGit(args);
  if (!result.ok) return result.error;

  const output = result.output.trim();
  if (!output) return 'No commits found in this repository.';

  return output;
}
