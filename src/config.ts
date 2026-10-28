import { resolve } from 'node:path';
import { DEFAULT_CONFIG, MIN_PORT, MAX_PORT } from './constants.js';

// Validate settings before startup can create or delete database files.
export function readConfig() {
  const port = Number(process.env.PORT || DEFAULT_CONFIG.port);
  if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
    throw new Error(`PORT must be an integer between ${MIN_PORT} and ${MAX_PORT}.`);
  }

  const maxConnections = Number(process.env.MAX_CONNECTIONS || DEFAULT_CONFIG.maxConnections);
  if (!Number.isSafeInteger(maxConnections) || maxConnections < 1) {
    throw new Error('MAX_CONNECTIONS must be a positive safe integer.');
  }

  return {
    ...DEFAULT_CONFIG,
    port,
    maxConnections,
    dataDir: resolve(process.env.PGLITE_DATA_DIR || DEFAULT_CONFIG.dataDir),
  };
}
