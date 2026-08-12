import fs from 'fs';
import path from 'path';
import { safePath } from '../../utils/fsUtils.js';
import { ui } from '../../tui/index.js';

interface WriteFileArgs {
  filePath: string;
  content: string;
}

/**
 * Creates or overwrites a file after interactive user confirmation.
 * Displays content showcase preview and resolves path through safePath.
 */
export default async function writeFile(args: WriteFileArgs): Promise<string> {
  const { filePath, content } = args;

  let resolvedPath: string;
  try {
    resolvedPath = safePath(filePath);
  } catch (err: any) {
    return `Error: ${err.message}`;
  }

  const fileExists = fs.existsSync(resolvedPath);
  const action = fileExists ? 'Overwrite' : 'Create';
  const relativePath = path.relative(process.cwd(), resolvedPath);
  const lineCount = content.split('\n').length;
  const previewLines = content.split('\n').slice(0, 10);

  // Interactive Tool Confirmation Card with content showcase
  const { confirmed, dismissed } = await ui.confirmTool({
    toolName: 'writeFile',
    action: `${action} file`,
    target: `${relativePath} (${lineCount} line${lineCount !== 1 ? 's' : ''})`,
    details: previewLines,
  });

  if (!confirmed || dismissed) {
    return `Cancelled: file write to '${relativePath}' was not confirmed.`;
  }

  try {
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(resolvedPath, content, 'utf8');
    return `${action === 'Overwrite' ? 'Updated' : 'Created'}: ${relativePath} (${lineCount} line${lineCount !== 1 ? 's' : ''})`;
  } catch (err: any) {
    return `Error writing file: ${err.message}`;
  }
}
