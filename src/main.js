import show_help from "./utils/helpMsg.js";
import clientLoader from "./engine/client.js";
import runQuery from "./engine/run.js";
import { loadConfig, verifyConnectivity } from "./utils/configManager.js";
import { logger } from "./utils/logger.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_PATH = path.join(__dirname, '../package.json');

/**
 * Main entry point for the cwk CLI.
 * @param {string[]} args Command line arguments.
 */
export default async function main(args) {
  let pipedData = '';
  if (!process.stdin.isTTY) {
    try {
      for await (const chunk of process.stdin) {
        pipedData += chunk;
      }
      pipedData = pipedData.trim();
    } catch (err) {
      logger.error(`Error reading from stdin: ${err.message}`);
    }
  }

  // Handle empty arguments or help flags
  if ((args.length === 0 && !pipedData) || args[0] === '-h' || args[0] === '--help') {
    show_help();
    return;
  }

  // Handle version flags
  if (args[0] === '-v' || args[0] === '--version') {
    try {
      const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
      console.log(`cwk version ${pkg.version}`);
    } catch (e) {
      logger.error("Error reading version from package.json");
    }
    return;
  }

  // Handle query execution
  let query = args.join(' ').trim();
  if (pipedData) {
    query = query
      ? `${query}\n\n[Piped Input]:\n${pipedData}`
      : `Analyze the following data:\n\n[Piped Input]:\n${pipedData}`;
  }
  const config = loadConfig();

  // clientLoader handles config validation and throws if invalid
  const client = clientLoader();
  
  // Silent connectivity check: logs only on failure
  const isConnected = await verifyConnectivity(client);
  if (!isConnected) {
    process.exitCode = 1;
    return;
  }

  await runQuery(client, config, query);
}
