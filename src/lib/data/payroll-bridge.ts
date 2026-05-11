// mock store と Phase 1 の calc 層 (calcDailyAttendance / calcMonthlySummary /
// calcPremiumPay) を接続するブリッジ。
//
// - baseHourlyRate: 月給は `baseSalary / company.monthlyStandardHours`、
//   時給は baseSalary そのまま。
// - isLegalHoliday: 日付の JST 曜日が company.legalHolidayWeekday と一致するなら true。
//   ※ 祝日(holidays.ts)は法定休日とは別概念で、時間単価倍率は通常の所定外残業ルールで計算される。

import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
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
import { groupByJstDateKey, listMonthDays } from './attendance-summary';
import { getCompany, type MockCompany } from './companies';
import {
  listClocksForMonth,
  listClocksForUsersMonth,
  type MockTimeClock,
} from './time-clocks';
import { findMockUserById, findMockUsersByIds, type MockUser } from './users';
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

// pure: 既に取得済みの clocks 配列から月内日次の DailyAttendance を構築する。
const buildDailyAttendances = (
  days: Date[],
  clocks: MockTimeClock[],
  rule: WorkRuleVersion,
  legalHolidayWeekday: number,
): DailyAttendance[] => {
  const byKey = groupByJstDateKey(clocks);
  return days.map((dayDate) => {
    const key = formatInTimeZone(dayDate, JST_TIMEZONE, 'yyyy-MM-dd');
    const dayClocks = byKey.get(key) ?? [];
    const dow = toZonedTime(dayDate, JST_TIMEZONE).getDay();
    const isLegalHoliday = dow === legalHolidayWeekday;
    return calcDailyAttendance(dayClocks, dayDate, rule, isLegalHoliday);
  });
};

const buildPayrollResult = (
  user: MockUser,
  yearMonth: string,
  days: Date[],
  clocks: MockTimeClock[],
  rule: WorkRuleVersion,
  allRules: WorkRuleVersion[],
  company: MockCompany,
): MonthlyPayrollResult => {
  const dailyAttendances = buildDailyAttendances(
    days,
    clocks,
    rule,
    company.legalHolidayWeekday,
  );
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
  return { yearMonth, baseHourlyRate, rule, dailyAttendances, summary, premium };
};

const emptyResult = (yearMonth: string): MonthlyPayrollResult => ({
  yearMonth,
  baseHourlyRate: 0,
  rule: null,
  dailyAttendances: [],
  summary: null,
  premium: null,
});

export interface MonthlyPayrollResult {
  yearMonth: string;
  baseHourlyRate: number;
  rule: WorkRuleVersion | null;
  dailyAttendances: DailyAttendance[];
  summary: MonthlySummary | null;
  premium: PremiumPayBreakdown | null;
}

export async function computeMonthlyPayroll(
  userId: string,
  yearMonth: string,
): Promise<MonthlyPayrollResult> {
  const user = await findMockUserById(userId);
  if (!user) return emptyResult(yearMonth);

  const days = listMonthDays(yearMonth);
  const monthEndDate = days[days.length - 1] ?? new Date();
  const currentRule = await getCurrentWorkRuleVersion(user.companyId, monthEndDate);
  if (!currentRule) return emptyResult(yearMonth);

  const rule = toCalcWorkRuleVersion(currentRule);
  const allRules = (await listWorkRuleVersions(user.companyId)).map(
    toCalcWorkRuleVersion,
  );
  const company = await getCompany(user.companyId);
  const clocks = await listClocksForMonth(userId, yearMonth);

  return buildPayrollResult(user, yearMonth, days, clocks, rule, allRules, company);
}

// 複数 user × 月の super-batch 版。CSV レポートのように N 人分まとめて
// computeMonthlyPayroll を呼ぶケースで N+1 を解消する。
// 合計クエリ数: findMockUsersByIds (1) + getCurrentWorkRuleVersion (1) +
// listWorkRuleVersions (1) + getCompany (1) + listClocksForUsersMonth (1) = 5 query。
// 単発 × N (= 4N + 30N query) と比べて N に依存しない定数オーダーに圧縮される。
export async function computeMonthlyPayrollForUsers(
  companyId: string,
  userIds: string[],
  yearMonth: string,
): Promise<Map<string, MonthlyPayrollResult>> {
  const result = new Map<string, MonthlyPayrollResult>();
  if (userIds.length === 0) return result;

  const days = listMonthDays(yearMonth);
  const monthEndDate = days[days.length - 1] ?? new Date();
  const currentRule = await getCurrentWorkRuleVersion(companyId, monthEndDate);
  if (!currentRule) {
    for (const id of userIds) result.set(id, emptyResult(yearMonth));
    return result;
  }

  const rule = toCalcWorkRuleVersion(currentRule);
  const [allRulesRaw, company, users, clocksByUser] = await Promise.all([
    listWorkRuleVersions(companyId),
    getCompany(companyId),
    findMockUsersByIds(userIds),
    listClocksForUsersMonth(userIds, yearMonth),
  ]);
  const allRules = allRulesRaw.map(toCalcWorkRuleVersion);
  const userById = new Map(users.map((u) => [u.id, u]));

  for (const id of userIds) {
    const user = userById.get(id);
    if (!user) {
      result.set(id, emptyResult(yearMonth));
      continue;
    }
    const clocks = clocksByUser.get(id) ?? [];
    result.set(
      id,
      buildPayrollResult(user, yearMonth, days, clocks, rule, allRules, company),
    );
  }
  return result;
}
