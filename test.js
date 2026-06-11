import { toolDefinitions, dispatchTool } from './src/packages/agent/index.js';
import { ui, outputFormatted } from './src/packages/tui/index.js';
import { loadConfig } from './src/packages/config/index.js';
import { logger, formatMain, formatHeader, formatSecondary, formatDim, formatError } from './src/packages/utils/index.js';

async function testAll() {
  console.log(formatMain("=== Starting Cowork CLI Integration Tests ==="));

  // 1. Verify Configuration Package
  console.log(formatHeader("\n1. Testing Config Package..."));
  try {
    const config = loadConfig();
    console.log("Config loaded status:", !!config);
    if (config) {
      console.log("Config keys found:", Object.keys(config));
    }
  } catch (err) {
    logger.error("Config test failed: " + err.message);
  }

  // 2. Verify TUI Output Formatter and Colors
  console.log(formatHeader("\n2. Testing TUI Package..."));
  try {
    const rawMarkdown = "### Hello World\nThis is a **bold** statement and `inline code`.";
    const formatted = outputFormatted(rawMarkdown);
    console.log("Formatted Markdown Output:\n" + formatted);
  } catch (err) {
    logger.error("TUI formatting test failed: " + err.message);
  }

  // 3. Verify Agent Tools dispatching (Multiple Tools)
  console.log(formatHeader("\n3. Testing Agent Tools Dispatcher..."));
  
  const testCases = [
    { name: 'readDir', args: { dirPath: 'src/packages' } },
    { name: 'findFile', args: { pattern: 'logger', dirPath: 'src' } },
    { name: 'readFileChunk', args: { filePath: 'src/packages/utils/index.js', startLine: 1, endLine: 5 } }
  ];

  for (const tc of testCases) {
    try {
      console.log(formatSecondary(`\nCalling Tool: ${tc.name} with args: ${JSON.stringify(tc.args)}`));
      const result = await dispatchTool(tc.name, tc.args);
      console.log("Result (First 300 chars):\n" + result.slice(0, 300) + (result.length > 300 ? "\n..." : ""));
    } catch (err) {
      logger.error(`Tool ${tc.name} execution failed: ` + err.message);
    }
  }

  console.log(formatMain("\n=== Integration Tests Completed ==="));
}

testAll().catch(err => {
  console.error("Test execution failed:", err);
});
