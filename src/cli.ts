#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import yargs, { type Argv } from 'yargs';
import { hideBin } from 'yargs/helpers';
import { startServer } from './server.js';
import { logger } from './logger.js';
import { CLI_NAME, CLI_HELP, START_COMMAND_OPTIONS } from './constants.js';
import packageMetadata from '../package.json' with { type: 'json' };

// Keep commands, option validation, and generated help in one place.
export function createCli(commandArguments = hideBin(process.argv)) {
  return yargs(commandArguments)
    .scriptName(CLI_NAME)
    .usage('$0 <command> [options]')
    .wrap(null)
    .command(
      ['start', '$0'],
      'Start the local PostgreSQL-compatible database',
      (command: Argv) => command.options(START_COMMAND_OPTIONS).epilogue(CLI_HELP),
      startServer,
    )
    .strict()
    .fail((message, error) => { throw error ?? new Error(message); })
    .help()
    .alias('help', 'h')
    .version(packageMetadata.version)
    .alias('version', 'v');
}

// Importing the parser in tests must not start the application.
const entryFile = process.argv[1];
const isRunningDirectly = entryFile && pathToFileURL(resolve(entryFile)).href === import.meta.url;
if (isRunningDirectly) {
  try {
    await createCli().parseAsync();
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
