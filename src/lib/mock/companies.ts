// Phase 2: 内部を Prisma 経由に書き換え。API 形は維持しつつ async 化。
//
// マルチテナント化は将来課題。骨組み段階では会社1社のみ前提で `co_default` 固定。

import type { Company, MidMonthRateChangeStrategy } from '@prisma/client';
import { prisma } from '@/lib/db';

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=日曜

export interface MockCompany {
  id: string;
  name: string;
  closingDay: number;
  midMonthRateChangeStrategy: MidMonthRateChangeStrategy;
  monthlyStandardHours: number;
  legalHolidayWeekday: Weekday;
}

const DEFAULT_COMPANY_ID = 'co_default';

// 暫定: monthlyStandardHours / legalHolidayWeekday は Prisma スキーマにまだ無いので
// プロセス内オーバーライドで保持する。スキーマ拡張時にマイグレーションで列追加する想定。
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

export async function getCompany(): Promise<MockCompany> {
  const c = await prisma.company.findUnique({
    where: { id: DEFAULT_COMPANY_ID },
  });
  if (!c) {
    throw new Error(
      `Default company (${DEFAULT_COMPANY_ID}) not found. Run \`npx prisma db seed\`.`,
    );
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
  input: UpdateCompanyInput,
): Promise<MockCompany> {
  if (input.monthlyStandardHours !== undefined) {
    overrides.monthlyStandardHours = input.monthlyStandardHours;
  }
  if (input.legalHolidayWeekday !== undefined) {
    overrides.legalHolidayWeekday = input.legalHolidayWeekday;
  }
  const updated = await prisma.company.update({
    where: { id: DEFAULT_COMPANY_ID },
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
