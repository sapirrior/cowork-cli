import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { safePath } from '../../utils/index.js';

const execFileAsync = promisify(execFile);

const MAX_LINES = 500;
const DEFAULT_MAX_LINES = 300;
const GIT_TIMEOUT_MS = 10_000;
const GIT_MAX_BUFFER = 1024 * 1024; // 1 MB raw output cap

/**
 * Runs a git command safely using execFile (no shell — args are an array).
 * @param {string[]} args  Git sub-command and flags.
 * @param {string}   cwd   Working directory.
 * @returns {Promise<{ok: boolean, output?: string, error?: string}>}
 */
async function runGit(args: string[], cwd: string = process.cwd()): Promise<{ok: boolean, output?: string, error?: string}> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd,
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: GIT_MAX_BUFFER,
    });
    return { ok: true, output: stdout };
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return { ok: false, error: 'Error: Git is not installed or not found in PATH.' };
    }
    const msg = (err.stderr || err.message || '').trim();
    return { ok: false, error: `Error: ${msg || 'Unknown git error.'}` };
  }
}

/**
 * gitDiff tool: Shows unstaged or staged file changes as a unified diff.
 * @param args
 * @param [args.staged=false]   If true, diffs the staging area (--staged).
 * @param [args.filePath]       Limit diff to a specific file (validated with safePath).
 * @param [args.maxLines=300]   Maximum output lines to return (max: 500).
 */
interface GitDiffArgs {
  staged?: boolean;
  filePath?: string;
  maxLines?: number;
}

export default async function gitDiff({ staged = false, filePath, maxLines = DEFAULT_MAX_LINES }: GitDiffArgs): Promise<string> {
  // Clamp maxLines
  const limit = Math.min(Math.max(1, maxLines), MAX_LINES);

  // Build git args — all discrete, never shell-interpolated
  const args = ['diff', '--no-color'];
  if (staged) args.push('--staged');

  // Validate and append optional path filter
  if (filePath) {
    let resolved: string;
    try {
      resolved = safePath(filePath);
    } catch (err: any) {
      return `Error: ${err.message}`;
    }
    args.push('--', resolved);
  }

  const result = await runGit(args);
  if (!result.ok) return result.error || 'Unknown error';

  const output = (result.output || '').trim();
  if (!output) {
    return staged
      ? 'No staged changes found.'
      : 'No unstaged changes found. Working tree is clean.';
  }

  const lines = output.split('\n');
  if (lines.length > limit) {
    return lines.slice(0, limit).join('\n') + `\n\n[Warning: Truncated at ${limit} lines]`;
  }
  return output;
}

