// getCompany / updateCompany と過渡的な overrides (monthlyStandardHours / legalHolidayWeekday) の挙動を検証。

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    company: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
  withTx: async <T,>(_db: unknown, fn: (tx: unknown) => Promise<T>) =>
    fn(prismaMock),
}));

import { getCompany, updateCompany } from './companies';

const dbCompany = {
  id: 'co_default',
  name: '勤怠管理株式会社',
  closingDay: 0,
  midMonthRateChangeStrategy: 'month_end' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getCompany', () => {
  it('throws when company is not seeded', async () => {
    prismaMock.company.findUnique.mockResolvedValueOnce(null);
    await expect(getCompany()).rejects.toThrow(/db seed/);
  });

  it('returns MockCompany merged with overrides', async () => {
    prismaMock.company.findUnique.mockResolvedValueOnce(dbCompany);
    const c = await getCompany();
    expect(c.id).toBe('co_default');
    expect(c.midMonthRateChangeStrategy).toBe('month_end');
    // overrides フィールドはデフォルト or 直前テストの上書き値
    expect(typeof c.monthlyStandardHours).toBe('number');
    expect(c.legalHolidayWeekday).toBeGreaterThanOrEqual(0);
    expect(c.legalHolidayWeekday).toBeLessThanOrEqual(6);
  });
});

describe('updateCompany', () => {
  it('updates DB columns and returns mapped result', async () => {
    prismaMock.company.update.mockResolvedValueOnce({
      ...dbCompany,
      name: '新社名',
      closingDay: 25,
      midMonthRateChangeStrategy: 'daily',
    });
    const c = await updateCompany({
      name: '新社名',
      closingDay: 25,
      midMonthRateChangeStrategy: 'daily',
    });
    expect(prismaMock.company.update).toHaveBeenCalledWith({
      where: { id: 'co_default' },
      data: expect.objectContaining({
        name: '新社名',
        closingDay: 25,
        midMonthRateChangeStrategy: 'daily',
      }),
    });
    expect(c.name).toBe('新社名');
  });

  it('persists monthlyStandardHours via overrides (not DB)', async () => {
    prismaMock.company.update.mockResolvedValueOnce(dbCompany);
    await updateCompany({ monthlyStandardHours: 160 });
    // monthlyStandardHours は DB 側の data には含まれない (スキーマに列なし)
    const arg = prismaMock.company.update.mock.calls[0][0];
    expect(arg.data).not.toHaveProperty('monthlyStandardHours');

    // 次回 getCompany で 160 が反映される
    prismaMock.company.findUnique.mockResolvedValueOnce(dbCompany);
    const c = await getCompany();
    expect(c.monthlyStandardHours).toBe(160);
  });

  it('persists legalHolidayWeekday via overrides', async () => {
    prismaMock.company.update.mockResolvedValueOnce(dbCompany);
    await updateCompany({ legalHolidayWeekday: 6 });
    prismaMock.company.findUnique.mockResolvedValueOnce(dbCompany);
    const c = await getCompany();
    expect(c.legalHolidayWeekday).toBe(6);
  });
});
