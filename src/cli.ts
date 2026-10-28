#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import yargs, { type Argv } from 'yargs';
import { hideBin } from 'yargs/helpers';
import { startServer } from './server.js';
import { logger } from './logger.js';
import { CLI_NAME, ENVIRONMENT_HELP, START_COMMAND_OPTIONS } from './constants.js';
import pkg from '../package.json' with { type: 'json' };

// Keep commands, option validation, and generated help in one place.
export function createCli(args = hideBin(process.argv)) {
  return yargs(args)
    .scriptName(CLI_NAME)
    .usage('$0 <command> [options]')
    .command(['start', '$0'], 'Start the local PostgreSQL-compatible database',
      (command: Argv) => command.options(START_COMMAND_OPTIONS).epilogue(ENVIRONMENT_HELP), startServer)
    .strict()
    .fail((message, error) => { throw error ?? new Error(message); })
    .help()
    .alias('help', 'h')
    .version(pkg.version)
    .alias('version', 'v')
    .epilogue(ENVIRONMENT_HELP);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    await createCli().parseAsync();
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
