import { OpenAI } from 'openai';
import readFile from './readFile.js';
import readDir from './readDir.js';
import projectTree from './projectTree.js';
import readFileChunk from './readFileChunk.js';
import searchText from './searchText.js';
import webFetch from './webFetch.js';
import webSearch from './webSearch.js';
import findFile from './findFile.js';
import findDir from './findDir.js';
import askUser from './askUser.js';
import askConfirm from './askConfirm.js';
import gitDiff from './gitDiff.js';
import gitLog from './gitLog.js';
import gitStatus from './gitStatus.js';
import readManyFiles from './readManyFiles.js';
import writeFile from './writeFile.js';
import editFile from './editFile.js';
import deleteFile from './deleteFile.js';
import executeCommand from './executeCommand.js';


export const toolDefinitions: OpenAI.ChatCompletionTool[] = [
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
        required: ["filePath"],
        additionalProperties: false
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
        required: ["dirPath"],
        additionalProperties: false
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
        required: ["dirPath"],
        additionalProperties: false
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
          startLine: { type: "integer", description: "1-based start line." },
          endLine: { type: "integer", description: "1-based end line (inclusive)." }
        },
        required: ["filePath", "startLine", "endLine"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "searchText",
      description: "Regex search in files/folders. Returns matching lines with surrounding context lines. Supports recursion and .gitignore.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Regex or text pattern." },
          path: { type: "string", description: "File or directory to search." },
          recursive: { type: "boolean", description: "Search subdirectories? (default: false)" },
          context: { type: "integer", description: "Lines of context around each match (default: 2, max: 5)." }
        },
        required: ["pattern", "path"],
        additionalProperties: false
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
        required: ["url"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "webSearch",
      description: "Search the web to find URLs, docs, and solutions. Returns a list of titles, URLs, and snippet summaries. Always use this first to find a URL before calling webFetch.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search term/query." },
          limit: { type: "integer", description: "Max results to return (default: 5, max: 20)." }
        },
        required: ["query"],
        additionalProperties: false
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
          limit: { type: "integer", description: "Maximum number of results (default: 15, max: 15)." }
        },
        required: ["pattern"],
        additionalProperties: false
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
          limit: { type: "integer", description: "Maximum number of results (default: 15, max: 15)." }
        },
        required: ["pattern"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "askUser",
      description: "Ask the user an open-ended question via the terminal and get a free-text response.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "The question to ask the user." }
        },
        required: ["question"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "askConfirm",
      description: "Ask the user a yes/no confirmation question. Use this instead of askUser when only a boolean decision is needed. Returns { confirmed: true } for yes, { confirmed: false } for no, and { confirmed: false, dismissed: true } if the user cancels with Ctrl+C.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "The yes/no question to ask the user." }
        },
        required: ["question"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "gitDiff",
      description: "Show file changes as a unified diff. Use staged:true to see staged changes, or omit for unstaged changes. Optionally limit to a single file.",
      parameters: {
        type: "object",
        properties: {
          staged:   { type: "boolean", description: "If true, shows staged (index) changes. Default: false (unstaged)." },
          filePath: { type: "string",  description: "Limit diff to this specific file path (optional)." },
          maxLines: { type: "integer",  description: "Maximum lines of diff output to return (default: 300, max: 500)." }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "gitLog",
      description: "Show recent commit history. Returns commit hash, author, date, and message.",
      parameters: {
        type: "object",
        properties: {
          limit:   { type: "integer",  description: "Number of commits to retrieve (default: 10, max: 50)." },
          oneline: { type: "boolean", description: "If true, shows each commit as a compact single line. Default: false." }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "gitStatus",
      description: "Show the working tree status grouped into staged changes, unstaged changes, and untracked files.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "readManyFiles",
      description: "Read and concatenate contents of multiple files matching glob patterns. Respects gitignores and ignores binary files unless explicitly requested.",
      parameters: {
        type: "object",
        properties: {
          include: {
            type: "array",
            items: { type: "string" },
            description: "Glob patterns of files to include (e.g. ['src/**/*.js', 'config/*.json'])."
          },
          exclude: {
            type: "array",
            items: { type: "string" },
            description: "Optional. Glob patterns of files to exclude."
          },
          useDefaultExcludes: {
            type: "boolean",
            description: "Whether to use default exclusions (node_modules, .git, etc.). Default: true."
          },
          respectGitIgnore: {
            type: "boolean",
            description: "Whether to respect .gitignore patterns. Default: true."
          }
        },
        required: ["include"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "writeFile",
      description: "Create a new file or overwrite an existing file with provided content. Requires user confirmation before writing.",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "Relative path of the file to create or overwrite." },
          content:  { type: "string", description: "Full content to write to the file." }
        },
        required: ["filePath", "content"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "editFile",
      description: "Edit an existing file by replacing a specific block of text with new text. Requires user confirmation before applying. oldText must match exactly one location in the file.",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "Relative path of the file to edit." },
          oldText:  { type: "string", description: "Exact text to find and replace in the file. Must match exactly one location." },
          newText:  { type: "string", description: "Text to replace oldText with." }
        },
        required: ["filePath", "oldText", "newText"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "deleteFile",
      description: "Permanently delete a file. Requires user confirmation. Cannot delete directories.",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "Relative path of the file to delete." }
        },
        required: ["filePath"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "executeCommand",
      description: "Execute a shell command via bash securely. Enforces sandbox directory boundaries and security guards against system destruction commands. Requires user confirmation before running. Use for build, test, lint, install, and other terminal operations.",
      parameters: {
        type: "object",
        properties: {
          command:        { type: "string",  description: "The shell command to execute." },
          cwd:            { type: "string",  description: "Optional working directory (defaults to project root)." },
          timeoutSeconds: { type: "integer", description: "Optional execution timeout in seconds (default: 60, max: 300)." }
        },
        required: ["command"],
        additionalProperties: false
      }
    }
  }
];

const toolImplementations: Record<string, (args: any) => Promise<string>> = {
  readFile,
  readDir,
  projectTree,
  readFileChunk,
  searchText,
  webFetch,
  webSearch,
  findFile,
  findDir,
  askUser,
  askConfirm,
  gitDiff,
  gitLog,
  gitStatus,
  readManyFiles,
  writeFile,
  editFile,
  deleteFile,
  executeCommand,
};

export const INTERACTIVE_TOOLS = new Set([
  'askUser', 'askConfirm', 'executeCommand', 'writeFile', 'editFile', 'deleteFile',
]);

export function isInteractiveTool(name: string): boolean {
  return INTERACTIVE_TOOLS.has(name);
}

export function isKnownTool(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(toolImplementations, name);
}

const definitionsByName = new Map(toolDefinitions.map(d => [(d as any).function?.name, (d as any).function]));

/**
 * Dispatches a tool call to the appropriate implementation.
 * @param name Tool name.
 * @param args Tool arguments.
 * @returns Tool execution result.
 */
export async function dispatchTool(name: string, args: any): Promise<string> {
  const tool = toolImplementations[name];
  if (!tool) {
    return `Error: Tool '${name}' not found.`;
  }
  const def = definitionsByName.get(name);
  if (def) {
    const required: string[] = (def.parameters as any)?.required || [];
    const missing = required.filter(k => args?.[k] === undefined || args?.[k] === null);
    if (missing.length > 0) {
      return `Error: Tool '${name}' called with missing required argument(s): ${missing.join(', ')}.`;
    }
  }
  try {
    return await tool(args);
  } catch (err: any) {
    return `Error: Tool '${name}' threw an unexpected error: ${err.message}`;
  }
}

