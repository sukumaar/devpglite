import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TEST_CLIENTS } from './constants.js';
import { createTestEnvironment } from './helpers/environment.js';
import { captureLogs } from './helpers/logging.js';

describe('developer logs', () => {
  it('reports the address and port of accepted clients', async (context) => {
    const testEnvironment = createTestEnvironment(context);
    const logMessages = captureLogs(context);
    await testEnvironment.startServer();

    for (const client of TEST_CLIENTS) {
      testEnvironment.socketServer.dispatchEvent(new CustomEvent('connection', { detail: client }));
      assert.ok(logMessages.includes(`Client connected: ${client.endpoint}`));
    }
  });

  it('reports socket errors after startup', async (context) => {
    const testEnvironment = createTestEnvironment(context);
    const logMessages = captureLogs(context);
    await testEnvironment.startServer();

    testEnvironment.socketServer.dispatchEvent(new CustomEvent('error', { detail: new Error('Connection failed') }));

    assert.ok(logMessages.includes('Socket server error: Connection failed'));
  });
});
