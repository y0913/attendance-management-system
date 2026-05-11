import type { Company, MidMonthRateChangeStrategy } from '@prisma/client';
import { prisma, type DbClient } from '@/lib/db';

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=日曜

export interface MockCompany {
  id: string;
  name: string;
  closingDay: number;
  midMonthRateChangeStrategy: MidMonthRateChangeStrategy;
  monthlyStandardHours: number;
  legalHolidayWeekday: Weekday;
}

// monthlyStandardHours / legalHolidayWeekday は Prisma スキーマに列がなく、
// プロセス内オーバーライドで保持する。マルチテナントでは本来 companyId 単位に
// 分けるべきだが、portfolio 用途で「全社共通の運用値」として割り切る。
const overrides: { monthlyStandardHours: number; legalHolidayWeekday: Weekday } = {
  monthlyStandardHours: 176,
  legalHolidayWeekday: 0,
};

const toMockCompany = (c: Company): MockCompany => ({
  id: c.id,
  name: c.name,
  closingDay: c.closingDay,
  midMonthRateChangeStrategy: c.midMonthRateChangeStrategy,
  monthlyStandardHours: overrides.monthlyStandardHours,
  legalHolidayWeekday: overrides.legalHolidayWeekday,
});

export async function getCompany(companyId: string): Promise<MockCompany> {
  const c = await prisma.company.findUnique({ where: { id: companyId } });
  if (!c) {
    throw new Error(`Company (${companyId}) not found.`);
  }
  return toMockCompany(c);
}

export interface UpdateCompanyInput {
  name?: string;
  closingDay?: number;
  midMonthRateChangeStrategy?: MidMonthRateChangeStrategy;
  monthlyStandardHours?: number;
  legalHolidayWeekday?: Weekday;
}

export async function updateCompany(
  companyId: string,
  input: UpdateCompanyInput,
  db: DbClient = prisma,
): Promise<MockCompany> {
  if (input.monthlyStandardHours !== undefined) {
    overrides.monthlyStandardHours = input.monthlyStandardHours;
  }
  if (input.legalHolidayWeekday !== undefined) {
    overrides.legalHolidayWeekday = input.legalHolidayWeekday;
  }
  const updated = await db.company.update({
    where: { id: companyId },
    data: {
      name: input.name,
      closingDay: input.closingDay,
      midMonthRateChangeStrategy: input.midMonthRateChangeStrategy,
    },
  });
  return toMockCompany(updated);
}

export const CLOSING_DAY_LABEL = (n: number): string =>
  n === 0 ? '月末' : `毎月 ${n} 日`;

export const STRATEGY_LABEL: Record<MidMonthRateChangeStrategy, string> = {
  daily: '日次戦略（その日のルールで計算）',
  month_end: '月末戦略（月末のルールで月全体を計算）',
};

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  0: '日',
  1: '月',
  2: '火',
  3: '水',
  4: '木',
  5: '金',
  6: '土',
};
