import fs from 'fs/promises';
import { Buffer } from 'buffer';

/**
 * Implementation of the readFileChunk tool.
 * @param {Object} args Arguments from the model.
 * @param {string} args.filePath Path to the file.
 * @param {number} args.startLine The 1-based start line.
 * @param {number} args.endLine The 1-based end line (inclusive).
 * @returns {Promise<string>} File chunk or error message.
 */
export default async function readFileChunk({ filePath, startLine, endLine }) {
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) return `Error: '${filePath}' is not a file.`;

    // Binary check: read first 1KB and look for null bytes
    const handle = await fs.open(filePath, 'r');
    const { bytesRead, buffer } = await handle.read(Buffer.alloc(1024), 0, 1024, 0);
    await handle.close();
    
    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0) return `Error: '${filePath}' appears to be a binary file. Reading binary files is not supported.`;
    }

    const data = await fs.readFile(filePath, 'utf8');
    const lines = data.split('\n');
    
    // Boundary validation
    const totalLines = lines.length;
    const actualStart = Math.max(1, startLine);
    const actualEnd = Math.min(totalLines, endLine);

    if (actualStart > totalLines) {
      return `Error: startLine (${startLine}) is beyond the end of the file (Total lines: ${totalLines}).`;
    }
    if (actualStart > actualEnd) {
      return `Error: startLine (${startLine}) is greater than endLine (${endLine}).`;
    }

    const chunk = lines.slice(actualStart - 1, actualEnd);
    const header = `--- ${filePath} (Lines ${actualStart}-${actualEnd} of ${totalLines}) ---\n`;
    return header + chunk.join('\n');
  } catch (err) {
    if (err.code === 'ENOENT') return `Error: File not found at '${filePath}'.`;
    return `Error reading file chunk: ${err.message}`;
  }
}
