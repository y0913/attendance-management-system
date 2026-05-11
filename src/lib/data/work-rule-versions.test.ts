// work-rule-versions.ts の compliance violation 検出、CRUD、P2025 吸収、
// classifyVersionStatus / isFutureVersion / isValidFromTaken のロジックを検証。

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    workRuleVersion: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
  withTx: async <T,>(_db: unknown, fn: (tx: unknown) => Promise<T>) =>
    fn(prismaMock),
}));

import {
  checkComplianceViolations,
  classifyVersionStatus,
  createWorkRuleVersion,
  deleteWorkRuleVersion,
  isFutureVersion,
  isValidFromTaken,
  updateWorkRuleVersion,
  type MockWorkRuleVersion,
  type RuleInput,
} from './work-rule-versions';

const mkP2025 = () =>
  new Prisma.PrismaClientKnownRequestError('not found', {
    code: 'P2025',
    clientVersion: 'x',
  });

const okRule: RuleInput = {
  validFrom: new Date('2099-12-01'),
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
});

describe('checkComplianceViolations', () => {
  it('returns empty when all values meet legal minimum', () => {
    expect(checkComplianceViolations(okRule)).toEqual([]);
  });

  it.each([
    ['otRate', { otRate: 1.2 }, /法定外残業率/],
    ['nightRateAddition', { nightRateAddition: 0.2 }, /深夜割増/],
    ['legalHolidayRate', { legalHolidayRate: 1.3 }, /法定休日割増/],
    ['monthly60hOtRate', { monthly60hOtRate: 1.4 }, /月60h超の割増/],
    ['dailyOtThresholdMin (over max)', { dailyOtThresholdMin: 481 }, /日次残業閾値/],
    ['weeklyOtThresholdMin (over max)', { weeklyOtThresholdMin: 2401 }, /週次残業閾値/],
    ['monthly60hThresholdMin (over max)', { monthly60hThresholdMin: 3601 }, /月60h超の閾値/],
  ] as const)('detects violation: %s', (_label, partial, pattern) => {
    const violations = checkComplianceViolations({ ...okRule, ...partial });
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations.some((v) => pattern.test(v.message))).toBe(true);
  });

  it('returns multiple violations at once', () => {
    const violations = checkComplianceViolations({
      ...okRule,
      otRate: 1.0,
      nightRateAddition: 0.1,
    });
    expect(violations.length).toBe(2);
  });
});

describe('isFutureVersion / classifyVersionStatus', () => {
  const asOf = new Date('2026-05-08T00:00:00Z');
  const past: MockWorkRuleVersion = {
    id: 'wrv_past',
    validFrom: new Date('2026-04-01'),
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
    createdAt: new Date(),
    createdById: 'u_admin',
  };
  const current: MockWorkRuleVersion = { ...past, id: 'wrv_current', validFrom: new Date('2026-05-01') };
  const future: MockWorkRuleVersion = { ...past, id: 'wrv_future', validFrom: new Date('2099-01-01') };

  it('isFutureVersion: validFrom > now', () => {
    expect(isFutureVersion(future, asOf)).toBe(true);
    expect(isFutureVersion(current, asOf)).toBe(false);
    expect(isFutureVersion(past, asOf)).toBe(false);
  });

  it('classifyVersionStatus tags the most recent past version as current', () => {
    const all = [past, current, future];
    expect(classifyVersionStatus(past, all, asOf)).toBe('past');
    expect(classifyVersionStatus(current, all, asOf)).toBe('current');
    expect(classifyVersionStatus(future, all, asOf)).toBe('future');
  });

  it('boundary: validFrom exactly == asOf is treated as current (lte)', () => {
    const exact = { ...past, validFrom: asOf };
    expect(classifyVersionStatus(exact, [exact], asOf)).toBe('current');
  });
});

describe('createWorkRuleVersion', () => {
  it('inserts with companyId pinned and createdById', async () => {
    prismaMock.workRuleVersion.create.mockResolvedValueOnce({
      id: 'wrv_new',
      ...okRule,
      createdAt: new Date(),
      createdById: 'u_admin',
    });
    await createWorkRuleVersion('co_default', okRule, 'u_admin');
    const arg = prismaMock.workRuleVersion.create.mock.calls[0][0];
    expect(arg.data.companyId).toBe('co_default');
    expect(arg.data.createdById).toBe('u_admin');
  });
});

describe('updateWorkRuleVersion', () => {
  it('returns null on P2025', async () => {
    prismaMock.workRuleVersion.update.mockRejectedValueOnce(mkP2025());
    expect(await updateWorkRuleVersion('wrv_missing', okRule)).toBeNull();
  });

  it('rethrows non-P2025 errors', async () => {
    prismaMock.workRuleVersion.update.mockRejectedValueOnce(
      new Error('connection lost'),
    );
    await expect(updateWorkRuleVersion('wrv_x', okRule)).rejects.toThrow(
      /connection/,
    );
  });
});

describe('deleteWorkRuleVersion', () => {
  it('returns false on P2025', async () => {
    prismaMock.workRuleVersion.delete.mockRejectedValueOnce(mkP2025());
    expect(await deleteWorkRuleVersion('wrv_missing')).toBe(false);
  });

  it('returns true on success', async () => {
    prismaMock.workRuleVersion.delete.mockResolvedValueOnce({});
    expect(await deleteWorkRuleVersion('wrv_x')).toBe(true);
  });

  it('rethrows non-P2025 errors', async () => {
    prismaMock.workRuleVersion.delete.mockRejectedValueOnce(
      new Error('foreign key'),
    );
    await expect(deleteWorkRuleVersion('wrv_x')).rejects.toThrow(/foreign key/);
  });
});

describe('isValidFromTaken', () => {
  it('true when matching record exists', async () => {
    prismaMock.workRuleVersion.findFirst.mockResolvedValueOnce({ id: 'x' });
    expect(await isValidFromTaken('co_default', new Date('2099-12-01'))).toBe(
      true,
    );
  });

  it('false when no match', async () => {
    prismaMock.workRuleVersion.findFirst.mockResolvedValueOnce(null);
    expect(await isValidFromTaken('co_default', new Date('2099-12-01'))).toBe(
      false,
    );
  });

  it('exceptId excludes the given id from match', async () => {
    prismaMock.workRuleVersion.findFirst.mockResolvedValueOnce(null);
    await isValidFromTaken('co_default', new Date('2099-12-01'), 'wrv_self');
    const arg = prismaMock.workRuleVersion.findFirst.mock.calls[0][0];
    expect(arg.where).toMatchObject({ NOT: { id: 'wrv_self' } });
  });
});
