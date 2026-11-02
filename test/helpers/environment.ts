import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { PGLiteSocketServer as FakeSocketServer } from './socket-server.js';
import { INITIAL_SQL, TEST_CONFIG, TEST_SIGNALS, type TestSignal } from '../constants.js';

// Give each test its own files and settings, then restore the process afterward.
// Tests run sequentially because the CLI reads process-wide settings.
class TestEnvironment {
  readonly temporaryDirectory = mkdtempSync(join(tmpdir(), TEST_CONFIG.directoryPrefix));
  readonly databaseDirectory = join(this.temporaryDirectory, TEST_CONFIG.dataDirectory);
  private readonly originalWorkingDirectory = process.cwd();
  private readonly originalEnvironmentVariables = { ...process.env };
  private readonly originalSignalListeners = new Set(TEST_SIGNALS.flatMap((signal) => process.listeners(signal)));
  private readonly socketModuleHook: ReturnType<typeof registerHooks>;

  // Replace only the TCP listener; database operations still run against PGlite.
  constructor() {
    const fakeSocketModuleUrl = new URL('./socket-server.js', import.meta.url).href;
    this.socketModuleHook = registerHooks({
      resolve(moduleName, context, resolveNormally) {
        if (moduleName === '@electric-sql/pglite-socket') {
          return { shortCircuit: true, url: fakeSocketModuleUrl };
        }
        return resolveNormally(moduleName, context);
      },
    });
    FakeSocketServer.latestInstance = undefined;
    process.chdir(this.temporaryDirectory);
    process.env.PORT = '';
    process.env.MAX_CONNECTIONS = '';
    process.env.PGLITE_DATA_DIR = this.databaseDirectory;
  }

  get socketServer() {
    if (!FakeSocketServer.latestInstance) throw new Error('The test has not started a server.');
    return FakeSocketServer.latestInstance;
  }

  // Keep parser failures in the test instead of letting yargs exit the process.
  private async createCommandParser(commandArguments: string[]) {
    // Import after installing the hook so startup uses the fake TCP server.
    const { createCli } = await import('../../src/cli.js');
    return createCli(commandArguments).exitProcess(false).showHelpOnFail(false);
  }

  async runCommand(commandArguments: string[]) {
    const cli = await this.createCommandParser(commandArguments);
    await cli.parseAsync();
  }

  // Capture help and version output without intercepting console.log.
  async readCommandOutput(commandArguments: string[]) {
    const cli = await this.createCommandParser(commandArguments);
    let output = '';
    await cli.parseAsync(commandArguments, {}, (error, _args, text) => {
      if (error) throw error;
      output = text;
    });
    return output;
  }

  // Reset settings on every start so restarts cannot inherit a previous override.
  async startServer(commandArguments: string[] = [], environmentOverrides: NodeJS.ProcessEnv = {}) {
    Object.assign(process.env, { PORT: '', MAX_CONNECTIONS: '', PGLITE_DATA_DIR: this.databaseDirectory }, environmentOverrides);
    await this.runCommand(['start', ...commandArguments]);
    return this.socketServer.options.db;
  }

  writeSqlFile(sql = INITIAL_SQL) {
    const sqlFilePath = join(this.temporaryDirectory, TEST_CONFIG.initialSqlFile);
    writeFileSync(sqlFilePath, sql);
    return sqlFilePath;
  }

  // Call only the application's handler; emitting SIGTERM would also stop the test runner.
  async stopServer(signal: TestSignal = 'SIGTERM') {
    if (this.socketServer.options.db.closed) return;
    const shutdownHandler = process.listeners(signal).find((listener) => !this.originalSignalListeners.has(listener));
    if (!shutdownHandler) throw new Error(`No application handler registered for ${signal}.`);
    await shutdownHandler(signal);
  }

  // Restore files, settings, and listeners even when a test fails.
  async cleanup() {
    try {
      if (FakeSocketServer.latestInstance) await this.stopServer();
    } finally {
      for (const signal of TEST_SIGNALS) {
        for (const listener of process.listeners(signal)) {
          if (!this.originalSignalListeners.has(listener)) process.removeListener(signal, listener);
        }
      }
      this.socketModuleHook.deregister();
      process.chdir(this.originalWorkingDirectory);
      process.env = this.originalEnvironmentVariables;
      FakeSocketServer.latestInstance = undefined;
      rmSync(this.temporaryDirectory, { recursive: true, force: true });
    }
  }
}

// Keep setup local to each test and guarantee cleanup when it finishes.
export function createTestEnvironment(context: TestContext) {
  const testEnvironment = new TestEnvironment();
  context.after(() => testEnvironment.cleanup());
  return testEnvironment;
}
