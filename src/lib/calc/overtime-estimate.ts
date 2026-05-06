// 36協定アラート用の月次残業時間「概算」を計算する pure function。
// 正式な calc 層 (calcMonthlySummary) が integratedになるまでの暫定実装で、
// 単純に「合計勤務時間 − 営業日数 × 8h」を残業概算とする。
// 実装が calc/monthly-summary.ts と接続されたらこの関数は削除して
// monthlySummary.regularOtMinutes を直接参照する想定。

import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { JST_TIMEZONE } from './constants';

const STANDARD_DAILY_MINUTES = 480; // 1日 8 時間
const MONTHLY_60H_THRESHOLD_MIN = 3600; // 60 時間

export const OVERTIME_ALERT_THRESHOLD_MIN = MONTHLY_60H_THRESHOLD_MIN;

const isWeekend = (jstDate: string): boolean => {
  const d = new Date(`${jstDate}T00:00:00+09:00`);
  const day = toZonedTime(d, JST_TIMEZONE).getDay();
  return day === 0 || day === 6;
};

export interface DailyEntryForEstimate {
  date: string;
  workMinutes: number | null;
}

export interface OvertimeEstimate {
  totalWorkMinutes: number;
  workedDays: number;
  businessDaysInMonth: number; // 月内の平日数（祝日は未対応）
  estimatedOtMinutes: number;
  exceedsThreshold: boolean;
}

const enumerateDates = (yearMonth: string): string[] => {
  const [yStr, mStr] = yearMonth.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const dates: string[] = [];
  const cursor = new Date(Date.UTC(year, month - 1, 1, -9, 0, 0));
  while (true) {
    const ymKey = formatInTimeZone(cursor, JST_TIMEZONE, 'yyyy-MM');
    if (ymKey !== yearMonth) break;
    dates.push(formatInTimeZone(cursor, JST_TIMEZONE, 'yyyy-MM-dd'));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
};

export function estimateMonthlyOvertime(
  yearMonth: string,
  daily: DailyEntryForEstimate[],
): OvertimeEstimate {
  const totalWorkMinutes = daily.reduce(
    (sum, d) => sum + (d.workMinutes ?? 0),
    0,
  );
  const workedDays = daily.filter((d) => d.workMinutes != null).length;
  const businessDaysInMonth = enumerateDates(yearMonth).filter(
    (d) => !isWeekend(d),
  ).length;

  const baselineMinutes = businessDaysInMonth * STANDARD_DAILY_MINUTES;
  const estimatedOtMinutes = Math.max(0, totalWorkMinutes - baselineMinutes);

  return {
    totalWorkMinutes,
    workedDays,
    businessDaysInMonth,
    estimatedOtMinutes,
    exceedsThreshold: estimatedOtMinutes > OVERTIME_ALERT_THRESHOLD_MIN,
  };
}
