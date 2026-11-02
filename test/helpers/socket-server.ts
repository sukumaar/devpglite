import type { PGLiteSocketServerOptions } from '@electric-sql/pglite-socket';

// Use the real database without opening a TCP port in the test environment.
// The export name matches the package replaced by the test module hook.
export class PGLiteSocketServer extends EventTarget {
  static latestInstance: PGLiteSocketServer | undefined;
  readonly options: PGLiteSocketServerOptions;
  stopCallCount = 0;

  constructor(options: PGLiteSocketServerOptions) {
    super();
    this.options = options;
    PGLiteSocketServer.latestInstance = this;
  }

  async start() {}

  async stop() {
    this.stopCallCount++;
  }
}
