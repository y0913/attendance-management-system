// 管理者: ログイン → 月次締め画面で「締める」を実行 → 締め済み表示

import { test, expect } from '@playwright/test';
import {
  cleanupUsersByEmailPrefix,
  ensureCompany,
  seedUser,
} from './helpers/db';
import { loginAs } from './helpers/login';

const PREFIX = 'e2e-admin-close-';

test.beforeEach(async () => {
  await cleanupUsersByEmailPrefix(PREFIX);
  await ensureCompany();
});

test('admin can close a month for a user', async ({ page }) => {
  const adminEmail = `${PREFIX}admin-${Date.now()}@example.com`;
  const generalEmail = `${PREFIX}general-${Date.now()}@example.com`;
  await seedUser({
    email: adminEmail,
    role: 'admin',
    name: 'E2E 管理者',
  });
  await seedUser({
    email: generalEmail,
    role: 'general',
    name: 'E2E 部下',
  });

  // 確認ダイアログを自動承認
  page.on('dialog', (dialog) => dialog.accept());

  await loginAs(page, adminEmail);

  await page.goto('/admin/closings');
  await expect(page.getByRole('heading', { name: /月次締め/ })).toBeVisible();

  // 対象ユーザーの行で「締める」ボタンを押す
  const generalRow = page.locator('tr', { hasText: 'E2E 部下' }).first();
  await generalRow.getByRole('button', { name: '締める' }).click();

  // 締め済みバッジが見える
  await expect(generalRow.getByText('締め済み')).toBeVisible({
    timeout: 10_000,
  });
});
