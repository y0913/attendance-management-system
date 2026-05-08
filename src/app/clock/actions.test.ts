// punchClockAction の認可・状態遷移バリデーション・成功パスを検証。

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, usersMock, clocksMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  usersMock: {
    findMockUserById: vi.fn(),
  },
  clocksMock: {
    appendClock: vi.fn(),
    getClockState: vi.fn(),
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

vi.mock('@/lib/data/time-clocks', () => clocksMock);

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { punchClockAction } from './actions';

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

describe('punchClockAction (auth)', () => {
  it('UNAUTHORIZED if no session', async () => {
    authMock.mockResolvedValueOnce(null);
    const result = await punchClockAction({ type: 'clock_in' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNAUTHORIZED');
  });
});

describe('punchClockAction (validation)', () => {
  it('VALIDATION on unknown type', async () => {
    const result = await punchClockAction({ type: 'invalid' as never });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });
});

describe('punchClockAction (state machine)', () => {
  it.each([
    ['not_clocked_in', 'clock_out'],
    ['not_clocked_in', 'break_start'],
    ['not_clocked_in', 'break_end'],
    ['working', 'clock_in'],
    ['working', 'break_end'],
    ['on_break', 'clock_in'],
    ['on_break', 'clock_out'],
    ['on_break', 'break_start'],
    ['clocked_out', 'clock_in'],
    ['clocked_out', 'clock_out'],
    ['clocked_out', 'break_start'],
    ['clocked_out', 'break_end'],
  ] as const)('CONFLICT when state=%s and type=%s', async (state, type) => {
    clocksMock.getClockState.mockResolvedValueOnce(state);
    const result = await punchClockAction({ type });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CONFLICT');
    expect(clocksMock.appendClock).not.toHaveBeenCalled();
  });

  it.each([
    ['not_clocked_in', 'clock_in'],
    ['working', 'clock_out'],
    ['working', 'break_start'],
    ['on_break', 'break_end'],
  ] as const)('allows state=%s → type=%s', async (state, type) => {
    clocksMock.getClockState.mockResolvedValueOnce(state);
    const result = await punchClockAction({ type });
    expect(result.ok).toBe(true);
    expect(clocksMock.appendClock).toHaveBeenCalledWith('u_general', type);
  });
});

describe('punchClockAction (internal error)', () => {
  it('returns INTERNAL when appendClock throws', async () => {
    clocksMock.getClockState.mockResolvedValueOnce('not_clocked_in');
    clocksMock.appendClock.mockRejectedValueOnce(new Error('db down'));
    const result = await punchClockAction({ type: 'clock_in' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INTERNAL');
  });
});
