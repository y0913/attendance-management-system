// data layer のロジックテスト。Prisma client は vi.mock で差し替え。
// users.ts の findMockUserById も同様に差し替えて、manager 解決を検証する。

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    leaveRequest: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db', () => ({ prisma: prismaMock }));

vi.mock('./users', () => ({
  findMockUserById: vi.fn(async (id: string) => {
    if (id === 'u_general')
      return {
        id: 'u_general',
        email: 'general@example.com',
        name: '一般 次郎',
        role: 'general',
        managerId: 'u_approver',
        employmentType: 'monthly',
        hiredAt: new Date('2023-10-01'),
        baseSalary: 300000,
        deactivatedAt: null,
      };
    return null;
  }),
}));

import {
  decideLeave,
  submitLeave,
  withdrawLeave,
} from './leave-requests';

const fakeRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'lr_test',
  requesterId: 'u_general',
  status: 'submitted',
  currentApproverId: 'u_approver',
  submittedAt: new Date('2026-04-15T00:00:00Z'),
  decidedAt: null,
  reason: 'reason',
  leaveType: 'annual',
  dayUnit: 'full',
  startDate: new Date('2026-04-20T00:00:00+09:00'),
  endDate: new Date('2026-04-20T00:00:00+09:00'),
  days: 1,
  createdAt: new Date('2026-04-15T00:00:00Z'),
  updatedAt: new Date('2026-04-15T00:00:00Z'),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('submitLeave', () => {
  it('rejects half-day with multiple dates', async () => {
    const result = await submitLeave({
      requesterId: 'u_general',
      leaveType: 'paid',
      dayUnit: 'half',
      startDate: '2026-04-20',
      endDate: '2026-04-21',
      reason: '半日',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('HALF_DAY_REQUIRES_SINGLE_DATE');
    }
    expect(prismaMock.leaveRequest.create).not.toHaveBeenCalled();
  });

  it('creates with 0.5 days for half-day', async () => {
    prismaMock.leaveRequest.create.mockResolvedValueOnce(
      fakeRow({ dayUnit: 'half', days: 0.5 }),
    );
    const result = await submitLeave({
      requesterId: 'u_general',
      leaveType: 'paid',
      dayUnit: 'half',
      startDate: '2026-04-20',
      endDate: '2026-04-20',
      reason: '通院',
    });
    expect(result.ok).toBe(true);
    expect(prismaMock.leaveRequest.create).toHaveBeenCalledOnce();
    const arg = prismaMock.leaveRequest.create.mock.calls[0][0];
    expect(arg.data.days).toBe(0.5);
    expect(arg.data.currentApproverId).toBe('u_approver');
  });

  it('counts business days for full-day range (excludes weekends/holidays)', async () => {
    prismaMock.leaveRequest.create.mockResolvedValueOnce(fakeRow());
    // 2026-05-01 (金) 〜 2026-05-08 (金): 営業日は 5/1, 5/7, 5/8 の 3 日
    // (5/3-5/6 は GW で祝日 + 振替、5/2,5/9 は土日)
    await submitLeave({
      requesterId: 'u_general',
      leaveType: 'paid',
      dayUnit: 'full',
      startDate: '2026-05-01',
      endDate: '2026-05-08',
      reason: 'GW',
    });
    const arg = prismaMock.leaveRequest.create.mock.calls[0][0];
    expect(arg.data.days).toBe(3);
  });
});

describe('withdrawLeave', () => {
  it('FORBIDDEN if requester mismatches', async () => {
    prismaMock.leaveRequest.findUnique.mockResolvedValueOnce(
      fakeRow({ requesterId: 'u_other' }),
    );
    const result = await withdrawLeave({ id: 'lr_test', requesterId: 'u_general' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('FORBIDDEN');
    expect(prismaMock.leaveRequest.update).not.toHaveBeenCalled();
  });

  it('NOT_PENDING if status is already approved', async () => {
    prismaMock.leaveRequest.findUnique.mockResolvedValueOnce(
      fakeRow({ status: 'approved' }),
    );
    const result = await withdrawLeave({ id: 'lr_test', requesterId: 'u_general' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('NOT_PENDING');
  });

  it('updates status to withdrawn for own submitted request', async () => {
    prismaMock.leaveRequest.findUnique.mockResolvedValueOnce(fakeRow());
    prismaMock.leaveRequest.update.mockResolvedValueOnce(
      fakeRow({ status: 'withdrawn', currentApproverId: null, decidedAt: new Date() }),
    );
    const result = await withdrawLeave({ id: 'lr_test', requesterId: 'u_general' });
    expect(result.ok).toBe(true);
    const arg = prismaMock.leaveRequest.update.mock.calls[0][0];
    expect(arg.data.status).toBe('withdrawn');
    expect(arg.data.currentApproverId).toBe(null);
  });
});

describe('decideLeave', () => {
  it('FORBIDDEN if non-admin and approver mismatches', async () => {
    prismaMock.leaveRequest.findUnique.mockResolvedValueOnce(
      fakeRow({ currentApproverId: 'u_other' }),
    );
    const result = await decideLeave({
      id: 'lr_test',
      deciderId: 'u_approver',
      decision: 'approve',
      isAdmin: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('FORBIDDEN');
  });

  it('admin can decide regardless of currentApproverId', async () => {
    prismaMock.leaveRequest.findUnique.mockResolvedValueOnce(
      fakeRow({ currentApproverId: 'u_other' }),
    );
    prismaMock.leaveRequest.update.mockResolvedValueOnce(
      fakeRow({ status: 'approved', decidedAt: new Date() }),
    );
    const result = await decideLeave({
      id: 'lr_test',
      deciderId: 'u_admin',
      decision: 'approve',
      isAdmin: true,
    });
    expect(result.ok).toBe(true);
    expect(prismaMock.leaveRequest.update).toHaveBeenCalledOnce();
  });

  it('maps decision to next status (approve/reject/return)', async () => {
    for (const [decision, expected] of [
      ['approve', 'approved'],
      ['reject', 'rejected'],
      ['return', 'returned'],
    ] as const) {
      prismaMock.leaveRequest.findUnique.mockResolvedValueOnce(fakeRow());
      prismaMock.leaveRequest.update.mockResolvedValueOnce(
        fakeRow({ status: expected }),
      );
      await decideLeave({
        id: 'lr_test',
        deciderId: 'u_approver',
        decision,
        isAdmin: false,
      });
      const arg =
        prismaMock.leaveRequest.update.mock.calls[
          prismaMock.leaveRequest.update.mock.calls.length - 1
        ][0];
      expect(arg.data.status).toBe(expected);
    }
  });
});
