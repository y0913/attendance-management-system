// 承認者: ログイン → 部下の有給申請を承認 → ステータスが「承認済」になる

import { test, expect } from '@playwright/test';
import {
  cleanupUsersByEmailPrefix,
  ensureCompany,
  prisma,
  seedUser,
} from './helpers/db';
import { loginAs } from './helpers/login';

const PREFIX = 'e2e-approver-approve-';

test.beforeEach(async () => {
  await cleanupUsersByEmailPrefix(PREFIX);
  await ensureCompany();
});

test('approver can approve a subordinate leave request', async ({ page }) => {
  const ts = Date.now();
  const approver = await seedUser({
    email: `${PREFIX}approver-${ts}@example.com`,
    role: 'approver',
    name: 'E2E 承認者',
  });
  const general = await seedUser({
    email: `${PREFIX}general-${ts}@example.com`,
    role: 'general',
    name: 'E2E 部下',
    managerId: approver.id,
  });

  // 部下からの有給申請を直接 DB に投入
  const leave = await prisma.leaveRequest.create({
    data: {
      requesterId: general.id,
      currentApproverId: approver.id,
      status: 'submitted',
      submittedAt: new Date(),
      reason: '私用のため',
      leaveType: 'annual',
      dayUnit: 'full',
      startDate: new Date('2099-04-13'),
      endDate: new Date('2099-04-13'),
      days: 1,
    },
  });

  page.on('dialog', (dialog) => dialog.accept());

  await loginAs(page, approver.email);

  // 申請詳細ページに遷移
  await page.goto(`/team/approvals/leave/${leave.id}`);
  await expect(page.getByRole('heading', { name: /有給/ })).toBeVisible();

  // 承認ボタンを押す
  await page.getByRole('button', { name: '承認', exact: true }).click();

  // ステータスが「承認済」に切り替わる (page reload / revalidate 後)
  await expect(page.getByText('承認済')).toBeVisible({ timeout: 10_000 });
});
