import fs from 'fs';
import path from 'path';
import { safePath } from '../../utils/fsUtils.js';
import { ui } from '../../tui/index.js';

interface EditFileArgs {
  filePath: string;
  oldText: string;
  newText: string;
}

/**
 * Performs a targeted string replacement in an existing file.
 * Shows an interactive diff preview card and requires user confirmation.
 */
export default async function editFile(args: EditFileArgs): Promise<string> {
  const { filePath, oldText, newText } = args;

  let resolvedPath: string;
  try {
    resolvedPath = safePath(filePath);
  } catch (err: any) {
    return `Error: ${err.message}`;
  }

  if (!fs.existsSync(resolvedPath)) {
    return `Error: File not found: '${filePath}'.`;
  }

  let content: string;
  try {
    content = fs.readFileSync(resolvedPath, 'utf8');
  } catch (err: any) {
    return `Error reading file: ${err.message}`;
  }

  if (!content.includes(oldText)) {
    return `Error: Could not find the specified text in '${filePath}'. No changes made.`;
  }

  const occurrences = content.split(oldText).length - 1;
  const relativePath = path.relative(process.cwd(), resolvedPath);

  const diffDetails = [
    '- Target Text to Replace:',
    ...oldText.split('\n').map(l => `  - ${l}`),
    '+ Replacement Content:',
    ...newText.split('\n').map(l => `  + ${l}`),
  ];

  // Interactive Tool Confirmation Card with diff preview
  const { confirmed, dismissed } = await ui.confirmTool({
    toolName: 'editFile',
    action: 'Apply targeted string replacement',
    target: `${relativePath} (${occurrences} occurrence${occurrences !== 1 ? 's' : ''})`,
    details: diffDetails,
  });

  if (!confirmed || dismissed) {
    return `Cancelled: edit to '${relativePath}' was not confirmed.`;
  }

  try {
    const updated = content.split(oldText).join(newText);
    fs.writeFileSync(resolvedPath, updated, 'utf8');
    return `Edited: ${relativePath} (${occurrences} replacement${occurrences !== 1 ? 's' : ''} made)`;
  } catch (err: any) {
    return `Error writing file: ${err.message}`;
  }
}
