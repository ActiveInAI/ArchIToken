// vitest.config.ts - Unit test runner configuration
// License: Apache-2.0
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
  test: {
    exclude: [
      '**/node_modules/**',
      '**/.next/**',
      '**/test-results/**',
      '**/playwright-report/**',
      'tests/e2e/**',
    ],
  },
});
