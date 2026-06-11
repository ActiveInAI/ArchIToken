// vitest.config.ts - Unit test runner configuration
// License: Apache-2.0
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      // monaco-editor 0.50.x 只声明 module 字段，vitest 的 node 解析器找不到入口
      'monaco-editor': resolve(
        __dirname,
        'node_modules/monaco-editor/esm/vs/editor/editor.api.js',
      ),
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
