import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { cleanDatabaseDirectory } from '../src/database.js';
import { createTestEnvironment } from './helpers/environment.js';
import { TEST_CONFIG } from './constants.js';

describe('database directory cleanup', () => {
  it('refuses to delete the current working directory', async (context) => {
    const testEnvironment = createTestEnvironment(context);
    await assert.rejects(cleanDatabaseDirectory(testEnvironment.temporaryDirectory), /protected directory/);
    assert.equal(existsSync(testEnvironment.temporaryDirectory), true);
  });

  it('preserves unrelated nonempty directories', async (context) => {
    const testEnvironment = createTestEnvironment(context);
    mkdirSync(testEnvironment.databaseDirectory);
    const preservedFilePath = join(testEnvironment.databaseDirectory, TEST_CONFIG.preservedFile);
    writeFileSync(preservedFilePath, TEST_CONFIG.preservedContent);

    await assert.rejects(cleanDatabaseDirectory(testEnvironment.databaseDirectory), /nonempty directory/);
    assert.equal(readFileSync(preservedFilePath, 'utf8'), TEST_CONFIG.preservedContent);
  });

  it('refuses to follow a symlink to a database directory', async (context) => {
    const testEnvironment = createTestEnvironment(context);
    mkdirSync(testEnvironment.databaseDirectory);
    const databaseVersionFilePath = join(testEnvironment.databaseDirectory, TEST_CONFIG.databaseVersionFile);
    writeFileSync(databaseVersionFilePath, TEST_CONFIG.databaseVersion);
    const databaseSymlinkPath = join(testEnvironment.temporaryDirectory, TEST_CONFIG.databaseSymlink);
    symlinkSync(testEnvironment.databaseDirectory, databaseSymlinkPath, 'dir');

    await assert.rejects(cleanDatabaseDirectory(databaseSymlinkPath), /symlink/);
    assert.equal(existsSync(databaseVersionFilePath), true);
  });

  it('allows missing and empty data directories', async (context) => {
    const testEnvironment = createTestEnvironment(context);
    await cleanDatabaseDirectory(testEnvironment.databaseDirectory);
    mkdirSync(testEnvironment.databaseDirectory);
    await cleanDatabaseDirectory(testEnvironment.databaseDirectory);
    assert.equal(existsSync(testEnvironment.databaseDirectory), false);
  });
});
