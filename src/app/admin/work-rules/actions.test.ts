// upsertWorkRuleAction / deleteWorkRuleAction の認可・compliance チェック・
// 未来バージョンのみ編集可ルール・audit log 連動を検証。

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, usersMock, rulesMock, auditLogMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  usersMock: {
    findMockUserById: vi.fn(),
  },
  rulesMock: {
    checkComplianceViolations: vi.fn(),
    createWorkRuleVersion: vi.fn(),
    deleteWorkRuleVersion: vi.fn(),
    findWorkRuleVersionById: vi.fn(),
    isFutureVersion: vi.fn(),
    isValidFromTaken: vi.fn(),
    updateWorkRuleVersion: vi.fn(),
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

vi.mock('@/lib/data/work-rule-versions', () => rulesMock);

vi.mock('@/lib/data/audit-logs', () => ({ recordAuditLog: auditLogMock }));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { deleteWorkRuleAction, upsertWorkRuleAction } from './actions';

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

// 未来日 (テスト実行時点より明らかに先)。
const FUTURE_DATE = '2099-12-01';

const validRuleInput = {
  validFrom: FUTURE_DATE,
  dailyOtThresholdMin: 480,
  weeklyOtThresholdMin: 2400,
  otRate: 1.25,
  nightStartTime: '22:00',
  nightEndTime: '05:00',
  nightRateAddition: 0.25,
  legalHolidayRate: 1.35,
  monthly60hOtRate: 1.5,
  monthly60hThresholdMin: 3600,
  complianceMode: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: 'u_admin' } });
  usersMock.findMockUserById.mockImplementation(async (id: string) => {
    if (id === 'u_admin') return adminUser;
    if (id === 'u_general') return general;
    return null;
  });
  rulesMock.checkComplianceViolations.mockReturnValue([]);
  rulesMock.isValidFromTaken.mockResolvedValue(false);
  rulesMock.isFutureVersion.mockReturnValue(true);
});

describe('upsertWorkRuleAction (auth)', () => {
  it('UNAUTHORIZED if no session', async () => {
    authMock.mockResolvedValueOnce(null);
    const result = await upsertWorkRuleAction(validRuleInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNAUTHORIZED');
  });

  it('FORBIDDEN if non-admin', async () => {
    authMock.mockResolvedValueOnce({ user: { id: 'u_general' } });
    const result = await upsertWorkRuleAction(validRuleInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });
});

describe('upsertWorkRuleAction (validation)', () => {
  it('VALIDATION on bad time format', async () => {
    const result = await upsertWorkRuleAction({
      ...validRuleInput,
      nightStartTime: '25:00',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });

  it('CONFLICT when validFrom is today or past', async () => {
    const result = await upsertWorkRuleAction({
      ...validRuleInput,
      validFrom: '2020-01-01',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CONFLICT');
      expect(
        'message' in result.error ? result.error.message : '',
      ).toMatch(/明日以降/);
    }
  });
});

describe('upsertWorkRuleAction (compliance)', () => {
  it('CONFLICT when compliance_mode=true and violations exist', async () => {
    rulesMock.checkComplianceViolations.mockReturnValueOnce([
      { field: 'otRate', message: '法定外残業率は 1.25 以上が必要です' },
    ]);
    const result = await upsertWorkRuleAction(validRuleInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CONFLICT');
      expect(
        'message' in result.error ? result.error.message : '',
      ).toMatch(/法定下限違反/);
    }
    expect(rulesMock.createWorkRuleVersion).not.toHaveBeenCalled();
  });

  it('skips compliance check when compliance_mode=false', async () => {
    // compliance_mode=false なら checkComplianceViolations を呼ばない
    rulesMock.createWorkRuleVersion.mockResolvedValueOnce({ id: 'wrv_001' });
    await upsertWorkRuleAction({
      ...validRuleInput,
      complianceMode: false,
    });
    expect(rulesMock.checkComplianceViolations).not.toHaveBeenCalled();
  });
});

describe('upsertWorkRuleAction (validFrom uniqueness)', () => {
  it('CONFLICT when validFrom already taken by another version', async () => {
    rulesMock.isValidFromTaken.mockResolvedValueOnce(true);
    const result = await upsertWorkRuleAction(validRuleInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CONFLICT');
      expect(
        'message' in result.error ? result.error.message : '',
      ).toMatch(/別バージョン/);
    }
  });
});

describe('upsertWorkRuleAction (create success)', () => {
  it('creates new version and records audit log', async () => {
    rulesMock.createWorkRuleVersion.mockResolvedValueOnce({ id: 'wrv_new' });
    const result = await upsertWorkRuleAction(validRuleInput);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe('wrv_new');
    expect(rulesMock.createWorkRuleVersion).toHaveBeenCalledOnce();
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'work_rule_version',
        action: 'create',
      }),
      expect.anything(),
    );
  });
});

describe('upsertWorkRuleAction (update path)', () => {
  it('NOT_FOUND when target id does not exist', async () => {
    rulesMock.findWorkRuleVersionById.mockResolvedValueOnce(null);
    const result = await upsertWorkRuleAction({
      ...validRuleInput,
      id: 'wrv_missing',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND');
  });

  it('CONFLICT when target is current/past version', async () => {
    rulesMock.findWorkRuleVersionById.mockResolvedValueOnce({
      id: 'wrv_existing',
      validFrom: new Date('2020-01-01'),
    });
    rulesMock.isFutureVersion.mockReturnValueOnce(false);
    const result = await upsertWorkRuleAction({
      ...validRuleInput,
      id: 'wrv_existing',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CONFLICT');
      expect(
        'message' in result.error ? result.error.message : '',
      ).toMatch(/現行・過去バージョン/);
    }
    expect(rulesMock.updateWorkRuleVersion).not.toHaveBeenCalled();
  });

  it('updates future version and records audit log', async () => {
    rulesMock.findWorkRuleVersionById.mockResolvedValueOnce({
      id: 'wrv_future',
      validFrom: new Date(FUTURE_DATE),
    });
    rulesMock.updateWorkRuleVersion.mockResolvedValueOnce({ id: 'wrv_future' });
    const result = await upsertWorkRuleAction({
      ...validRuleInput,
      id: 'wrv_future',
    });
    expect(result.ok).toBe(true);
    expect(rulesMock.updateWorkRuleVersion).toHaveBeenCalledOnce();
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'work_rule_version',
        action: 'update',
      }),
      expect.anything(),
    );
  });
});

describe('upsertWorkRuleAction (internal error)', () => {
  it('returns INTERNAL when create throws', async () => {
    rulesMock.createWorkRuleVersion.mockRejectedValueOnce(new Error('boom'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await upsertWorkRuleAction(validRuleInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INTERNAL');
    errSpy.mockRestore();
  });
});

describe('deleteWorkRuleAction', () => {
  it('UNAUTHORIZED if no session', async () => {
    authMock.mockResolvedValueOnce(null);
    const result = await deleteWorkRuleAction({ id: 'wrv_001' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNAUTHORIZED');
  });

  it('FORBIDDEN if non-admin', async () => {
    authMock.mockResolvedValueOnce({ user: { id: 'u_general' } });
    const result = await deleteWorkRuleAction({ id: 'wrv_001' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });

  it('NOT_FOUND when target id does not exist', async () => {
    rulesMock.findWorkRuleVersionById.mockResolvedValueOnce(null);
    const result = await deleteWorkRuleAction({ id: 'wrv_missing' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND');
  });

  it('CONFLICT when target is current/past version', async () => {
    rulesMock.findWorkRuleVersionById.mockResolvedValueOnce({
      id: 'wrv_existing',
      validFrom: new Date('2020-01-01'),
    });
    rulesMock.isFutureVersion.mockReturnValueOnce(false);
    const result = await deleteWorkRuleAction({ id: 'wrv_existing' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CONFLICT');
    expect(rulesMock.deleteWorkRuleVersion).not.toHaveBeenCalled();
  });

  it('deletes future version and records audit log', async () => {
    rulesMock.findWorkRuleVersionById.mockResolvedValueOnce({
      id: 'wrv_future',
      validFrom: new Date(FUTURE_DATE),
    });
    rulesMock.deleteWorkRuleVersion.mockResolvedValueOnce(true);
    const result = await deleteWorkRuleAction({ id: 'wrv_future' });
    expect(result.ok).toBe(true);
    expect(rulesMock.deleteWorkRuleVersion).toHaveBeenCalledWith(
      'wrv_future',
      expect.anything(),
    );
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'work_rule_version',
        action: 'delete',
      }),
      expect.anything(),
    );
  });
});
