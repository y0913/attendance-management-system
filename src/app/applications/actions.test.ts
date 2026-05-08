// withdrawRequestAction の認可・対象種別マッピング・tx 内合成（withdraw + recordApprovalAction）を検証。

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, usersMock, withdrawMock, recordMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  usersMock: {
    findMockUserById: vi.fn(),
  },
  withdrawMock: {
    withdrawCorrection: vi.fn(),
    withdrawLeave: vi.fn(),
  },
  recordMock: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: async <T,>(fn: (tx: unknown) => Promise<T>) => fn({}),
  },
  withTx: async <T,>(_db: unknown, fn: (tx: unknown) => Promise<T>) => fn({}),
}));

vi.mock('@/auth', () => ({ auth: authMock }));

vi.mock('@/lib/data/session', () => ({
  getMockSession: async () => {
    const session = await authMock();
    if (!session?.user?.id) return null;
    return usersMock.findMockUserById(session.user.id);
  },
}));

vi.mock('@/lib/data/users', () => usersMock);

vi.mock('@/lib/data/clock-corrections', () => ({
  withdrawCorrection: withdrawMock.withdrawCorrection,
}));

vi.mock('@/lib/data/leave-requests', () => ({
  withdrawLeave: withdrawMock.withdrawLeave,
}));

vi.mock('@/lib/data/approval-actions', () => ({
  recordApprovalAction: recordMock,
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { withdrawRequestAction } from './actions';

const general = {
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

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: 'u_general' } });
  usersMock.findMockUserById.mockImplementation(async (id: string) =>
    id === 'u_general' ? general : null,
  );
});

describe('withdrawRequestAction (auth)', () => {
  it('UNAUTHORIZED if no session', async () => {
    authMock.mockResolvedValueOnce(null);
    const result = await withdrawRequestAction({
      type: 'correction',
      id: 'ccr_001',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNAUTHORIZED');
  });
});

describe('withdrawRequestAction (validation)', () => {
  it('VALIDATION on unknown type', async () => {
    const result = await withdrawRequestAction({
      type: 'invalid' as never,
      id: 'x',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });
});

describe('withdrawRequestAction (data layer rejection mapping)', () => {
  it('NOT_FOUND when request missing', async () => {
    withdrawMock.withdrawCorrection.mockResolvedValueOnce({
      ok: false,
      reason: 'NOT_FOUND',
    });
    const result = await withdrawRequestAction({
      type: 'correction',
      id: 'ccr_missing',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND');
  });

  it('FORBIDDEN if requester is not the owner', async () => {
    withdrawMock.withdrawCorrection.mockResolvedValueOnce({
      ok: false,
      reason: 'FORBIDDEN',
    });
    const result = await withdrawRequestAction({
      type: 'correction',
      id: 'ccr_001',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });

  it('CONFLICT if already processed', async () => {
    withdrawMock.withdrawCorrection.mockResolvedValueOnce({
      ok: false,
      reason: 'NOT_PENDING',
    });
    const result = await withdrawRequestAction({
      type: 'correction',
      id: 'ccr_001',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CONFLICT');
  });

  it('does NOT record approval action when withdraw fails', async () => {
    withdrawMock.withdrawCorrection.mockResolvedValueOnce({
      ok: false,
      reason: 'NOT_PENDING',
    });
    await withdrawRequestAction({ type: 'correction', id: 'ccr_001' });
    expect(recordMock).not.toHaveBeenCalled();
  });
});

describe('withdrawRequestAction (success)', () => {
  it('routes correction → withdrawCorrection and records withdraw action', async () => {
    withdrawMock.withdrawCorrection.mockResolvedValueOnce({
      ok: true,
      request: { id: 'ccr_001', targetDate: '2026-04-10' },
    });
    const result = await withdrawRequestAction({
      type: 'correction',
      id: 'ccr_001',
    });
    expect(result.ok).toBe(true);
    expect(withdrawMock.withdrawCorrection).toHaveBeenCalledOnce();
    expect(withdrawMock.withdrawLeave).not.toHaveBeenCalled();
    expect(recordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requestType: 'correction',
        requestId: 'ccr_001',
        action: 'withdraw',
        comment: null,
      }),
      expect.anything(),
    );
  });

  it('routes leave → withdrawLeave', async () => {
    withdrawMock.withdrawLeave.mockResolvedValueOnce({
      ok: true,
      request: { id: 'lr_001' },
    });
    const result = await withdrawRequestAction({
      type: 'leave',
      id: 'lr_001',
    });
    expect(result.ok).toBe(true);
    expect(withdrawMock.withdrawLeave).toHaveBeenCalledOnce();
    expect(withdrawMock.withdrawCorrection).not.toHaveBeenCalled();
    expect(recordMock).toHaveBeenCalledWith(
      expect.objectContaining({ requestType: 'leave' }),
      expect.anything(),
    );
  });
});

describe('withdrawRequestAction (internal error)', () => {
  it('returns INTERNAL when data layer throws', async () => {
    withdrawMock.withdrawCorrection.mockRejectedValueOnce(new Error('boom'));
    const result = await withdrawRequestAction({
      type: 'correction',
      id: 'ccr_001',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INTERNAL');
  });
});
