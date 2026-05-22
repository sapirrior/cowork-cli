import readFile from './readFile.js';
import readDir from './readDir.js';
import projectTree from './projectTree.js';
import readFileChunk from './readFileChunk.js';
import searchText from './searchText.js';
import webFetch from './webFetch.js';
import listTools from './listTools.js';
import findFile from './findFile.js';
import findDir from './findDir.js';
import askUser from './askUser.js';

export const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "readFile",
      description: "Read a file's full content. Best for files <1MB.",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "Path to the file." }
        },
        required: ["filePath"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "readDir",
      description: "List directory contents, including types (DIR/FILE).",
      parameters: {
        type: "object",
        properties: {
          dirPath: { type: "string", description: "Path to the directory." }
        },
        required: ["dirPath"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "projectTree",
      description: "Generate a visual directory tree. Respects .gitignore.",
      parameters: {
        type: "object",
        properties: {
          dirPath: { type: "string", description: "The folder to act as root for the tree." }
        },
        required: ["dirPath"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "readFileChunk",
      description: "Read specific line ranges. Ideal for large files.",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "Path to the file." },
          startLine: { type: "number", description: "1-based start line." },
          endLine: { type: "number", description: "1-based end line (inclusive)." }
        },
        required: ["filePath", "startLine", "endLine"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "searchText",
      description: "Regex search in files/folders. Supports recursion and .gitignore.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Regex or text pattern." },
          path: { type: "string", description: "File or directory to search." },
          recursive: { type: "boolean", description: "Search subdirectories? (default: false)" }
        },
        required: ["pattern", "path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "webFetch",
      description: "Fetch and clean text from a URL. Ideal for docs/APIs.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Full HTTP/HTTPS URL." }
        },
        required: ["url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "listTools",
      description: "List all available tools and usage guidelines.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "findFile",
      description: "Find files by name using regex. Supports recursion and .gitignore.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Regex pattern to match filenames." },
          dirPath: { type: "string", description: "Root directory to search (default: '.')." },
          recursive: { type: "boolean", description: "Search subdirectories? (default: true)" },
          limit: { type: "number", description: "Maximum number of results (default: 15, max: 15)." }
        },
        required: ["pattern"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "findDir",
      description: "Find directories by name using regex. Supports recursion and .gitignore.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Regex pattern to match directory names." },
          dirPath: { type: "string", description: "Root directory to search (default: '.')." },
          recursive: { type: "boolean", description: "Search subdirectories? (default: true)" },
          limit: { type: "number", description: "Maximum number of results (default: 15, max: 15)." }
        },
        required: ["pattern"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "askUser",
      description: "Ask the user a question via the terminal and get a text response.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "The question to ask the user." }
        },
        required: ["question"]
      }
    }
  }
];

const toolImplementations = {
  readFile,
  readDir,
  projectTree,
  readFileChunk,
  searchText,
  webFetch,
  listTools,
  findFile,
  findDir,
  askUser
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
