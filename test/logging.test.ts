import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { INITIAL_SQL, TEST_CLIENTS, TEST_CONFIG } from './constants.js';
import { createTestEnvironment } from './helpers/environment.js';
import { captureLogs } from './helpers/logging.js';

describe('developer logs', () => {
  it('reports the address and port of accepted clients', async (context) => {
    const env = createTestEnvironment(context);
    const messages = captureLogs(context);
    await env.start();

    for (const client of TEST_CLIENTS) {
      env.server.dispatchEvent(new CustomEvent('connection', { detail: client }));
      assert.ok(messages.includes(`Client connected: ${client.endpoint}`));
    }
  });

  it('shows the data path, connection URL, initial data loading, and shutdown', async (context) => {
    const env = createTestEnvironment(context);
    const messages = captureLogs(context);
    const file = env.writeSql();

    await env.start(['--init', file]);
    await env.stop();

    const output = messages.join('\n');
    assert.ok(output.includes(env.dataDir));
    assert.ok(output.includes(file));
    assert.match(output, /Initial data loaded/);
    assert.ok(output.includes(`postgresql://postgres:postgres@${TEST_CONFIG.host}:${TEST_CONFIG.defaultPort}/postgres?sslmode=disable`));
    assert.match(output, /Server stopped and database closed/);
    assert.equal(output.includes(INITIAL_SQL), false);
  });

  it('reports database cleanup and reused data', async (context) => {
    const env = createTestEnvironment(context);
    const messages = captureLogs(context);
    const file = env.writeSql();

    await env.start(['--init', file]);
    await env.stop();
    await env.start(['--init', file]);
    await env.stop();
    await env.start(['--clean']);

    const output = messages.join('\n');
    assert.match(output, /Opening the existing database/);
    assert.match(output, /skipping initial SQL/);
    assert.ok(output.includes(`Deleting all data in ${env.dataDir}`));
    assert.match(output, /Previous database files removed/);
  });

  it('reports socket errors after startup', async (context) => {
    const env = createTestEnvironment(context);
    const messages = captureLogs(context);
    await env.start();

    env.server.dispatchEvent(new CustomEvent('error', { detail: new Error('Connection failed') }));

    assert.ok(messages.includes('Socket server error: Connection failed'));
  });
});
