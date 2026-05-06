// mock store と Phase 1 の calc 層 (calcDailyAttendance / calcMonthlySummary /
// calcPremiumPay) を接続するブリッジ。
//
// 注意:
// - 法定休日フラグ (legalHolidayFlag) は mock では false 固定。日曜＝法定休日
//   などの判定ロジックを company-level config と接続するのは別タスク。
// - baseHourlyRate は月給→ `baseSalary / (22 × 8)` の概算、時給→ baseSalary そのまま。
//   実務では月所定労働時間を会社設定に持つべき。

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

const ASSUMED_MONTHLY_HOURS = 22 * 8; // 暫定: 月176時間想定

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
): number => {
  if (baseSalary == null) return 0;
  if (employmentType === 'hourly') return baseSalary;
  return baseSalary / ASSUMED_MONTHLY_HOURS;
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

  const dailyAttendances: DailyAttendance[] = days.map((dayDate) => {
    const clocks = listClocksForDate(userId, dayDate);
    return calcDailyAttendance(clocks, dayDate, rule, false);
  });

  const company = getCompany();
  const summary = calcMonthlySummary(
    dailyAttendances,
    yearMonth,
    allRules,
    company.midMonthRateChangeStrategy,
  );

  const baseHourlyRate = computeBaseHourlyRate(
    user.baseSalary,
    user.employmentType,
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
