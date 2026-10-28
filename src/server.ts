import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { readConfig } from './config.js';
import { SHUTDOWN_SIGNALS, type ClientConnection, type StartOptions } from './constants.js';
import { cleanDatabaseDirectory, databaseExists, loadInitialData } from './database.js';
import { logger } from './logger.js';

// The socket server reports accepted TCP clients, before any SQL is sent.
function registerClientLogging(server: PGLiteSocketServer) {
  server.addEventListener('connection', (event) => {
    const { clientAddress, clientPort } = (event as CustomEvent<ClientConnection>).detail;
    const address = clientAddress.includes(':') ? `[${clientAddress}]` : clientAddress;
    logger.info('Client connected: %s:%d', address, clientPort);
  });
}

// Stop accepting connections before closing the database, and clean up listeners.
function registerShutdownHandlers(server: PGLiteSocketServer, db: PGlite) {
  let stopping = false;
  async function shutdown() {
    if (stopping) return;
    stopping = true;
    logger.await('Stopping the server and closing the database...');
    try {
      try {
        await server.stop();
      } finally {
        await db.close();
      }
      logger.success('Server stopped and database closed.');
    } finally {
      for (const signal of SHUTDOWN_SIGNALS) process.removeListener(signal, handleSignal);
    }
  }

  async function handleSignal() {
    try {
      await shutdown();
    } catch (error) {
      logger.error('Shutdown failed: %s', error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }

  for (const signal of SHUTDOWN_SIGNALS) process.on(signal, handleSignal);
  return shutdown;
}

// Prepare storage and initial data before making the database available to clients.
export async function startServer(options: StartOptions = {}) {
  const { host, port, dataDir, maxConnections } = readConfig();
  logger.start('Starting devpglite...');
  logger.info('Data directory: %s', dataDir);
  // Read before cleaning, so a missing SQL file cannot erase an existing database.
  const initialData = options.init === undefined ? undefined : {
    file: options.init,
    sql: await readFile(options.init, 'utf8'),
  };
  if (options.clean) await cleanDatabaseDirectory(dataDir);

  const fresh = !databaseExists(dataDir);
  logger.await(fresh ? 'Creating a new database...' : 'Opening the existing database...');
  const db = await PGlite.create(dataDir);
  const server = new PGLiteSocketServer({ db, host, port, maxConnections });
  registerClientLogging(server);
  const shutdown = registerShutdownHandlers(server, db);

  try {
    await loadInitialData(db, initialData, fresh);
    await server.start();
    server.addEventListener('error', (event) => {
      logger.error('Socket server error: %s', (event as CustomEvent<Error>).detail.message);
    });
    logger.success('Database ready at %s:%d', host, port);
    logger.info('Database URL: postgresql://postgres:postgres@%s:%d/postgres?sslmode=disable', host, port);
    logger.info('Client connection limit: %d (MAX_CONNECTIONS)', maxConnections);
    logger.tip('Clients share one database connection. Keep transactions short so others can proceed.');
  } catch (error) {
    await shutdown();
    throw error;
  }
}
