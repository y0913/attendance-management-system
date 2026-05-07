// E2E (Playwright) 設定。
// - test DB (.env.test) を使用するため、Next.js dev server を専用ポート (3001) で起動
// - 認証は実際の magic link 経由 (mailpit から取得)
// - 並列実行は有効 (テストごとに DB seed する想定)

import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';

// .env.test を読み込んで Playwright 自身および webServer に渡す
loadEnv({ path: path.resolve(__dirname, '.env.test'), override: true });

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  // testごとに seed する設計なので並列で OK
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      ...process.env,
      // 明示的に test DB / mailpit を上書き
      DATABASE_URL: process.env.DATABASE_URL!,
      AUTH_SECRET: process.env.AUTH_SECRET!,
      AUTH_URL: BASE_URL,
      EMAIL_SERVER_HOST: 'localhost',
      EMAIL_SERVER_PORT: '1025',
      EMAIL_FROM: 'test@example.com',
      EMAIL_INSECURE: 'true',
    },
  },
});
