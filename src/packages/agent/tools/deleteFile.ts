import fs from 'fs';
import path from 'path';
import { safePath } from '../../utils/fsUtils.js';
import { ui } from '../../tui/index.js';

interface DeleteFileArgs {
  filePath: string;
}

/**
 * Deletes a single file after mandatory interactive user confirmation.
 * Cannot delete directories. Uses safePath to prevent traversal.
 */
export default async function deleteFile(args: DeleteFileArgs): Promise<string> {
  const { filePath } = args;

  let resolvedPath: string;
  try {
    resolvedPath = safePath(filePath);
  } catch (err: any) {
    return `Error: ${err.message}`;
  }

  if (!fs.existsSync(resolvedPath)) {
    return `Error: File not found: '${filePath}'.`;
  }

  const stat = fs.statSync(resolvedPath);
  if (stat.isDirectory()) {
    return `Error: '${filePath}' is a directory. This tool only deletes files.`;
  }

  const relativePath = path.relative(process.cwd(), resolvedPath);

  // Mandatory confirmation card with file details
  const { confirmed, dismissed } = await ui.confirmTool({
    toolName: 'deleteFile',
    action: 'Permanently delete file',
    target: relativePath,
    details: [
      `Path: ./${relativePath}`,
      `Size: ${stat.size} bytes`,
      '⚠️ Warning: File deletion is permanent and cannot be undone.',
    ],
  });

  if (!confirmed || dismissed) {
    return `Cancelled: deletion of '${relativePath}' was not confirmed.`;
  }

  try {
    fs.unlinkSync(resolvedPath);
    return `Deleted: ${relativePath}`;
  } catch (err: any) {
    return `Error deleting file: ${err.message}`;
  }
}
