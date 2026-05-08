// submitCorrectionAction の integration test。
// - auth() を general user 固定
// - 同日二重申請が tx 内 findActive→submit で CONFLICT になることを実 DB で確認
// - schema には partial unique index が無いので「sequential なら CONFLICT」だけ保証する。
//   並列衝突 (TOCTOU) は別タスクの schema 補強で扱う想定。

import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { submitCorrectionAction } from '@/app/attendance/[date]/actions';
import { prisma } from '@/lib/db';
import { seedCompany, seedUser } from './helpers';

const baseInput = {
  jstDate: '2026-04-10',
  reason: '退勤打刻を忘れたため',
  clockIn: '09:00',
  clockOut: '18:00',
  breakStart: '12:00',
  breakEnd: '13:00',
};

describe('submitCorrectionAction (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('first submission succeeds, second on same date returns CONFLICT', async () => {
    await seedCompany();
    const general = await seedUser({ id: 'u_general', role: 'general' });
    authMock.mockResolvedValue({ user: { id: general.id } });

    const first = await submitCorrectionAction(baseInput);
    expect(first.ok).toBe(true);

    const second = await submitCorrectionAction(baseInput);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe('CONFLICT');

    // DB に書き込まれた申請は 1 件のみ
    const reqs = await prisma.clockCorrectionRequest.findMany({
      where: { requesterId: general.id },
    });
    expect(reqs).toHaveLength(1);
    expect(reqs[0].status).toBe('submitted');
    expect(reqs[0].reason).toBe(baseInput.reason);
  });

  it('different dates can both have submitted corrections from the same user', async () => {
    await seedCompany();
    const general = await seedUser({ id: 'u_general', role: 'general' });
    authMock.mockResolvedValue({ user: { id: general.id } });

    const r1 = await submitCorrectionAction({ ...baseInput, jstDate: '2026-04-10' });
    const r2 = await submitCorrectionAction({ ...baseInput, jstDate: '2026-04-11' });
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);

    const reqs = await prisma.clockCorrectionRequest.findMany({
      where: { requesterId: general.id },
    });
    expect(reqs).toHaveLength(2);
  });

  it('UNAUTHORIZED if no session', async () => {
    await seedCompany();
    authMock.mockResolvedValue(null);

    const result = await submitCorrectionAction(baseInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNAUTHORIZED');

    const reqs = await prisma.clockCorrectionRequest.findMany();
    expect(reqs).toHaveLength(0);
  });
});
