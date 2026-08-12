import { execFile } from 'child_process';
import path from 'path';
import { safePath } from '../../utils/fsUtils.js';
import { ui } from '../../tui/index.js';

interface ExecuteCommandArgs {
  command: string;
  cwd?: string;
  timeoutSeconds?: number;
}

const MAX_TIMEOUT_MS = 300000;
const MAX_OUTPUT_CHARS = 20000;
const PRESERVE_HEAD_CHARS = 8000;
const PRESERVE_TAIL_CHARS = 8000;

// High-risk shell destruction patterns that are blocked automatically for system security
const BLOCKED_PATTERNS = [
  /\brm\s+-[rRf]*\s+[\/\~]/i,             // rm -rf / or rm -rf ~
  /\bmkfs\b/i,                              // format file system
  /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;/i,  // fork bomb
  /\bdd\s+if=\/dev/i,                       // raw device overwrite
  /\bchmod\s+-[rRf]*\s+777\s+[\/]/i,        // recursive root permission wipe
  /\b(shutdown|reboot|halt|poweroff)\b/i,   // system power state commands
];

/**
 * Format large outputs preserving both head (initial context) and tail (error backtraces).
 */
function truncateOutput(output: string): string {
  if (output.length <= MAX_OUTPUT_CHARS) {
    return output;
  }
  const head = output.slice(0, PRESERVE_HEAD_CHARS);
  const tail = output.slice(-PRESERVE_TAIL_CHARS);
  const omitted = output.length - (PRESERVE_HEAD_CHARS + PRESERVE_TAIL_CHARS);
  return `${head}\n\n... [${omitted} characters omitted] ...\n\n${tail}`;
}

/**
 * Executes a shell command via bash securely after mandatory interactive user confirmation.
 * Enforces path sandbox boundaries, command safety checks, non-interactive env flags,
 * and head+tail log truncation.
 */
export default async function executeCommand(args: ExecuteCommandArgs): Promise<string> {
  const { command, cwd, timeoutSeconds } = args;

  if (!command || command.trim() === '') {
    return `Error: No command provided.`;
  }

  const trimmedCmd = command.trim();

  // 1. Security Check: Guard against catastrophic commands
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmedCmd)) {
      return `Security Error: Command execution blocked for dangerous pattern matching: '${trimmedCmd}'`;
    }
  }

  // 2. Path Sandbox Check
  let workDir = process.cwd();
  if (cwd) {
    try {
      workDir = safePath(cwd);
    } catch (err: any) {
      return `Error: Working directory outside sandbox: ${err.message}`;
    }
  }

  // 3. Timeout Calculation
  const timeoutMs = Math.min(
    Math.max((timeoutSeconds || 60) * 1000, 5000),
    MAX_TIMEOUT_MS
  );

  // 4. Mandatory Interactive User Confirmation Gate
  const relativeDir = path.relative(process.cwd(), workDir) || '.';
  const { confirmed, dismissed } = await ui.confirmTool({
    toolName: 'executeCommand',
    action: 'Run bash shell command',
    target: `in ./${relativeDir}`,
    details: [
      `$ ${trimmedCmd}`,
      `Timeout: ${(timeoutMs / 1000).toFixed(0)}s`,
      `Working Directory: ./${relativeDir}`,
    ],
  });

  if (!confirmed || dismissed) {
    return `Cancelled: command execution was not confirmed by user.`;
  }

  // 5. Execution with non-interactive environment variables
  const startTime = performance.now();

  return new Promise<string>((resolve) => {
    const env = {
      ...process.env,
      CI: 'true',
      DEBIAN_FRONTEND: 'noninteractive',
      FORCE_COLOR: '0',
      PAGER: 'cat',
      GIT_PAGER: 'cat',
    };

    execFile(
      'bash',
      ['-c', trimmedCmd],
      {
        cwd: workDir,
        timeout: timeoutMs,
        maxBuffer: MAX_OUTPUT_CHARS * 4,
        env,
      },
      (error, stdout, stderr) => {
        const durationSec = ((performance.now() - startTime) / 1000).toFixed(2);
        const combinedOutput = [stdout, stderr].filter(Boolean).join('\n').trim();
        const formattedOutput = truncateOutput(combinedOutput) || '(no output)';

        if (error) {
          const exitCode = error.code ?? 1;
          if (error.killed || error.signal === 'SIGTERM') {
            resolve(
              `Error: Command timed out after ${(timeoutMs / 1000).toFixed(0)}s (${durationSec}s elapsed).\n` +
              `Command: $ ${trimmedCmd}\n\nOutput:\n${formattedOutput}`
            );
          } else {
            resolve(
              `Command finished with exit code ${exitCode} (${durationSec}s elapsed).\n` +
              `Command: $ ${trimmedCmd}\n\nOutput:\n${formattedOutput}`
            );
          }
        } else {
          resolve(
            `Command succeeded (exit code 0, ${durationSec}s elapsed).\n` +
            `Command: $ ${trimmedCmd}\n\nOutput:\n${formattedOutput}`
          );
        }
      }
    );
  });
}
