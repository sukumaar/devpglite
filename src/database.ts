import { existsSync } from 'node:fs';
import { lstat, readdir, realpath, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { DATABASE_VERSION_FILE, type InitialData } from './constants.js';
import { logger } from './logger.js';

// PostgreSQL writes this file when it initializes a database directory.
export function databaseExists(dataDir: string) {
  return existsSync(resolve(dataDir, DATABASE_VERSION_FILE));
}

// Never erase the working directory, home directory, or any of their parents.
function isProtectedDirectory(directory: string) {
  for (const protectedPath of [process.cwd(), homedir()]) {
    for (let path = resolve(protectedPath); ; path = dirname(path)) {
      if (directory === path) return true;
      if (path === dirname(path)) break;
    }
  }
  return false;
}

// Delete database files only after checking the target is safe to remove.
export async function cleanDatabaseDirectory(dataDir: string) {
  const cleanPath = await realpath(dataDir).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
    return dataDir;
  });
  if (isProtectedDirectory(cleanPath)) {
    throw new Error(`Refusing to clean protected directory: ${dataDir}`);
  }

  const entry = await lstat(dataDir).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
    return undefined;
  });
  if (!entry) {
    logger.info('No database directory to clean: %s', dataDir);
    return;
  }
  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    throw new Error(`Refusing to clean a non-directory or symlink: ${dataDir}`);
  }
  if ((await readdir(dataDir)).length && !databaseExists(dataDir)) {
    throw new Error(`Refusing to clean a nonempty directory without a PGlite database: ${dataDir}`);
  }
  logger.warn('Deleting all data in %s', dataDir);
  await rm(dataDir, { recursive: true });
  logger.success('Previous database files removed.');
}

// Load first-start SQL in one transaction; ordinary restarts keep their data.
export async function loadInitialData(db: PGlite, data: InitialData | undefined, fresh: boolean) {
  if (!data) return;
  if (!fresh) {
    logger.info('Existing database: skipping initial SQL. Use --clean to load it again.');
    return;
  }

  logger.await('Loading initial SQL from %s', data.file);
  await db.transaction(async (tx) => {
    await tx.exec(data.sql);
  });
  logger.success('Initial data loaded from %s', data.file);
}
