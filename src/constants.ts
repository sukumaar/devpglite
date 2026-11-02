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
  stream: process.stderr,
  config: {
    displayTimestamp: true,
    displayDate: false,
    displayFilename: false,
  },
};

export const CLI_HELP = `Run a local PostgreSQL-compatible database without PostgreSQL or Docker.
Uses PGlite. For development and tests.
Running without a command also starts the server. Press Ctrl+C to stop.

Connection URL:
  postgresql://postgres:postgres@${DEFAULT_CONFIG.host}:${DEFAULT_CONFIG.port}/postgres?sslmode=disable
  Change the URL port if you set PORT. The host is always ${DEFAULT_CONFIG.host}.
  SSL is disabled; the credentials are placeholders, not access protection.

Environment variables:
  PORT             TCP port (${MIN_PORT}-${MAX_PORT}). Default: ${DEFAULT_CONFIG.port}.
  PGLITE_DATA_DIR   Persistent database directory. Default: ~/${DATA_DIRECTORY_NAME}.
  MAX_CONNECTIONS  Maximum connected clients. Default: ${DEFAULT_CONFIG.maxConnections}.
                   Must be a positive safe integer.
  Unset or empty values use defaults. Relative paths use the current folder.
  Repository npm scripts use ./${DATA_DIRECTORY_NAME} through .env.development,
  unless PGLITE_DATA_DIR is already set.

Initial SQL (--init FILE):
  Runs before accepting connections, in one transaction, for a new database.
  Existing databases skip it. Use plain SQL, without psql commands or your
  own BEGIN/COMMIT. If loading fails, fix the SQL and restart with --clean.

Reset (--clean):
  Permanently deletes everything in PGLITE_DATA_DIR, including extra files.
  Stop any server using that directory first. A missing SQL file fails
  before deletion. Cleanup refuses symlinks, protected directories, and
  nonempty directories without ${DATABASE_VERSION_FILE}.

Examples:
  ${CLI_NAME} start
  ${CLI_NAME} start --init ./initial.sql
  ${CLI_NAME} start --clean --init ./initial.sql
  PORT=5433 PGLITE_DATA_DIR=./local-data ${CLI_NAME} start

From this repository:
  npm start
  npm start -- --init ./initial.sql
  npm start -- --clean --init ./initial.sql
  npm start -- --help
  The extra -- passes options through npm. Environment examples use POSIX syntax.

Limits:
  Use one server per data directory. Keep combined client pool sizes within
  MAX_CONNECTIONS. Clients share one database connection; queries run in
  sequence. Keep transactions short. Use PostgreSQL for tests requiring
  independent sessions or parallel queries.`;
export const START_COMMAND_OPTIONS = {
  clean: {
    type: 'boolean',
    default: false,
    describe: 'Permanently delete the database directory and start fresh',
  },
  init: {
    type: 'string',
    requiresArg: true,
    describe: 'Load a SQL file for a new database; skipped for existing databases',
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
