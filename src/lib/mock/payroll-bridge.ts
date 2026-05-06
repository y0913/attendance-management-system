// mock store と Phase 1 の calc 層 (calcDailyAttendance / calcMonthlySummary /
// calcPremiumPay) を接続するブリッジ。
//
// - baseHourlyRate: 月給は `baseSalary / company.monthlyStandardHours`、
//   時給は baseSalary そのまま。
// - isLegalHoliday: 日付の JST 曜日が company.legalHolidayWeekday と一致するなら true。
//   ※ 祝日(holidays.ts)は法定休日とは別概念で、時間単価倍率は通常の所定外残業ルールで計算される。

import { toZonedTime } from 'date-fns-tz';
import { JST_TIMEZONE } from '@/lib/calc/constants';
import { calcDailyAttendance } from '@/lib/calc/daily-attendance';
import { calcMonthlySummary } from '@/lib/calc/monthly-summary';
import { calcPremiumPay } from '@/lib/calc/premium-pay';
import type {
  DailyAttendance,
  MonthlySummary,
  PremiumPayBreakdown,
  WorkRuleVersion,
} from '@/lib/calc/types';
import { listMonthDays } from './attendance-summary';
import { getCompany } from './companies';
import { listClocksForDate } from './time-clocks';
import { findMockUserById } from './users';
import {
  getCurrentWorkRuleVersion,
  listWorkRuleVersions,
  type MockWorkRuleVersion,
} from './work-rule-versions';

const toCalcWorkRuleVersion = (v: MockWorkRuleVersion): WorkRuleVersion => ({
  validFrom: v.validFrom,
  dailyOtThresholdMin: v.dailyOtThresholdMin,
  weeklyOtThresholdMin: v.weeklyOtThresholdMin,
  otRate: v.otRate,
  nightStartTime: v.nightStartTime,
  nightEndTime: v.nightEndTime,
  nightRateAddition: v.nightRateAddition,
  legalHolidayRate: v.legalHolidayRate,
  monthly60hOtRate: v.monthly60hOtRate,
  monthly60hThresholdMin: v.monthly60hThresholdMin,
  complianceMode: v.complianceMode,
});

const computeBaseHourlyRate = (
  baseSalary: number | null,
  employmentType: 'monthly' | 'hourly',
  monthlyStandardHours: number,
): number => {
  if (baseSalary == null) return 0;
  if (employmentType === 'hourly') return baseSalary;
  if (monthlyStandardHours <= 0) return 0;
  return baseSalary / monthlyStandardHours;
};

export interface MonthlyPayrollResult {
  yearMonth: string;
  baseHourlyRate: number;
  rule: WorkRuleVersion | null;
  dailyAttendances: DailyAttendance[];
  summary: MonthlySummary | null;
  premium: PremiumPayBreakdown | null;
}

export function computeMonthlyPayroll(
  userId: string,
  yearMonth: string,
): MonthlyPayrollResult {
  const user = findMockUserById(userId);
  if (!user) {
    return {
      yearMonth,
      baseHourlyRate: 0,
      rule: null,
      dailyAttendances: [],
      summary: null,
      premium: null,
    };
  }

  const days = listMonthDays(yearMonth);
  const monthEndDate = days[days.length - 1] ?? new Date();
  const currentRule = getCurrentWorkRuleVersion(monthEndDate);
  if (!currentRule) {
    return {
      yearMonth,
      baseHourlyRate: 0,
      rule: null,
      dailyAttendances: [],
      summary: null,
      premium: null,
    };
  }
  const rule = toCalcWorkRuleVersion(currentRule);
  const allRules = listWorkRuleVersions().map(toCalcWorkRuleVersion);

  const company = getCompany();

  const dailyAttendances: DailyAttendance[] = days.map((dayDate) => {
    const clocks = listClocksForDate(userId, dayDate);
    const dow = toZonedTime(dayDate, JST_TIMEZONE).getDay();
    const isLegalHoliday = dow === company.legalHolidayWeekday;
    return calcDailyAttendance(clocks, dayDate, rule, isLegalHoliday);
  });

  const summary = calcMonthlySummary(
    dailyAttendances,
    yearMonth,
    allRules,
    company.midMonthRateChangeStrategy,
  );

  const baseHourlyRate = computeBaseHourlyRate(
    user.baseSalary,
    user.employmentType,
    company.monthlyStandardHours,
  );
  const premium = calcPremiumPay(summary, baseHourlyRate, rule);

  return {
    yearMonth,
    baseHourlyRate,
    rule,
    dailyAttendances,
    summary,
    premium,
  };
}
