// Integration test 用 Vitest 設定。
// 通常の `npx vitest run` (vitest.config.ts) からは tests/integration/ を除外する。
// 走らせるとき: `npx vitest run --config vitest.config.integration.ts`
// または `npm run test:integration`

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
    include: ['tests/integration/**/*.test.ts'],
    setupFiles: ['tests/integration/setup.ts'],
    // 実 DB 操作は単体テストより遅いので余裕を持たせる。
    testTimeout: 15_000,
    hookTimeout: 15_000,
    // 並列で同じテーブルを TRUNCATE すると相互干渉するため、ファイル単位で逐次実行。
    fileParallelism: false,
  },
});
