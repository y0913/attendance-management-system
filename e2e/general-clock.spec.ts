// 一般ユーザー: ログイン → 出勤 → 退勤 までの最小 golden path

import { test, expect } from '@playwright/test';
import {
  cleanupUsersByEmailPrefix,
  ensureCompany,
  seedUser,
} from './helpers/db';
import { loginAs } from './helpers/login';

const PREFIX = 'e2e-general-clock-';

test.beforeEach(async () => {
  await cleanupUsersByEmailPrefix(PREFIX);
  await ensureCompany();
});

test('general user can sign in, clock in, and clock out', async ({ page }) => {
  const email = `${PREFIX}${Date.now()}@example.com`;
  await seedUser({ email, role: 'general' });

  await loginAs(page, email);

  // 打刻ホームに到着
  await expect(page).toHaveURL(/\/clock/);
  await expect(page.getByText('未出勤')).toBeVisible();

  // 出勤打刻
  await page.getByRole('button', { name: '出勤' }).click();
  await expect(page.getByText('勤務中')).toBeVisible();

  // 退勤打刻
  await page.getByRole('button', { name: '退勤' }).click();
  await expect(page.getByText('退勤済み')).toBeVisible();
});
