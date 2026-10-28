import assert from 'node:assert/strict';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { createTestEnvironment } from './helpers/environment.js';
import { INITIAL_USERS, INVALID_SQL, QUERIES, REPLACEMENT_SQL, REPLACEMENT_USERS, TEST_CONFIG, TEST_SIGNALS } from './constants.js';

describe('database server', () => {
  it('uses localhost and the default port', async (context) => {
    const env = createTestEnvironment(context);
    const db = await env.start();
    assert.equal(env.server.options.host, TEST_CONFIG.host);
    assert.equal(env.server.options.port, TEST_CONFIG.defaultPort);
    assert.equal(env.server.options.maxConnections, TEST_CONFIG.defaultMaxConnections);
    assert.equal(db.dataDir, env.dataDir);
  });

  it('reads the port and data directory from the environment', async (context) => {
    const env = createTestEnvironment(context);
    const dataDir = join(env.directory, TEST_CONFIG.customDataDirectory);
    const db = await env.start([], {
      PORT: String(TEST_CONFIG.customPort),
      PGLITE_DATA_DIR: dataDir,
      MAX_CONNECTIONS: String(TEST_CONFIG.customMaxConnections),
    });
    assert.equal(env.server.options.port, TEST_CONFIG.customPort);
    assert.equal(env.server.options.maxConnections, TEST_CONFIG.customMaxConnections);
    assert.equal(db.dataDir, dataDir);
  });

  it('loads initial data before starting', async (context) => {
    const env = createTestEnvironment(context);
    const file = env.writeSql();
    const db = await env.start(['--init', file]);
    assert.deepEqual((await db.query(QUERIES.users)).rows, INITIAL_USERS);
  });

  it('keeps existing data and skips initial SQL on restart', async (context) => {
    const env = createTestEnvironment(context);
    const file = env.writeSql();
    await env.start(['--init', file]);
    await env.stop();

    const db = await env.start(['--init', file]);
    assert.deepEqual((await db.query(QUERIES.users)).rows, INITIAL_USERS);
  });

  it('removes old files and reloads initial data with --clean', async (context) => {
    const env = createTestEnvironment(context);
    const file = env.writeSql();
    await env.start(['--init', file]);
    await env.stop();
    const marker = join(env.dataDir, 'extra-file');
    writeFileSync(marker, 'remove me');
    env.writeSql(REPLACEMENT_SQL);

    const db = await env.start(['--clean', '--init', file]);
    assert.equal(existsSync(marker), false);
    assert.deepEqual((await db.query(QUERIES.users)).rows, REPLACEMENT_USERS);
  });

  it('starts without old tables when --clean has no initial SQL', async (context) => {
    const env = createTestEnvironment(context);
    await env.start(['--init', env.writeSql()]);
    await env.stop();

    const db = await env.start(['--clean']);
    const result = await db.query(QUERIES.usersTable);
    assert.deepEqual(result.rows, [{ users: null }]);
  });

  it('leaves existing files alone when the initial SQL file is missing', async (context) => {
    const env = createTestEnvironment(context);
    await env.start();
    await env.stop();
    const marker = join(env.dataDir, 'keep');
    writeFileSync(marker, 'keep me');

    await assert.rejects(env.start(['--clean', '--init', join(env.directory, 'missing.sql')]), /ENOENT/);
    assert.equal(existsSync(marker), true);
  });

  it('rolls back invalid initial SQL and closes the database', async (context) => {
    const env = createTestEnvironment(context);
    const file = env.writeSql(INVALID_SQL);
    await assert.rejects(env.start(['--init', file]), /syntax error/);
    assert.equal(env.server.options.db.closed, true);

    const db = await env.start();
    const result = await db.query(QUERIES.brokenTable);
    assert.deepEqual(result.rows, [{ broken: null }]);
  });

  for (const signal of TEST_SIGNALS) {
    it(`stops the server and closes the database on ${signal}`, async (context) => {
      const env = createTestEnvironment(context);
      const db = await env.start();
      await env.stop(signal);
      assert.equal(db.closed, true);
      assert.equal(env.server.stopCalls, 1);
    });
  }

  it('rejects an invalid port before creating a database', async (context) => {
    const env = createTestEnvironment(context);
    await assert.rejects(env.start([], { PORT: 'invalid' }), /PORT must/);
    assert.equal(existsSync(env.dataDir), false);
  });

  it('rejects an invalid connection limit before cleaning existing data', async (context) => {
    const env = createTestEnvironment(context);
    await env.start();
    await env.stop();
    const marker = join(env.dataDir, 'keep');
    writeFileSync(marker, 'keep me');

    await assert.rejects(env.start(['--clean'], { MAX_CONNECTIONS: '0' }), /MAX_CONNECTIONS must/);
    assert.equal(existsSync(marker), true);
  });
});
