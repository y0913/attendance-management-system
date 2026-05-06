import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { JST_TIMEZONE, MS_PER_MINUTE } from '@/lib/calc/constants';
import {
  listClocksForDate,
  type MockTimeClock,
} from '@/lib/mock/time-clocks';

export interface DailySummary {
  date: Date;
  jstDateKey: string;
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  clockIn: MockTimeClock | null;
  clockOut: MockTimeClock | null;
  breakMinutes: number;
  workMinutes: number | null;
  hasOpenBreak: boolean;
}

const minutesBetween = (a: Date, b: Date): number =>
  Math.round((b.getTime() - a.getTime()) / MS_PER_MINUTE);

export async function summarizeDay(
  userId: string,
  date: Date,
): Promise<DailySummary> {
  const clocks = await listClocksForDate(userId, date);
  const clockIn = clocks.find((c) => c.type === 'clock_in') ?? null;
  const clockOut = clocks.find((c) => c.type === 'clock_out') ?? null;

  let breakMinutes = 0;
  let openBreakStart: Date | null = null;
  for (const c of clocks) {
    if (c.type === 'break_start') {
      openBreakStart = c.occurredAt;
    } else if (c.type === 'break_end' && openBreakStart) {
      breakMinutes += minutesBetween(openBreakStart, c.occurredAt);
      openBreakStart = null;
    }
  }

  const workMinutes =
    clockIn && clockOut
      ? Math.max(0, minutesBetween(clockIn.occurredAt, clockOut.occurredAt) - breakMinutes)
      : null;

  const jst = toZonedTime(date, JST_TIMEZONE);

  return {
    date,
    jstDateKey: formatInTimeZone(date, JST_TIMEZONE, 'yyyy-MM-dd'),
    weekday: jst.getDay() as DailySummary['weekday'],
    clockIn,
    clockOut,
    breakMinutes,
    workMinutes,
    hasOpenBreak: openBreakStart !== null,
  };
}

export function listMonthDays(yearMonth: string): Date[] {
  const [yStr, mStr] = yearMonth.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    throw new Error(`Invalid yearMonth: ${yearMonth}`);
  }
  const days: Date[] = [];
  const cursor = new Date(Date.UTC(year, month - 1, 1, -9, 0, 0));
  while (true) {
    const ymKey = formatInTimeZone(cursor, JST_TIMEZONE, 'yyyy-MM');
    if (ymKey !== yearMonth) break;
    days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export async function summarizeMonth(
  userId: string,
  yearMonth: string,
): Promise<DailySummary[]> {
  const days = listMonthDays(yearMonth);
  return Promise.all(days.map((d) => summarizeDay(userId, d)));
}

export function totalWorkMinutes(summaries: DailySummary[]): number {
  return summaries.reduce(
    (sum, s) => sum + (s.workMinutes ?? 0),
    0,
  );
}

export function shiftYearMonth(yearMonth: string, delta: number): string {
  const [yStr, mStr] = yearMonth.split('-');
  let year = Number(yStr);
  let month = Number(mStr) + delta;
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function currentYearMonthJst(date: Date = new Date()): string {
  return formatInTimeZone(date, JST_TIMEZONE, 'yyyy-MM');
}
