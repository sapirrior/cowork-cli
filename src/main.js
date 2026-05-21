import show_help from "./utils/helpMsg.js";
import clientLoader from "./engine/client.js";
import runQuery from "./engine/run.js";
import { loadConfig, verifyConnectivity } from "./utils/configManager.js";
import { logger } from "./utils/logger.js";

/**
 * Main entry point for the btw CLI.
 * @param {string[]} args Command line arguments.
 */
export default async function main(args) {
  // Handle empty arguments or help flags
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    show_help();
    return;
  }

  // Handle query execution
  const query = args[0];
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
