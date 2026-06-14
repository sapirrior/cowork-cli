#!/usr/bin/env node

/**
 * @file cli.ts
 * @description Executable entry point for the cwk CLI tool.
 * Handles top-level error boundaries and passes execution to the main application logic.
 */

import main from "../src/core/index.js";
import { logger } from "../src/packages/utils/index.js";

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason: any) => {
  process.stdout.write('\x1b[?25h'); // Restore cursor
  logger.error(`[Fatal] Unhandled Rejection: ${reason instanceof Error ? reason.message : reason}`);
  process.exitCode = 1;
});

// Catch uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  process.stdout.write('\x1b[?25h'); // Restore cursor
  logger.error(`[Fatal] Uncaught Exception: ${err.message}`);
  process.exitCode = 1;
});

// Graceful exit on interrupt
process.on('SIGINT', () => {
  process.stdout.write('\x1b[?25h'); // Restore cursor
  logger.secondary('Process interrupted by user.');
  process.exit(130);
});

async function run(): Promise<void> {
  try {
    // Pass command line arguments (excluding 'node' and the script path) to main
    await main(process.argv.slice(2));
    process.exit(process.exitCode || 0);
  } catch (err: any) {
    logger.error(`[Error]: ${err.message}`);
    process.exit(1);
  }
}

run();
