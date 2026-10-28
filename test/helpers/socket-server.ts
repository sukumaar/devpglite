import type { PGLiteSocketServerOptions } from '@electric-sql/pglite-socket';

// Use the real database without opening a TCP port in the test environment.
export class PGLiteSocketServer extends EventTarget {
  static current: PGLiteSocketServer | undefined;
  readonly options: PGLiteSocketServerOptions;
  stopCalls = 0;

  constructor(options: PGLiteSocketServerOptions) {
    super();
    this.options = options;
    PGLiteSocketServer.current = this;
  }

  async start() {}

  async stop() {
    this.stopCalls++;
  }
}
