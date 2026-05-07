// updateCompanySettingsAction の認可・バリデーション・audit log 連動を検証。

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, usersMock, companiesMock, auditLogMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  usersMock: {
    findMockUserById: vi.fn(),
  },
  companiesMock: {
    getCompany: vi.fn(),
    updateCompany: vi.fn(),
  },
  auditLogMock: vi.fn(),
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

vi.mock('@/lib/data/companies', () => companiesMock);

vi.mock('@/lib/data/audit-logs', () => ({ recordAuditLog: auditLogMock }));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { updateCompanySettingsAction } from './actions';

const adminUser = {
  id: 'u_admin',
  email: 'admin@example.com',
  name: '管理 太郎',
  role: 'admin',
  managerId: null,
  employmentType: 'monthly',
  hiredAt: new Date('2018-04-01'),
  baseSalary: 600000,
  deactivatedAt: null,
};
const general = { ...adminUser, id: 'u_general', role: 'general' };

const baseCompany = {
  id: 'co_default',
  name: '勤怠管理株式会社',
  closingDay: 0,
  midMonthRateChangeStrategy: 'month_end' as const,
  monthlyStandardHours: 176,
  legalHolidayWeekday: 0 as const,
};

const validInput = {
  name: '更新後の社名',
  closingDay: 25,
  midMonthRateChangeStrategy: 'daily' as const,
  monthlyStandardHours: 160,
  legalHolidayWeekday: 6 as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: 'u_admin' } });
  usersMock.findMockUserById.mockImplementation(async (id: string) => {
    if (id === 'u_admin') return adminUser;
    if (id === 'u_general') return general;
    return null;
  });
  companiesMock.getCompany.mockResolvedValue(baseCompany);
  companiesMock.updateCompany.mockResolvedValue({
    ...baseCompany,
    ...validInput,
  });
});

describe('updateCompanySettingsAction (auth)', () => {
  it('UNAUTHORIZED if no session', async () => {
    authMock.mockResolvedValueOnce(null);
    const result = await updateCompanySettingsAction(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNAUTHORIZED');
  });

  it('FORBIDDEN if non-admin', async () => {
    authMock.mockResolvedValueOnce({ user: { id: 'u_general' } });
    const result = await updateCompanySettingsAction(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });
});

describe('updateCompanySettingsAction (validation)', () => {
  it('VALIDATION on empty name', async () => {
    const result = await updateCompanySettingsAction({
      ...validInput,
      name: '',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });

  it('VALIDATION on closingDay out of range', async () => {
    const result = await updateCompanySettingsAction({
      ...validInput,
      closingDay: 32,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });

  it('VALIDATION on monthlyStandardHours out of range', async () => {
    const result = await updateCompanySettingsAction({
      ...validInput,
      monthlyStandardHours: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });

  it('VALIDATION on bad strategy', async () => {
    const result = await updateCompanySettingsAction({
      ...validInput,
      midMonthRateChangeStrategy: 'invalid' as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });
});

describe('updateCompanySettingsAction (success)', () => {
  it('updates company and records audit log with before/after', async () => {
    const result = await updateCompanySettingsAction(validInput);
    expect(result.ok).toBe(true);
    expect(companiesMock.updateCompany).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '更新後の社名', // trim 適用後
        closingDay: 25,
        midMonthRateChangeStrategy: 'daily',
      }),
      expect.anything(),
    );
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'company',
        action: 'update',
        before: baseCompany,
      }),
      expect.anything(),
    );
  });

  it('trims whitespace from name', async () => {
    await updateCompanySettingsAction({
      ...validInput,
      name: '  社名  ',
    });
    expect(companiesMock.updateCompany).toHaveBeenCalledWith(
      expect.objectContaining({ name: '社名' }),
      expect.anything(),
    );
  });
});

describe('updateCompanySettingsAction (internal error)', () => {
  it('returns INTERNAL when updateCompany throws', async () => {
    companiesMock.updateCompany.mockRejectedValueOnce(new Error('db down'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await updateCompanySettingsAction(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INTERNAL');
    errSpy.mockRestore();
  });
});
