import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { readConfig } from '../src/config.js';
import { INVALID_CONNECTION_LIMITS, TEST_CONFIG } from './constants.js';
import { createTestEnvironment } from './helpers/environment.js';

describe('database storage settings', () => {
  it('uses the home directory when no data path is set', (context) => {
    createTestEnvironment(context);
    delete process.env.PGLITE_DATA_DIR;

    assert.equal(readConfig().dataDir, join(homedir(), TEST_CONFIG.dataDirectory));
  });

  it('uses the same default after changing folders', (context) => {
    const env = createTestEnvironment(context);
    process.env.PGLITE_DATA_DIR = '';
    const expected = join(homedir(), TEST_CONFIG.dataDirectory);
    assert.equal(readConfig().dataDir, expected);

    const folder = join(env.directory, 'another-folder');
    mkdirSync(folder);
    process.chdir(folder);
    assert.equal(readConfig().dataDir, expected);
  });

  it('resolves an explicit relative path from the working directory', (context) => {
    const env = createTestEnvironment(context);
    process.env.PGLITE_DATA_DIR = `./${TEST_CONFIG.dataDirectory}`;

    assert.equal(readConfig().dataDir, env.dataDir);
  });
});

describe('client connection limits', () => {
  it('uses the default for unset and empty values', (context) => {
    createTestEnvironment(context);
    delete process.env.MAX_CONNECTIONS;
    assert.equal(readConfig().maxConnections, TEST_CONFIG.defaultMaxConnections);
    process.env.MAX_CONNECTIONS = '';
    assert.equal(readConfig().maxConnections, TEST_CONFIG.defaultMaxConnections);
  });

  it('allows a single client when explicitly requested', (context) => {
    createTestEnvironment(context);
    process.env.MAX_CONNECTIONS = '1';
    assert.equal(readConfig().maxConnections, 1);
  });

  for (const value of INVALID_CONNECTION_LIMITS) {
    it(`rejects connection limit ${value}`, (context) => {
      createTestEnvironment(context);
      process.env.MAX_CONNECTIONS = value;
      assert.throws(() => readConfig(), /MAX_CONNECTIONS must/);
    });
  }
});
