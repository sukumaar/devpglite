// Test expectations stay independent of the application's defaults.
export const TEST_CONFIG = {
  host: 'localhost',
  defaultPort: 51214,
  customPort: 51215,
  defaultMaxConnections: 10,
  customMaxConnections: 20,
  directoryPrefix: 'devpglite-test-',
  dataDirectory: '.devpglite',
  customDataDirectory: 'custom-db',
  initialSqlFile: 'initial.sql',
  databaseVersionFile: 'PG_VERSION',
  databaseVersion: '17',
} as const;

export const TEST_SIGNALS = ['SIGINT', 'SIGTERM'] as const;
export const INVALID_CONNECTION_LIMITS = ['0', '-1', '1.5', 'invalid', 'Infinity', '9007199254740992'];
export type TestSignal = typeof TEST_SIGNALS[number];
export const LOG_LEVELS = ['start', 'info', 'tip', 'await', 'success', 'warn', 'error'] as const;
export const TEST_CLIENTS = [
  { clientAddress: '127.0.0.1', clientPort: 45001, endpoint: '127.0.0.1:45001' },
  { clientAddress: '::1', clientPort: 45002, endpoint: '[::1]:45002' },
] as const;

export const HELP_ARGUMENTS = [['--help'], ['start', '--help'], ['-h']];
export const INITIAL_SQL = "CREATE TABLE users (name text); INSERT INTO users VALUES ('Alice');";
export const REPLACEMENT_SQL = "CREATE TABLE users (name text); INSERT INTO users VALUES ('Bob');";
export const INVALID_SQL = 'CREATE TABLE broken (id integer); INVALID SQL;';
export const INITIAL_USERS = [{ name: 'Alice' }];
export const REPLACEMENT_USERS = [{ name: 'Bob' }];
export const QUERIES = {
  users: 'SELECT * FROM users',
  usersTable: "SELECT to_regclass('public.users') AS users",
  brokenTable: "SELECT to_regclass('public.broken') AS broken",
} as const;
