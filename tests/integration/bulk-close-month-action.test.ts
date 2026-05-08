// bulkCloseMonthAction の integration test。
// - auth() を vi.mock で admin 固定
// - revalidatePath は no-op
// - 全 active user を一括締め → 二回目は全件 skip
// 実 DB に AttendanceClosing と AuditLog を書き込み、件数で検証する。

import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { bulkCloseMonthAction } from '@/app/admin/closings/actions';
import { prisma } from '@/lib/db';
import { seedCompany, seedUser } from './helpers';

describe('bulkCloseMonthAction (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('closes month for all active users and records audit logs', async () => {
    await seedCompany();
    const admin = await seedUser({
      id: 'u_admin',
      role: 'admin',
      email: 'admin@example.com',
    });
    await seedUser({ id: 'u_a', email: 'a@example.com' });
    await seedUser({ id: 'u_b', email: 'b@example.com' });
    await seedUser({ id: 'u_c', email: 'c@example.com' });
    authMock.mockResolvedValue({ user: { id: admin.id } });

    const result = await bulkCloseMonthAction({ yearMonth: '2026-04' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      // admin 自身も active user に含まれるので closed=4
      expect(result.data.closedCount).toBe(4);
      expect(result.data.skippedCount).toBe(0);
    }

    const closings = await prisma.attendanceClosing.findMany({
      where: { yearMonth: '2026-04' },
    });
    expect(closings).toHaveLength(4);

    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'attendance_closing', action: 'close' },
    });
    expect(logs).toHaveLength(4);
  });

  it('second invocation skips all already-closed users', async () => {
    await seedCompany();
    const admin = await seedUser({
      id: 'u_admin',
      role: 'admin',
      email: 'admin@example.com',
    });
    await seedUser({ id: 'u_a', email: 'a@example.com' });
    await seedUser({ id: 'u_b', email: 'b@example.com' });
    authMock.mockResolvedValue({ user: { id: admin.id } });

    const first = await bulkCloseMonthAction({ yearMonth: '2026-04' });
    expect(first.ok).toBe(true);

    const second = await bulkCloseMonthAction({ yearMonth: '2026-04' });
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.data.closedCount).toBe(0);
      expect(second.data.skippedCount).toBe(3);
    }

    // DB の closing 件数は 1 周目と同じ
    const closings = await prisma.attendanceClosing.findMany({
      where: { yearMonth: '2026-04' },
    });
    expect(closings).toHaveLength(3);

    // audit log も 2 周目で増えない
    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'attendance_closing', action: 'close' },
    });
    expect(logs).toHaveLength(3);
  });

  it('returns FORBIDDEN for non-admin actor', async () => {
    await seedCompany();
    const general = await seedUser({ id: 'u_general', role: 'general' });
    authMock.mockResolvedValue({ user: { id: general.id } });

    const result = await bulkCloseMonthAction({ yearMonth: '2026-04' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');

    // DB に何も書かれていない
    const closings = await prisma.attendanceClosing.findMany();
    expect(closings).toHaveLength(0);
  });
});
