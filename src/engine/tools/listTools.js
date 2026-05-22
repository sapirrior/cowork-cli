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
      name: "listTools",
      usage: "listTools({})",
      description: "Lists all tools available to the AI with detailed descriptions and usage examples.",
      whenToUse: "Use this if you are unsure which tool is best suited for the current task."
    }
  ];

  let output = "AVAILABLE TOOLS AND USAGE GUIDELINES:\n\n";

  tools.forEach(tool => {
    output += `Tool: ${tool.name}\n`;
    output += `Description: ${tool.description}\n`;
    output += `When to use: ${tool.whenToUse}\n`;
    output += `Example Usage: ${tool.usage}\n`;
    output += "--------------------------------------------------\n";
  });

  return output;
}
