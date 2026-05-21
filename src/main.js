import show_help from "./utils/helpMsg.js";
import setup_config from "./utils/setConfig.js";
import clientLoader from "./engine/client.js";
import runQuery from "./engine/run.js";
import { loadConfig } from "./utils/configManager.js";

/**
 * Main entry point for the btw CLI.
 * @param {string[]} args Command line arguments.
 */
export default async function main(args) {
  // Handle empty arguments or help flags
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    show_help();
    process.exit(0);
  }

  // Handle configuration flag
  if (args[0] === '-c' || args[0] === '--config') {
    await setup_config();
    process.exit(0);
  }

  // Handle query execution
  const query = args.join(" ");
  const config = loadConfig();

  // clientLoader handles config validation and exit if invalid
  const client = clientLoader();
  
  await runQuery(client, config, query);
  process.exit(0);
}
