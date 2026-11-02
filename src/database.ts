import { existsSync } from 'node:fs';
import { lstat, readdir, realpath, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { DATABASE_VERSION_FILE, type InitialData } from './constants.js';
import { logger } from './logger.js';

// PostgreSQL writes this file when it initializes a database directory.
export function databaseExists(databaseDirectory: string) {
  return existsSync(resolve(databaseDirectory, DATABASE_VERSION_FILE));
}

// Never erase the working directory, home directory, or any of their parents.
function isProtectedDirectory(directory: string) {
  for (const protectedPath of [process.cwd(), homedir()]) {
    let currentDirectory = resolve(protectedPath);
    while (true) {
      if (directory === currentDirectory) return true;

      const parentDirectory = dirname(currentDirectory);
      if (parentDirectory === currentDirectory) break; // Reached the filesystem root.
      currentDirectory = parentDirectory;
    }
  }
  return false;
}

// Delete database files only after checking the target is safe to remove.
export async function cleanDatabaseDirectory(databaseDirectory: string) {
  const resolvedDirectory = await realpath(databaseDirectory).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
    return databaseDirectory;
  });
  if (isProtectedDirectory(resolvedDirectory)) {
    throw new Error(`Refusing to clean protected directory: ${databaseDirectory}`);
  }

  const directoryInfo = await lstat(databaseDirectory).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
    return undefined;
  });
  if (!directoryInfo) {
    logger.info('No database directory to clean: %s', databaseDirectory);
    return;
  }
  if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) {
    throw new Error(`Refusing to clean a non-directory or symlink: ${databaseDirectory}`);
  }
  const directoryContents = await readdir(databaseDirectory);
  if (directoryContents.length > 0 && !databaseExists(databaseDirectory)) {
    throw new Error(`Refusing to clean a nonempty directory without a PGlite database: ${databaseDirectory}`);
  }
  logger.warn('Deleting all data in %s', databaseDirectory);
  await rm(databaseDirectory, { recursive: true });
  logger.success('Previous database files removed.');
}

// Load first-start SQL in one transaction; ordinary restarts keep their data.
export async function loadInitialData(database: PGlite, initialData: InitialData | undefined, isNewDatabase: boolean) {
  if (!initialData) return;
  if (!isNewDatabase) {
    logger.info('Existing database: skipping initial SQL. Use --clean to load it again.');
    return;
  }

  logger.await('Loading initial SQL from %s', initialData.file);
  await database.transaction((transaction) => transaction.exec(initialData.sql));
  logger.success('Initial data loaded from %s', initialData.file);
}
