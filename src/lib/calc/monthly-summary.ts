import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { JST_TIMEZONE } from './constants';
import { getEffectiveRule } from './effective-rule';
import type {
  DailyAttendance,
  MidMonthRateChangeStrategy,
  MonthlySummary,
  WorkRuleVersion,
} from './types';

function jstYearMonth(d: Date): string {
  return formatInTimeZone(d, JST_TIMEZONE, 'yyyy-MM');
}

function lastDayOfMonthJst(yearMonth: string): Date {
  const [y, m] = yearMonth.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const yyyy = String(y).padStart(4, '0');
  const mm = String(m).padStart(2, '0');
  const dd = String(lastDay).padStart(2, '0');
  return fromZonedTime(`${yyyy}-${mm}-${dd} 00:00:00`, JST_TIMEZONE);
}

export function calcMonthlySummary(
  dailyAttendances: DailyAttendance[],
  yearMonth: string,
  rules: WorkRuleVersion[],
  strategy: MidMonthRateChangeStrategy,
): MonthlySummary {
  const inMonth = dailyAttendances.filter(
    (d) => jstYearMonth(d.workDate) === yearMonth,
  );
  const resolved = inMonth.filter((d) => d.status === 'resolved');
  const exceptionDaysCount = inMonth.length - resolved.length;

  const sorted = [...resolved].sort(
    (a, b) => a.workDate.getTime() - b.workDate.getTime(),
  );

  const monthEndRule =
    strategy === 'month_end'
      ? getEffectiveRule(rules, lastDayOfMonthJst(yearMonth))
      : null;

  const thresholdFor = (date: Date): number => {
    if (strategy === 'month_end') {
      return monthEndRule!.monthly60hThresholdMin;
    }
    return getEffectiveRule(rules, date).monthly60hThresholdMin;
  };

  let regularWorkMinutes = 0;
  let regularNightMinutes = 0;
  let regularOtMinutes = 0;
  let regularOtNightMinutes = 0;
  let monthly60hOtMinutes = 0;
  let monthly60hOtNightMinutes = 0;
  let legalHolidayWorkMinutes = 0;
  let legalHolidayNightMinutes = 0;

  let cumOt = 0;

  for (const day of sorted) {
    const dayWork = day.workMinutes ?? 0;
    const dayNight = day.nightMinutes ?? 0;

    if (day.legalHolidayFlag) {
      legalHolidayNightMinutes += dayNight;
      legalHolidayWorkMinutes += dayWork - dayNight;
      continue;
    }

    const dayOt = day.otMinutes ?? 0;
    const dayOtNight = day.otNightMinutes ?? 0;

    const th = thresholdFor(day.workDate);
    const prevCum = cumOt;
    cumOt += dayOt;

    let underOt: number;
    let overOt: number;
    if (cumOt <= th) {
      underOt = dayOt;
      overOt = 0;
    } else if (prevCum >= th) {
      underOt = 0;
      overOt = dayOt;
    } else {
      underOt = th - prevCum;
      overOt = dayOt - underOt;
    }

    let underOtNight: number;
    let overOtNight: number;
    if (dayOt > 0) {
      underOtNight = Math.floor((underOt * dayOtNight) / dayOt);
      overOtNight = dayOtNight - underOtNight;
    } else {
      underOtNight = 0;
      overOtNight = 0;
    }

    regularOtMinutes += underOt - underOtNight;
    regularOtNightMinutes += underOtNight;
    monthly60hOtMinutes += overOt - overOtNight;
    monthly60hOtNightMinutes += overOtNight;

    const nonOtNight = dayNight - dayOtNight;
    regularNightMinutes += nonOtNight;
    regularWorkMinutes += dayWork - dayOt - nonOtNight;
  }

  return {
    yearMonth,
    regularWorkMinutes,
    regularNightMinutes,
    regularOtMinutes,
    regularOtNightMinutes,
    monthly60hOtMinutes,
    monthly60hOtNightMinutes,
    legalHolidayWorkMinutes,
    legalHolidayNightMinutes,
    exceptionDaysCount,
  };
}
