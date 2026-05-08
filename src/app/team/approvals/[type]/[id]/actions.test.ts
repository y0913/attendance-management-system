// decideRequestAction の認可・状態遷移・tx 内合成（decide + recordApprovalAction）を検証。

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, usersMock, decideMock, recordMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  usersMock: {
    findMockUserById: vi.fn(),
  },
  decideMock: {
    decideCorrection: vi.fn(),
    decideLeave: vi.fn(),
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
  decideCorrection: decideMock.decideCorrection,
}));

vi.mock('@/lib/data/leave-requests', () => ({
  decideLeave: decideMock.decideLeave,
}));

vi.mock('@/lib/data/approval-actions', () => ({
  APPROVAL_COMMENT_MAX_LENGTH: 500,
  recordApprovalAction: recordMock,
}));

import { decideRequestAction } from './actions';
import { adminUser, approverUser, generalUser } from '@/test/fixtures';

const approver = approverUser;
const general = generalUser;

const validInput = {
  type: 'correction' as const,
  id: 'ccr_001',
  decision: 'approve' as const,
  comment: '確認しました',
};

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: 'u_approver' } });
  usersMock.findMockUserById.mockImplementation(async (id: string) => {
    if (id === 'u_approver') return approver;
    if (id === 'u_admin') return adminUser;
    if (id === 'u_general') return general;
    return null;
  });
});

describe('decideRequestAction (auth / authorization)', () => {
  it('UNAUTHORIZED if no session', async () => {
    authMock.mockResolvedValueOnce(null);
    const result = await decideRequestAction(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNAUTHORIZED');
  });

  it('FORBIDDEN if general user tries to decide', async () => {
    authMock.mockResolvedValueOnce({ user: { id: 'u_general' } });
    const result = await decideRequestAction(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });

  it('admin is allowed (passes role guard, then data layer enforces ownership)', async () => {
    authMock.mockResolvedValueOnce({ user: { id: 'u_admin' } });
    decideMock.decideCorrection.mockResolvedValueOnce({
      ok: true,
      request: {
        id: 'ccr_001',
        requesterId: 'u_general',
        targetDate: '2026-04-10',
      },
    });
    const result = await decideRequestAction(validInput);
    expect(result.ok).toBe(true);
    // admin として data 層に isAdmin: true で渡る
    expect(decideMock.decideCorrection).toHaveBeenCalledWith(
      expect.objectContaining({ deciderId: 'u_admin', isAdmin: true }),
      expect.anything(),
    );
  });
});

describe('decideRequestAction (validation)', () => {
  it('VALIDATION if input shape is wrong', async () => {
    const result = await decideRequestAction({
      ...validInput,
      decision: 'invalid' as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });
});

describe('decideRequestAction (data layer rejection mapping)', () => {
  it('NOT_FOUND if request does not exist', async () => {
    decideMock.decideCorrection.mockResolvedValueOnce({
      ok: false,
      reason: 'NOT_FOUND',
    });
    const result = await decideRequestAction(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND');
  });

  it('FORBIDDEN if approver is not the assigned approver', async () => {
    decideMock.decideCorrection.mockResolvedValueOnce({
      ok: false,
      reason: 'FORBIDDEN',
    });
    const result = await decideRequestAction(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });

  it('CONFLICT if request is already processed', async () => {
    decideMock.decideCorrection.mockResolvedValueOnce({
      ok: false,
      reason: 'NOT_PENDING',
    });
    const result = await decideRequestAction(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CONFLICT');
  });

  it('does NOT record approval action when decide fails', async () => {
    decideMock.decideCorrection.mockResolvedValueOnce({
      ok: false,
      reason: 'NOT_PENDING',
    });
    await decideRequestAction(validInput);
    expect(recordMock).not.toHaveBeenCalled();
  });
});

describe('decideRequestAction (success path)', () => {
  it('approves correction and records approval action', async () => {
    decideMock.decideCorrection.mockResolvedValueOnce({
      ok: true,
      request: {
        id: 'ccr_001',
        requesterId: 'u_general',
        targetDate: '2026-04-10',
      },
    });
    const result = await decideRequestAction(validInput);
    expect(result.ok).toBe(true);
    expect(decideMock.decideCorrection).toHaveBeenCalledOnce();
    expect(recordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requestType: 'correction',
        requestId: 'ccr_001',
        action: 'approve',
        comment: '確認しました',
      }),
      expect.anything(),
    );
  });

  it('passes leave to decideLeave path', async () => {
    decideMock.decideLeave.mockResolvedValueOnce({
      ok: true,
      request: { id: 'lr_001', requesterId: 'u_general' },
    });
    const result = await decideRequestAction({
      ...validInput,
      type: 'leave',
      id: 'lr_001',
    });
    expect(result.ok).toBe(true);
    expect(decideMock.decideLeave).toHaveBeenCalledOnce();
    expect(decideMock.decideCorrection).not.toHaveBeenCalled();
    expect(recordMock).toHaveBeenCalledWith(
      expect.objectContaining({ requestType: 'leave', action: 'approve' }),
      expect.anything(),
    );
  });

  it('reject decision is recorded with reject action', async () => {
    decideMock.decideCorrection.mockResolvedValueOnce({
      ok: true,
      request: { id: 'ccr_001', requesterId: 'u_general', targetDate: '2026-04-10' },
    });
    await decideRequestAction({ ...validInput, decision: 'reject' });
    expect(recordMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'reject' }),
      expect.anything(),
    );
  });

  it('return decision is recorded with return action', async () => {
    decideMock.decideCorrection.mockResolvedValueOnce({
      ok: true,
      request: { id: 'ccr_001', requesterId: 'u_general', targetDate: '2026-04-10' },
    });
    await decideRequestAction({ ...validInput, decision: 'return' });
    expect(recordMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'return' }),
      expect.anything(),
    );
  });

  it('empty comment is stored as null', async () => {
    decideMock.decideCorrection.mockResolvedValueOnce({
      ok: true,
      request: { id: 'ccr_001', requesterId: 'u_general', targetDate: '2026-04-10' },
    });
    await decideRequestAction({ ...validInput, comment: '   ' });
    expect(recordMock).toHaveBeenCalledWith(
      expect.objectContaining({ comment: null }),
      expect.anything(),
    );
  });
});

describe('decideRequestAction (internal error)', () => {
  it('returns INTERNAL when data layer throws unexpectedly', async () => {
    decideMock.decideCorrection.mockRejectedValueOnce(new Error('boom'));
    const result = await decideRequestAction(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INTERNAL');
  });
});
