/**
 * Returns a detailed list of all available tools, their purpose, and usage guidelines.
 * @returns {Promise<string>} A formatted string containing tool documentation.
 */
export default async function listTools() {
  const tools = [
    {
      name: "readFile",
      usage: "readFile({ filePath: 'src/main.js' })",
      description: "Reads the entire content of a file. Use this for small to medium files (<1MB) when you need full context.",
      whenToUse: "When you need to analyze a specific file's logic or structure completely."
    },
    {
      name: "readDir",
      usage: "readDir({ dirPath: 'src/' })",
      description: "Lists all files and directories in a given path, indicating their types.",
      whenToUse: "To explore the contents of a specific folder without generating a full tree."
    },
    {
      name: "projectTree",
      usage: "projectTree({ dirPath: '.' })",
      description: "Generates a visual directory tree of the project while respecting .gitignore rules.",
      whenToUse: "To get a high-level overview of the project structure and find where specific modules are located."
    },
    {
      name: "readFileChunk",
      usage: "readFileChunk({ filePath: 'large-file.log', startLine: 100, endLine: 200 })",
      description: "Reads a specific range of lines from a file.",
      whenToUse: "Essential for very large files or when you only need a specific snippet/function from a file."
    },
    {
      name: "searchText",
      usage: "searchText({ pattern: 'TODO', path: 'src/', recursive: true })",
      description: "Performs a regex search for text across files and directories. Respects .gitignore.",
      whenToUse: "To find variable usages, search for specific strings, or locate technical debt across the codebase."
    },
    {
      name: "webFetch",
      usage: "webFetch({ url: 'https://docs.example.com' })",
      description: "Fetches and extracts clean text from a web URL, removing HTML clutter.",
      whenToUse: "To gather information from online documentation, API references, or external technical articles."
    },
    {
      name: "findFile",
      usage: "findFile({ pattern: 'config.*\\\\.js$', dirPath: 'src/', limit: 10 })",
      description: "Finds files by name using regex. Supports recursion and respects .gitignore. Max 15 results.",
      whenToUse: "When you know the name or part of the name of a file but don't know its exact location."
    },
    {
      name: "findDir",
      usage: "findDir({ pattern: 'models', recursive: true })",
      description: "Finds directories by name using regex. Supports recursion and respects .gitignore. Max 15 results.",
      whenToUse: "To locate specific modules or folder structures within the project."
    },
    {
      name: "listTools",
      usage: "listTools({})",
      description: "Lists all tools available to the AI with detailed descriptions and usage examples.",
      whenToUse: "Use this if you are unsure which tool is best suited for the current task."
    },
    {
      name: "askUser",
      usage: "askUser({ question: 'What is the API endpoint for this service?' })",
      description: "Asks the user a specific question via the terminal and waits for a text response.",
      whenToUse: "When you need specific information, clarification, or feedback from the user that cannot be found in the codebase."
    }
  ];

  let output = "AVAILABLE TOOLS:\n";

  tools.forEach(tool => {
    output += `[${tool.name}]\n`;
    output += `Desc:${tool.description}\n`;
    output += `Use:${tool.whenToUse}\n`;
    output += `Ex:${tool.usage}\n`;
  });

  return output.trim();
}
