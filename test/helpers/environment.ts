import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { PGLiteSocketServer } from './socket-server.js';
import { INITIAL_SQL, TEST_CONFIG, TEST_SIGNALS, type TestSignal } from '../constants.js';

// Give each test its own files and settings, then restore the process afterward.
// Tests run sequentially because the CLI reads process-wide settings.
export class TestEnvironment {
  readonly directory = mkdtempSync(join(tmpdir(), TEST_CONFIG.directoryPrefix));
  readonly dataDir = join(this.directory, TEST_CONFIG.dataDirectory);
  private readonly previousCwd = process.cwd();
  private readonly previousEnv = { ...process.env };
  private readonly previousListeners = new Set(TEST_SIGNALS.flatMap((signal) => process.listeners(signal)));
  private readonly hooks: ReturnType<typeof registerHooks>;

  // Replace only the TCP listener; database operations still run against PGlite.
  constructor() {
    const socketModule = new URL('./socket-server.js', import.meta.url).href;
    this.hooks = registerHooks({
      resolve(specifier, context, next) {
        if (specifier === '@electric-sql/pglite-socket') {
          return { shortCircuit: true, url: socketModule };
        }
        return next(specifier, context);
      },
    });
    PGLiteSocketServer.current = undefined;
    process.chdir(this.directory);
    process.env.PORT = '';
    process.env.MAX_CONNECTIONS = '';
    process.env.PGLITE_DATA_DIR = this.dataDir;
  }

  get server() {
    if (!PGLiteSocketServer.current) throw new Error('The test has not started a server.');
    return PGLiteSocketServer.current;
  }

  // Keep parser failures in the test instead of letting yargs exit the process.
  private async parser(args: string[]) {
    const { createCli } = await import('../../src/cli.js');
    return createCli(args).exitProcess(false).showHelpOnFail(false).fail((message, error) => {
      throw error ?? new Error(message);
    });
  }

  async run(args: string[]) {
    const cli = await this.parser(args);
    await cli.parseAsync();
  }

  // Capture help and version output without intercepting console.log.
  async output(args: string[]) {
    const cli = await this.parser(args);
    let output = '';
    await cli.parseAsync(args, {}, (error, _args, text) => {
      if (error) throw error;
      output = text;
    });
    return output;
  }

  // Reset settings on every start so restarts cannot inherit a previous override.
  async start(args: string[] = [], env: NodeJS.ProcessEnv = {}) {
    Object.assign(process.env, { PORT: '', MAX_CONNECTIONS: '', PGLITE_DATA_DIR: this.dataDir }, env);
    await this.run(['start', ...args]);
    return this.server.options.db;
  }

  writeSql(sql = INITIAL_SQL) {
    const file = join(this.directory, TEST_CONFIG.initialSqlFile);
    writeFileSync(file, sql);
    return file;
  }

  // Call only the application's handler; emitting SIGTERM would also stop the test runner.
  async stop(signal: TestSignal = 'SIGTERM') {
    if (this.server.options.db.closed) return;
    const handler = process.listeners(signal).find((listener) => !this.previousListeners.has(listener));
    if (!handler) throw new Error(`No application handler registered for ${signal}.`);
    await handler(signal);
  }

  // Restore files, settings, and listeners even when a test fails.
  async cleanup() {
    try {
      if (PGLiteSocketServer.current) await this.stop();
    } finally {
      for (const signal of TEST_SIGNALS) {
        for (const listener of process.listeners(signal)) {
          if (!this.previousListeners.has(listener)) process.removeListener(signal, listener);
        }
      }
      this.hooks.deregister();
      process.chdir(this.previousCwd);
      process.env = this.previousEnv;
      PGLiteSocketServer.current = undefined;
      rmSync(this.directory, { recursive: true, force: true });
    }
  }
}

// Keep setup local to each test and guarantee cleanup when it finishes.
export function createTestEnvironment(context: TestContext) {
  const env = new TestEnvironment();
  context.after(async () => { await env.cleanup(); });
  return env;
}
