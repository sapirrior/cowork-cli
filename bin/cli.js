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
  logger.error(`\n[Fatal] Unhandled Rejection: ${reason instanceof Error ? reason.message : reason}`);
  process.exit(1);
});

// Catch uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error(`\n[Fatal] Uncaught Exception: ${err.message}`);
  process.exit(1);
});

async function run() {
  try {
    // Pass command line arguments (excluding 'node' and the script path) to main
    await main(process.argv.slice(2));
  } catch (err) {
    logger.error(`\n[Error]: ${err.message}`);
    process.exit(1);
  }
}

run();
