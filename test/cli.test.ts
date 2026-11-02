import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import packageMetadata from '../package.json' with { type: 'json' };
import { createTestEnvironment } from './helpers/environment.js';
import { HELP_ARGUMENTS, TEST_CONFIG } from './constants.js';

describe('command line', () => {
  for (const commandArguments of HELP_ARGUMENTS) {
    it(`shows generated help for ${commandArguments.join(' ')}`, async (context) => {
      const testEnvironment = createTestEnvironment(context);
      const output = await testEnvironment.readCommandOutput(commandArguments);
      assert.match(output, /devpglite/);
      assert.match(output, /--clean/);
      assert.match(output, /--init/);
      assert.match(output, /PGLITE_DATA_DIR/);
      assert.ok(output.includes(`postgresql://postgres:postgres@${TEST_CONFIG.host}:${TEST_CONFIG.defaultPort}/postgres?sslmode=disable`));
      assert.match(output, /Permanently deletes everything in PGLITE_DATA_DIR/);
      assert.match(output, /Existing databases skip it/);
      assert.match(output, /npm start -- --init/);
      assert.match(output, /MAX_CONNECTIONS/);
      assert.equal(output.split('Connection URL:').length - 1, 1);
    });
  }

  it('shows the package version', async (context) => {
    const testEnvironment = createTestEnvironment(context);
    assert.equal((await testEnvironment.readCommandOutput(['--version'])).trim(), packageMetadata.version);
  });

  it('rejects unknown commands', async (context) => {
    const testEnvironment = createTestEnvironment(context);
    await assert.rejects(testEnvironment.runCommand(['unknown']), /Unknown argument/);
  });

  it('rejects unknown options', async (context) => {
    const testEnvironment = createTestEnvironment(context);
    await assert.rejects(testEnvironment.runCommand(['start', '--unknown']), /Unknown argument/);
  });

  it('requires a filename after --init', async (context) => {
    const testEnvironment = createTestEnvironment(context);
    await assert.rejects(testEnvironment.runCommand(['start', '--init']), /Not enough arguments/);
  });
});
