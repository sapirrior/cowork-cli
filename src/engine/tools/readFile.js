import fs from 'fs/promises';
import { Buffer } from 'buffer';

const MAX_FILE_SIZE = 1024 * 1024; // 1MB limit

/**
 * Implementation of the readFile tool.
 * @param {Object} args Arguments from the model.
 * @param {string} args.filePath Path to the file.
 * @returns {Promise<string>} File content or error message.
 */
export default async function readFile({ filePath }) {
  try {
    const stats = await fs.stat(filePath);
    
    if (!stats.isFile()) {
      return `Error: '${filePath}' is not a file.`;
    }

    if (stats.size > MAX_FILE_SIZE) {
      return `Error: File is too large (${(stats.size / 1024 / 1024).toFixed(1)}MB). Maximum allowed size is 1MB. Use 'readFileChunk' to read specific parts of this file.`;
    }

    // Binary check: read first 1KB and look for null bytes
    const handle = await fs.open(filePath, 'r');
    const { buffer } = await handle.read(Buffer.alloc(1024), 0, 1024, 0);
    await handle.close();
    
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] === 0) {
        return `Error: '${filePath}' appears to be a binary file. Reading binary files is not supported.`;
      }
    }

    const content = await fs.readFile(filePath, 'utf8');
    return content;
  } catch (err) {
    if (err.code === 'ENOENT') return `Error: File not found at '${filePath}'.`;
    return `Error reading file: ${err.message}`;
  }
}
