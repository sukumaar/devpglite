import assert from 'node:assert/strict';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import { createTestEnvironment } from './helpers/environment.js';
import { captureLogs } from './helpers/logging.js';
import { INITIAL_SQL, INITIAL_USERS, INVALID_SQL, QUERIES, REPLACEMENT_SQL, REPLACEMENT_USERS, TEST_CONFIG, TEST_SIGNALS } from './constants.js';

describe('database server', () => {
  it('uses localhost and the default port', async (context) => {
    const testEnvironment = createTestEnvironment(context);
    const database = await testEnvironment.startServer();
    assert.equal(testEnvironment.socketServer.options.host, TEST_CONFIG.host);
    assert.equal(testEnvironment.socketServer.options.port, TEST_CONFIG.defaultPort);
    assert.equal(testEnvironment.socketServer.options.maxConnections, TEST_CONFIG.defaultMaxConnections);
    assert.equal(database.dataDir, testEnvironment.databaseDirectory);
  });

  it('reads the port and data directory from the environment', async (context) => {
    const testEnvironment = createTestEnvironment(context);
    const customDatabaseDirectory = join(testEnvironment.temporaryDirectory, TEST_CONFIG.customDataDirectory);
    const database = await testEnvironment.startServer([], {
      PORT: String(TEST_CONFIG.customPort),
      PGLITE_DATA_DIR: customDatabaseDirectory,
      MAX_CONNECTIONS: String(TEST_CONFIG.customMaxConnections),
    });
    assert.equal(testEnvironment.socketServer.options.port, TEST_CONFIG.customPort);
    assert.equal(testEnvironment.socketServer.options.maxConnections, TEST_CONFIG.customMaxConnections);
    assert.equal(database.dataDir, customDatabaseDirectory);
  });

  it('loads initial data and logs startup and shutdown', async (context) => {
    const testEnvironment = createTestEnvironment(context);
    const logMessages = captureLogs(context);
    const sqlFilePath = testEnvironment.writeSqlFile();
    const database = await testEnvironment.startServer(['--init', sqlFilePath]);
    const users = await database.query(QUERIES.users);
    assert.deepEqual(users.rows, INITIAL_USERS);
    await testEnvironment.stopServer();

    const output = logMessages.join('\n');
    assert.ok(output.includes(testEnvironment.databaseDirectory));
    assert.ok(output.includes(sqlFilePath));
    assert.match(output, /Initial data loaded/);
    assert.ok(output.includes(`postgresql://postgres:postgres@${TEST_CONFIG.host}:${TEST_CONFIG.defaultPort}/postgres?sslmode=disable`));
    assert.match(output, /Server stopped and database closed/);
    assert.equal(output.includes(INITIAL_SQL), false);
  });

  it('keeps existing data and skips initial SQL on restart', async (context) => {
    const testEnvironment = createTestEnvironment(context);
    const logMessages = captureLogs(context);
    const sqlFilePath = testEnvironment.writeSqlFile();
    await testEnvironment.startServer(['--init', sqlFilePath]);
    await testEnvironment.stopServer();

    const database = await testEnvironment.startServer(['--init', sqlFilePath]);
    const users = await database.query(QUERIES.users);
    assert.deepEqual(users.rows, INITIAL_USERS);
    const output = logMessages.join('\n');
    assert.match(output, /Opening the existing database/);
    assert.match(output, /skipping initial SQL/);
  });

  it('removes old files and reloads initial data with --clean', async (context) => {
    const testEnvironment = createTestEnvironment(context);
    const logMessages = captureLogs(context);
    const sqlFilePath = testEnvironment.writeSqlFile();
    await testEnvironment.startServer(['--init', sqlFilePath]);
    await testEnvironment.stopServer();
    const extraFilePath = join(testEnvironment.databaseDirectory, TEST_CONFIG.extraFile);
    writeFileSync(extraFilePath, TEST_CONFIG.extraContent);
    testEnvironment.writeSqlFile(REPLACEMENT_SQL);

    const database = await testEnvironment.startServer(['--clean', '--init', sqlFilePath]);
    assert.equal(existsSync(extraFilePath), false);
    const users = await database.query(QUERIES.users);
    assert.deepEqual(users.rows, REPLACEMENT_USERS);
    const output = logMessages.join('\n');
    assert.ok(output.includes(`Deleting all data in ${testEnvironment.databaseDirectory}`));
    assert.match(output, /Previous database files removed/);
  });

  it('starts without old tables when --clean has no initial SQL', async (context) => {
    const testEnvironment = createTestEnvironment(context);
    await testEnvironment.startServer(['--init', testEnvironment.writeSqlFile()]);
    await testEnvironment.stopServer();

    const database = await testEnvironment.startServer(['--clean']);
    const result = await database.query(QUERIES.usersTable);
    assert.deepEqual(result.rows, [{ users: null }]);
  });

  it('leaves existing files alone when the initial SQL file is missing', async (context) => {
    const testEnvironment = createTestEnvironment(context);
    await testEnvironment.startServer();
    await testEnvironment.stopServer();
    const preservedFilePath = join(testEnvironment.databaseDirectory, TEST_CONFIG.preservedFile);
    writeFileSync(preservedFilePath, TEST_CONFIG.preservedContent);

    const missingSqlFilePath = join(testEnvironment.temporaryDirectory, TEST_CONFIG.missingSqlFile);
    await assert.rejects(
      testEnvironment.startServer(['--clean', '--init', missingSqlFilePath]),
      /ENOENT/,
    );
    assert.equal(existsSync(preservedFilePath), true);
  });

  it('rolls back invalid initial SQL and closes the database', async (context) => {
    const testEnvironment = createTestEnvironment(context);
    const sqlFilePath = testEnvironment.writeSqlFile(INVALID_SQL);
    await assert.rejects(testEnvironment.startServer(['--init', sqlFilePath]), /syntax error/);
    assert.equal(testEnvironment.socketServer.options.db.closed, true);

    const database = await testEnvironment.startServer();
    const result = await database.query(QUERIES.brokenTable);
    assert.deepEqual(result.rows, [{ broken: null }]);
  });

  for (const signal of TEST_SIGNALS) {
    it(`stops the server and closes the database on ${signal}`, async (context) => {
      const testEnvironment = createTestEnvironment(context);
      const database = await testEnvironment.startServer();
      await testEnvironment.stopServer(signal);
      assert.equal(database.closed, true);
      assert.equal(testEnvironment.socketServer.stopCallCount, 1);
    });
  }

  it('rejects an invalid port before creating a database', async (context) => {
    const testEnvironment = createTestEnvironment(context);
    await assert.rejects(testEnvironment.startServer([], { PORT: 'invalid' }), /PORT must/);
    assert.equal(existsSync(testEnvironment.databaseDirectory), false);
  });

  it('rejects an invalid connection limit before cleaning existing data', async (context) => {
    const testEnvironment = createTestEnvironment(context);
    await testEnvironment.startServer();
    await testEnvironment.stopServer();
    const preservedFilePath = join(testEnvironment.databaseDirectory, TEST_CONFIG.preservedFile);
    writeFileSync(preservedFilePath, TEST_CONFIG.preservedContent);

    await assert.rejects(testEnvironment.startServer(['--clean'], { MAX_CONNECTIONS: '0' }), /MAX_CONNECTIONS must/);
    assert.equal(existsSync(preservedFilePath), true);
  });
});
