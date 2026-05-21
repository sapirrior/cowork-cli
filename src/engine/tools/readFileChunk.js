import fs from 'fs';

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
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.split('\n');
    const chunk = lines.slice(startLine - 1, endLine);
    return chunk.join('\n');
  } catch (err) {
    return `Error reading file chunk: ${err.message}`;
  }
}
