import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@mossclaw/shared': path.resolve(rootDir, '../shared/src/index.ts')
    }
  },
  test: {
    environment: 'node',
    exclude: ['dist/**']
  }
});
