import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@electric-sql/pglite-socket': fileURLToPath(new URL('./test/helpers/socket-server.ts', import.meta.url)),
    },
  },
});
