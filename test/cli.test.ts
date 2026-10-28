import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import pkg from '../package.json' with { type: 'json' };
import { createTestEnvironment } from './helpers/environment.js';
import { HELP_ARGUMENTS } from './constants.js';

describe('command line', () => {
  for (const args of HELP_ARGUMENTS) {
    it(`shows generated help for ${args.join(' ')}`, async (context) => {
      const env = createTestEnvironment(context);
      const output = await env.output(args);
      assert.match(output, /devpglite/);
      assert.match(output, /--clean/);
      assert.match(output, /--init/);
      assert.match(output, /PGLITE_DATA_DIR/);
    });
  }

  it('shows the package version', async (context) => {
    const env = createTestEnvironment(context);
    assert.equal((await env.output(['--version'])).trim(), pkg.version);
  });

  it('rejects unknown commands', async (context) => {
    const env = createTestEnvironment(context);
    await assert.rejects(env.run(['unknown']), /Unknown argument/);
  });

  it('rejects unknown options', async (context) => {
    const env = createTestEnvironment(context);
    await assert.rejects(env.run(['start', '--unknown']), /Unknown argument/);
  });

  it('requires a filename after --init', async (context) => {
    const env = createTestEnvironment(context);
    await assert.rejects(env.run(['start', '--init']), /Not enough arguments/);
  });
});
