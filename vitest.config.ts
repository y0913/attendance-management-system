import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
    // integration test は別 config (vitest.config.integration.ts) で走らせる
    exclude: ['tests/integration/**', 'node_modules/**'],
  },
});
