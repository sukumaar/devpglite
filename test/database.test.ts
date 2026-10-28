import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { cleanDatabaseDirectory } from '../src/database.js';
import { createTestEnvironment } from './helpers/environment.js';
import { TEST_CONFIG } from './constants.js';

describe('database directory cleanup', () => {
  it('refuses to delete the current working directory', async (context) => {
    const env = createTestEnvironment(context);
    await assert.rejects(cleanDatabaseDirectory(env.directory), /protected directory/);
    assert.equal(existsSync(env.directory), true);
  });

  it('preserves unrelated nonempty directories', async (context) => {
    const env = createTestEnvironment(context);
    mkdirSync(env.dataDir);
    const file = join(env.dataDir, 'keep');
    writeFileSync(file, 'keep me');

    await assert.rejects(cleanDatabaseDirectory(env.dataDir), /nonempty directory/);
    assert.equal(readFileSync(file, 'utf8'), 'keep me');
  });

  it('refuses to follow a symlink to a database directory', async (context) => {
    const env = createTestEnvironment(context);
    mkdirSync(env.dataDir);
    const marker = join(env.dataDir, TEST_CONFIG.databaseVersionFile);
    writeFileSync(marker, TEST_CONFIG.databaseVersion);
    const link = join(env.directory, 'db-link');
    symlinkSync(env.dataDir, link, 'dir');

    await assert.rejects(cleanDatabaseDirectory(link), /symlink/);
    assert.equal(existsSync(marker), true);
  });

  it('allows missing and empty data directories', async (context) => {
    const env = createTestEnvironment(context);
    await cleanDatabaseDirectory(env.dataDir);
    mkdirSync(env.dataDir);
    await cleanDatabaseDirectory(env.dataDir);
    assert.equal(existsSync(env.dataDir), false);
  });
});
