// decideRequestAction の integration test。
// - 承認者が部下の打刻修正申請を承認 → status=approved + approval_actions 記録
// - 二度目は CONFLICT (NOT_PENDING)
// - 別承認者は FORBIDDEN
// 実 DB に書いて、tx 内合成 (decide + recordApprovalAction) が両方コミットされることを確認する。

import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { decideRequestAction } from '@/app/team/approvals/[type]/[id]/actions';
import { submitCorrection } from '@/lib/data/clock-corrections';
import { prisma } from '@/lib/db';
import { seedCompany, seedUser } from './helpers';

async function seedSubmittedCorrection(requesterId: string) {
  return submitCorrection({
    requesterId,
    targetDate: '2026-04-10',
    reason: '退勤打刻忘れ',
    before: { clockIn: null, clockOut: null, breakStart: null, breakEnd: null },
    after: {
      clockIn: '09:00',
      clockOut: '18:00',
      breakStart: '12:00',
      breakEnd: '13:00',
    },
  });
}

describe('decideRequestAction (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('approver can approve own subordinate; status flips and approval_action is recorded', async () => {
    await seedCompany();
    const approver = await seedUser({
      id: 'u_approver',
      role: 'approver',
      email: 'approver@example.com',
    });
    const general = await seedUser({
      id: 'u_general',
      role: 'general',
      email: 'general@example.com',
      managerId: approver.id,
    });
    const submitted = await seedSubmittedCorrection(general.id);
    authMock.mockResolvedValue({ user: { id: approver.id } });

    const result = await decideRequestAction({
      type: 'correction',
      id: submitted.id,
      decision: 'approve',
      comment: '確認しました',
    });
    expect(result.ok).toBe(true);

    const reloaded = await prisma.clockCorrectionRequest.findUnique({
      where: { id: submitted.id },
    });
    expect(reloaded?.status).toBe('approved');
    expect(reloaded?.decidedAt).not.toBeNull();

    const actions = await prisma.approvalAction.findMany({
      where: { requestType: 'clock_correction', requestId: submitted.id },
    });
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe('approve');
    expect(actions[0].actorId).toBe(approver.id);
    expect(actions[0].comment).toBe('確認しました');
  });

  it('second approval on already-approved request returns CONFLICT', async () => {
    await seedCompany();
    const approver = await seedUser({
      id: 'u_approver',
      role: 'approver',
      email: 'approver@example.com',
    });
    const general = await seedUser({
      id: 'u_general',
      role: 'general',
      email: 'general@example.com',
      managerId: approver.id,
    });
    const submitted = await seedSubmittedCorrection(general.id);
    authMock.mockResolvedValue({ user: { id: approver.id } });

    const r1 = await decideRequestAction({
      type: 'correction',
      id: submitted.id,
      decision: 'approve',
      comment: '',
    });
    expect(r1.ok).toBe(true);

    const r2 = await decideRequestAction({
      type: 'correction',
      id: submitted.id,
      decision: 'approve',
      comment: '',
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error.code).toBe('CONFLICT');

    // approval_actions は 1 件のままで、二回目の record は走らない
    const actions = await prisma.approvalAction.findMany({
      where: { requestType: 'clock_correction', requestId: submitted.id },
    });
    expect(actions).toHaveLength(1);
  });

  it('different approver gets FORBIDDEN (not their subordinate)', async () => {
    await seedCompany();
    const approverA = await seedUser({
      id: 'u_approver_a',
      role: 'approver',
      email: 'a@example.com',
    });
    const approverB = await seedUser({
      id: 'u_approver_b',
      role: 'approver',
      email: 'b@example.com',
    });
    const general = await seedUser({
      id: 'u_general',
      role: 'general',
      email: 'g@example.com',
      managerId: approverA.id,
    });
    const submitted = await seedSubmittedCorrection(general.id);
    authMock.mockResolvedValue({ user: { id: approverB.id } });

    const result = await decideRequestAction({
      type: 'correction',
      id: submitted.id,
      decision: 'approve',
      comment: '',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');

    const reloaded = await prisma.clockCorrectionRequest.findUnique({
      where: { id: submitted.id },
    });
    expect(reloaded?.status).toBe('submitted');
  });
});
