// submitLeaveAction の認可・複合バリデーション（半日 vs 全日、営業日チェック）・成功パスを検証。

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, usersMock, leaveMock, holidaysMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  usersMock: {
    findMockUserById: vi.fn(),
  },
  leaveMock: {
    submitLeave: vi.fn(),
    countBusinessDaysBetween: vi.fn(),
  },
  holidaysMock: {
    isBusinessDay: vi.fn(),
  },
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

vi.mock('@/lib/data/leave-requests', () => ({
  LEAVE_REASON_MAX_LENGTH: 500,
  submitLeave: leaveMock.submitLeave,
  countBusinessDaysBetween: leaveMock.countBusinessDaysBetween,
}));

vi.mock('@/lib/calc/holidays', () => ({
  isBusinessDay: holidaysMock.isBusinessDay,
}));

import { submitLeaveAction } from './actions';
import { generalUser } from '@/test/fixtures';

const general = generalUser;

const validFullInput = {
  dayUnit: 'full' as const,
  startDate: '2026-04-13',
  endDate: '2026-04-15',
  reason: '私用のため',
};

const validHalfInput = {
  dayUnit: 'half' as const,
  startDate: '2026-04-13',
  endDate: '2026-04-13',
  reason: '通院のため',
};

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: 'u_general' } });
  usersMock.findMockUserById.mockImplementation(async (id: string) =>
    id === 'u_general' ? general : null,
  );
  leaveMock.countBusinessDaysBetween.mockReturnValue(3);
  holidaysMock.isBusinessDay.mockReturnValue(true);
});

describe('submitLeaveAction (auth)', () => {
  it('UNAUTHORIZED if no session', async () => {
    authMock.mockResolvedValueOnce(null);
    const result = await submitLeaveAction(validFullInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNAUTHORIZED');
  });
});

describe('submitLeaveAction (schema validation)', () => {
  it('VALIDATION on bad date format', async () => {
    const result = await submitLeaveAction({
      ...validFullInput,
      startDate: '2026/04/13',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });

  it('VALIDATION when endDate < startDate', async () => {
    const result = await submitLeaveAction({
      ...validFullInput,
      startDate: '2026-04-15',
      endDate: '2026-04-13',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });

  it('VALIDATION when half-day spans multiple dates', async () => {
    const result = await submitLeaveAction({
      ...validHalfInput,
      endDate: '2026-04-14',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });

  it('VALIDATION on empty reason', async () => {
    const result = await submitLeaveAction({ ...validFullInput, reason: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });
});

describe('submitLeaveAction (business day rules)', () => {
  it('VALIDATION when half-day target is not a business day', async () => {
    holidaysMock.isBusinessDay.mockReturnValueOnce(false);
    const result = await submitLeaveAction(validHalfInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
    expect(leaveMock.submitLeave).not.toHaveBeenCalled();
  });

  it('VALIDATION when full-day range contains zero business days', async () => {
    leaveMock.countBusinessDaysBetween.mockReturnValueOnce(0);
    const result = await submitLeaveAction(validFullInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
    expect(leaveMock.submitLeave).not.toHaveBeenCalled();
  });
});

describe('submitLeaveAction (success)', () => {
  it('submits full-day leave', async () => {
    leaveMock.submitLeave.mockResolvedValueOnce({
      ok: true,
      request: { id: 'lr_001' },
    });
    const result = await submitLeaveAction(validFullInput);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe('lr_001');
    expect(leaveMock.submitLeave).toHaveBeenCalledWith(
      expect.objectContaining({
        requesterId: 'u_general',
        leaveType: 'paid',
        dayUnit: 'full',
        startDate: '2026-04-13',
        endDate: '2026-04-15',
      }),
    );
  });

  it('submits half-day leave', async () => {
    leaveMock.submitLeave.mockResolvedValueOnce({
      ok: true,
      request: { id: 'lr_002' },
    });
    const result = await submitLeaveAction(validHalfInput);
    expect(result.ok).toBe(true);
    expect(leaveMock.submitLeave).toHaveBeenCalledWith(
      expect.objectContaining({ dayUnit: 'half' }),
    );
  });

  it('CONFLICT when data layer reports half-day mismatch', async () => {
    leaveMock.submitLeave.mockResolvedValueOnce({
      ok: false,
      reason: 'HALF_DAY_REQUIRES_SINGLE_DATE',
    });
    const result = await submitLeaveAction(validHalfInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CONFLICT');
  });
});

describe('submitLeaveAction (internal error)', () => {
  it('returns INTERNAL when submitLeave throws', async () => {
    leaveMock.submitLeave.mockRejectedValueOnce(new Error('boom'));
    const result = await submitLeaveAction(validFullInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INTERNAL');
  });
});
