// closeMonthAction / uncloseAction の認可・state 遷移・audit log 連動を検証。
// bulkCloseMonthAction の集計ロジックも 1 ケース確認する。

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, usersMock, closingsMock, auditLogMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  usersMock: {
    findMockUserById: vi.fn(),
    listActiveUsers: vi.fn(),
  },
  closingsMock: {
    closeMonth: vi.fn(),
    deleteClosing: vi.fn(),
    findClosingById: vi.fn(),
  },
  auditLogMock: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: async <T,>(fn: (tx: unknown) => Promise<T>) => fn({}),
  },
  withTx: async <T,>(_db: unknown, fn: (tx: unknown) => Promise<T>) => fn({}),
  withRetry: async <T,>(fn: () => Promise<T>) => fn(),
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

vi.mock('@/lib/data/attendance-closings', () => closingsMock);

vi.mock('@/lib/data/audit-logs', () => ({ recordAuditLog: auditLogMock }));

import {
  bulkCloseMonthAction,
  closeMonthAction,
  uncloseAction,
} from './actions';
import { adminUser, generalUser } from '@/test/fixtures';

const general = generalUser;

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: 'u_admin' } });
  usersMock.findMockUserById.mockImplementation(async (id: string) => {
    if (id === 'u_admin') return adminUser;
    if (id === 'u_general') return general;
    return null;
  });
});

const mkClosing = (overrides: Record<string, unknown> = {}) => ({
  id: 'ac_001',
  userId: 'u_general',
  yearMonth: '2026-04',
  closedAt: new Date('2026-05-01T00:00:00Z'),
  closedById: 'u_admin',
  snapshot: { yearMonth: '2026-04', daily: [] },
  ...overrides,
});

describe('closeMonthAction (auth)', () => {
  it('UNAUTHORIZED if no session', async () => {
    authMock.mockResolvedValueOnce(null);
    const result = await closeMonthAction({
      userId: 'u_general',
      yearMonth: '2026-04',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNAUTHORIZED');
  });

  it('FORBIDDEN if non-admin', async () => {
    authMock.mockResolvedValueOnce({ user: { id: 'u_general' } });
    const result = await closeMonthAction({
      userId: 'u_general',
      yearMonth: '2026-04',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });
});

describe('closeMonthAction (validation)', () => {
  it('VALIDATION on bad yearMonth format', async () => {
    const result = await closeMonthAction({
      userId: 'u_general',
      yearMonth: '2026/04', // wrong separator
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });

  it('VALIDATION on month out of range', async () => {
    const result = await closeMonthAction({
      userId: 'u_general',
      yearMonth: '2026-13',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });

  it('NOT_FOUND when target user does not exist', async () => {
    const result = await closeMonthAction({
      userId: 'u_nonexistent',
      yearMonth: '2026-04',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND');
  });
});

describe('closeMonthAction (success / conflict)', () => {
  it('closes month and records audit log', async () => {
    closingsMock.closeMonth.mockResolvedValueOnce(mkClosing());
    const result = await closeMonthAction({
      userId: 'u_general',
      yearMonth: '2026-04',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.closingId).toBe('ac_001');
    expect(closingsMock.closeMonth).toHaveBeenCalledWith(
      'u_general',
      '2026-04',
      'u_admin',
      expect.anything(),
    );
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'attendance_closing',
        action: 'close',
      }),
      expect.anything(),
    );
  });

  it('CONFLICT when already closed (closeMonth returns null)', async () => {
    closingsMock.closeMonth.mockResolvedValueOnce(null);
    const result = await closeMonthAction({
      userId: 'u_general',
      yearMonth: '2026-04',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CONFLICT');
      expect(
        'message' in result.error ? result.error.message : '',
      ).toMatch(/締め済み/);
    }
    // 既に締め済みなら audit log は記録しない
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

describe('closeMonthAction (internal error)', () => {
  it('returns INTERNAL when closeMonth throws', async () => {
    closingsMock.closeMonth.mockRejectedValueOnce(new Error('db down'));
    const result = await closeMonthAction({
      userId: 'u_general',
      yearMonth: '2026-04',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INTERNAL');
  });
});

describe('bulkCloseMonthAction', () => {
  it('aggregates closed and skipped counts across users', async () => {
    usersMock.listActiveUsers.mockResolvedValueOnce([
      { ...general, id: 'u_a' },
      { ...general, id: 'u_b' },
      { ...general, id: 'u_c' },
    ]);
    closingsMock.closeMonth
      .mockResolvedValueOnce(mkClosing({ id: 'ac_a', userId: 'u_a' }))
      .mockResolvedValueOnce(null) // already closed
      .mockResolvedValueOnce(mkClosing({ id: 'ac_c', userId: 'u_c' }));

    const result = await bulkCloseMonthAction({ yearMonth: '2026-04' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.closedCount).toBe(2);
      expect(result.data.skippedCount).toBe(1);
    }
    expect(auditLogMock).toHaveBeenCalledTimes(2);
  });
});

describe('uncloseAction', () => {
  it('deletes closing and records delete audit log', async () => {
    closingsMock.findClosingById.mockResolvedValueOnce(mkClosing());
    closingsMock.deleteClosing.mockResolvedValueOnce(mkClosing());
    const result = await uncloseAction({ closingId: 'ac_001' });
    expect(result.ok).toBe(true);
    expect(closingsMock.deleteClosing).toHaveBeenCalledWith(
      'ac_001',
      expect.anything(),
    );
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'attendance_closing',
        action: 'delete',
      }),
      expect.anything(),
    );
  });

  it('NOT_FOUND when closing does not exist', async () => {
    closingsMock.findClosingById.mockResolvedValueOnce(null);
    const result = await uncloseAction({ closingId: 'ac_missing' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND');
    expect(closingsMock.deleteClosing).not.toHaveBeenCalled();
  });
});
