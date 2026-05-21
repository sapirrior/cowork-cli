#!/usr/bin/env node

/**
 * @file cli.js
 * @description Executable entry point for the btw CLI tool.
 * Handles top-level error boundaries and passes execution to the main application logic.
 */

import main from "../src/main.js";
import { logger } from "../src/utils/logger.js";

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  process.stdout.write('\x1b[?25h'); // Restore cursor
  logger.error(`\n[Fatal] Unhandled Rejection: ${reason instanceof Error ? reason.message : reason}`);
  process.exitCode = 1;
});

// Catch uncaught exceptions
process.on('uncaughtException', (err) => {
  process.stdout.write('\x1b[?25h'); // Restore cursor
  logger.error(`\n[Fatal] Uncaught Exception: ${err.message}`);
  process.exitCode = 1;
});

// Graceful exit on interrupt
process.on('SIGINT', () => {
  process.stdout.write('\x1b[?25h'); // Restore cursor
  logger.secondary('\nProcess interrupted by user.');
  process.exit(130);
});

async function run() {
  try {
    // Pass command line arguments (excluding 'node' and the script path) to main
    await main(process.argv.slice(2));
  } catch (err) {
    logger.error(`\n[Error]: ${err.message}`);
    process.exitCode = 1;
  }
}

run();
