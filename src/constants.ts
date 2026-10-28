import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Options } from 'yargs';

export const DATA_DIRECTORY_NAME = '.devpglite';

// Defaults shared by configuration, startup, and command help.
export const DEFAULT_CONFIG = {
  host: 'localhost',
  port: 51214,
  dataDir: join(homedir(), DATA_DIRECTORY_NAME),
  maxConnections: 10,
} as const;

export const MIN_PORT = 1;
export const MAX_PORT = 65535;
export const DATABASE_VERSION_FILE = 'PG_VERSION';
export const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM'] as const;

export const CLI_NAME = 'devpglite';
export const LOGGER_OPTIONS = {
  scope: CLI_NAME,
  interactive: false,
  stream: process.stderr,
  types: {
    tip: {
      badge: '?',
      color: 'blue',
      label: 'tip',
      logLevel: 'info',
    },
  },
} as const;
export const LOGGER_CONFIG = {
  displayTimestamp: true,
  displayDate: false,
  displayFilename: false,
};

export const ENVIRONMENT_HELP = `Environment: PORT (${DEFAULT_CONFIG.port}), PGLITE_DATA_DIR (~/${DATA_DIRECTORY_NAME}), MAX_CONNECTIONS (${DEFAULT_CONFIG.maxConnections})`;
export const START_COMMAND_OPTIONS = {
  clean: {
    type: 'boolean',
    default: false,
    describe: 'Delete the database directory before starting',
  },
  init: {
    type: 'string',
    requiresArg: true,
    describe: 'SQL file to load when creating a fresh database',
  },
} as const satisfies Record<string, Options>;

export interface StartOptions {
  clean?: boolean;
  init?: string;
}

export interface InitialData {
  file: string;
  sql: string;
}

export interface ClientConnection {
  clientAddress: string;
  clientPort: number;
}
