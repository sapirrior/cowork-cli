import readFile from './readFile.js';
import readDir from './readDir.js';
import readFileChunk from './readFileChunk.js';
import searchText from './searchText.js';

export const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "readFile",
      description: "Read the entire content of a file.",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "The path to the file to read." }
        },
        required: ["filePath"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "readDir",
      description: "List the contents of a directory (files and folders).",
      parameters: {
        type: "object",
        properties: {
          dirPath: { type: "string", description: "The path to the directory to list." }
        },
        required: ["dirPath"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "readFileChunk",
      description: "Read a specific range of lines from a file.",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "The path to the file." },
          startLine: { type: "number", description: "The 1-based start line." },
          endLine: { type: "number", description: "The 1-based end line (inclusive)." }
        },
        required: ["filePath", "startLine", "endLine"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "searchText",
      description: "Search for a pattern in a file or directory. Supports optional recursive searching and respects common ignore rules.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "The regex or text pattern to search for." },
          path: { type: "string", description: "The path to the file or directory to search." },
          recursive: { type: "boolean", description: "Whether to search subdirectories recursively. Defaults to false." }
        },
        required: ["pattern", "path"]
      }
    }
  }
];

const toolImplementations = {
  readFile,
  readDir,
  readFileChunk,
  searchText
};

/**
 * Dispatches a tool call to the appropriate implementation.
 * @param {string} name Tool name.
 * @param {Object} args Tool arguments.
 * @returns {Promise<string>} Tool execution result.
 */
export async function dispatchTool(name, args) {
  const tool = toolImplementations[name];
  if (!tool) {
    return `Error: Tool '${name}' not found.`;
  }
  return await tool(args);
}
