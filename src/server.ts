import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { readConfig } from './config.js';
import { SHUTDOWN_SIGNALS, type ClientConnection, type StartOptions } from './constants.js';
import { cleanDatabaseDirectory, databaseExists, loadInitialData } from './database.js';
import { logger } from './logger.js';

// The socket server reports accepted TCP clients, before any SQL is sent.
function registerClientLogging(socketServer: PGLiteSocketServer) {
  socketServer.addEventListener('connection', (event) => {
    const { clientAddress, clientPort } = (event as CustomEvent<ClientConnection>).detail;
    const formattedClientAddress = clientAddress.includes(':') ? `[${clientAddress}]` : clientAddress;
    logger.info('Client connected: %s:%d', formattedClientAddress, clientPort);
  });
}

// Stop accepting connections before closing the database, and clean up listeners.
function registerShutdownHandlers(socketServer: PGLiteSocketServer, database: PGlite) {
  let isShuttingDown = false;
  async function stopServerAndDatabase() {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.await('Stopping the server and closing the database...');
    try {
      try {
        await socketServer.stop();
      } finally {
        // Close the database even if stopping the TCP server fails.
        await database.close();
      }
      logger.success('Server stopped and database closed.');
    } finally {
      // Remove our listeners even if either resource fails to close.
      for (const signal of SHUTDOWN_SIGNALS) {
        process.removeListener(signal, handleShutdownSignal);
      }
    }
  }

  async function handleShutdownSignal() {
    try {
      await stopServerAndDatabase();
    } catch (error) {
      logger.error('Shutdown failed: %s', error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }

  for (const signal of SHUTDOWN_SIGNALS) {
    process.on(signal, handleShutdownSignal);
  }
  return stopServerAndDatabase;
}

// Prepare storage and initial data before making the database available to clients.
export async function startServer(options: StartOptions = {}) {
  const { host, port, dataDir: databaseDirectory, maxConnections } = readConfig();
  logger.start('Starting devpglite...');
  logger.info('Data directory: %s', databaseDirectory);
  // Read before cleaning, so a missing SQL file cannot erase an existing database.
  const initialData = options.init === undefined ? undefined : {
    file: options.init,
    sql: await readFile(options.init, 'utf8'),
  };
  if (options.clean) await cleanDatabaseDirectory(databaseDirectory);

  const isNewDatabase = !databaseExists(databaseDirectory);
  logger.await(isNewDatabase ? 'Creating a new database...' : 'Opening the existing database...');
  const database = await PGlite.create(databaseDirectory);
  const socketServer = new PGLiteSocketServer({ db: database, host, port, maxConnections });
  registerClientLogging(socketServer);
  const stopServerAndDatabase = registerShutdownHandlers(socketServer, database);

  try {
    await loadInitialData(database, initialData, isNewDatabase);
    await socketServer.start();
    socketServer.addEventListener('error', (event) => {
      logger.error('Socket server error: %s', (event as CustomEvent<Error>).detail.message);
    });
    logger.success('Database ready at %s:%d', host, port);
    logger.info('Database URL: postgresql://postgres:postgres@%s:%d/postgres?sslmode=disable', host, port);
    logger.info('Client connection limit: %d (MAX_CONNECTIONS)', maxConnections);
    logger.info('Clients share one database connection. Keep transactions short so others can proceed.');
  } catch (error) {
    await stopServerAndDatabase();
    throw error;
  }
}
