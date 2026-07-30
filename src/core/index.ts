import { show_help, logger } from "../packages/utils/index.js";
import { clientLoader } from "../packages/providers/index.js";
import { runQuery } from "../packages/agent/index.js";
import { loadConfig, verifyConnectivity, runLoginWizard } from "../packages/config/index.js";
import { ui } from "../packages/tui/index.js";
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_PATH = path.join(__dirname, '../../package.json');

/**
 * Main entry point for the Haiku CLI.
 * @param {string[]} args Command line arguments.
 */
export default async function main(args: string[]): Promise<void> {
  // Handle CLI commands first
  if (args[0] === '--login' || args[0] === '-l') {
    await runLoginWizard(args.slice(1));
    return;
  }

  let pipedData = '';
  if (!process.stdin.isTTY) {
    try {
      for await (const chunk of process.stdin) {
        pipedData += chunk;
      }
      pipedData = pipedData.trim();
    } catch (err: any) {
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
      console.log(`haiku version ${pkg.version}`);
    } catch (e) {
      logger.error("Error reading version from package.json");
    }
    return;
  }

  // If the user attempts to pass a flag that is not recognized, do not treat it as a query prompt.
  if (args[0] && args[0].startsWith('-')) {
    logger.error(`Error: Unrecognized option '${args[0]}'.`);
    show_help();
    process.exitCode = 1;
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
  let client;
  try {
    client = clientLoader();
  } catch (err: any) {
    logger.error(err.message);
    process.exitCode = 1;
    await ui.cleanup();
    return;
  }
  
  // Silent connectivity check: logs only on failure
  const isConnected = await verifyConnectivity(client);
  if (!isConnected) {
    process.exitCode = 1;
    await ui.cleanup();
    return;
  }

  try {
    await runQuery(client, config!, query);
  } catch (err: any) {
    process.exitCode = 1;
  } finally {
    await ui.cleanup();
  }
}
