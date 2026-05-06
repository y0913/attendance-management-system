import type { MidMonthRateChangeStrategy } from '@prisma/client';

export interface MockCompany {
  id: string;
  name: string;
  closingDay: number; // 1-31, 0=月末
  midMonthRateChangeStrategy: MidMonthRateChangeStrategy;
}

const DEFAULT_COMPANY_ID = 'co_default';

const store: MockCompany = {
  id: DEFAULT_COMPANY_ID,
  name: 'サンプル株式会社',
  closingDay: 0,
  midMonthRateChangeStrategy: 'month_end',
};

export function getCompany(): MockCompany {
  return { ...store };
}

export interface UpdateCompanyInput {
  name?: string;
  closingDay?: number;
  midMonthRateChangeStrategy?: MidMonthRateChangeStrategy;
}

export function updateCompany(input: UpdateCompanyInput): MockCompany {
  if (input.name !== undefined) store.name = input.name;
  if (input.closingDay !== undefined) store.closingDay = input.closingDay;
  if (input.midMonthRateChangeStrategy !== undefined) {
    store.midMonthRateChangeStrategy = input.midMonthRateChangeStrategy;
  }
  return { ...store };
}

export const CLOSING_DAY_LABEL = (n: number): string =>
  n === 0 ? '月末' : `毎月 ${n} 日`;

export const STRATEGY_LABEL: Record<MidMonthRateChangeStrategy, string> = {
  daily: '日次戦略（その日のルールで計算）',
  month_end: '月末戦略（月末のルールで月全体を計算）',
};
