import type { MidMonthRateChangeStrategy } from '@prisma/client';

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=日曜

export interface MockCompany {
  id: string;
  name: string;
  closingDay: number; // 1-31, 0=月末
  midMonthRateChangeStrategy: MidMonthRateChangeStrategy;
  monthlyStandardHours: number; // 月所定労働時間（時給単価計算用）
  legalHolidayWeekday: Weekday; // 法定休日の曜日（一般的に日曜）
}

const DEFAULT_COMPANY_ID = 'co_default';

const store: MockCompany = {
  id: DEFAULT_COMPANY_ID,
  name: 'サンプル株式会社',
  closingDay: 0,
  midMonthRateChangeStrategy: 'month_end',
  monthlyStandardHours: 176,
  legalHolidayWeekday: 0,
};

export function getCompany(): MockCompany {
  return { ...store };
}

export interface UpdateCompanyInput {
  name?: string;
  closingDay?: number;
  midMonthRateChangeStrategy?: MidMonthRateChangeStrategy;
  monthlyStandardHours?: number;
  legalHolidayWeekday?: Weekday;
}

export function updateCompany(input: UpdateCompanyInput): MockCompany {
  if (input.name !== undefined) store.name = input.name;
  if (input.closingDay !== undefined) store.closingDay = input.closingDay;
  if (input.midMonthRateChangeStrategy !== undefined) {
    store.midMonthRateChangeStrategy = input.midMonthRateChangeStrategy;
  }
  if (input.monthlyStandardHours !== undefined) {
    store.monthlyStandardHours = input.monthlyStandardHours;
  }
  if (input.legalHolidayWeekday !== undefined) {
    store.legalHolidayWeekday = input.legalHolidayWeekday;
  }
  return { ...store };
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
