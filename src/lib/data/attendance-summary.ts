import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { JST_TIMEZONE, MS_PER_MINUTE } from '@/lib/calc/constants';
import {
  listClocksForDate,
  listClocksForMonth,
  listClocksForUsersMonth,
  type MockTimeClock,
} from '@/lib/data/time-clocks';

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

// pure: 当日の clocks 配列を DailySummary に集約する。DB を触らない。
export function buildDailySummary(
  date: Date,
  clocks: MockTimeClock[],
): DailySummary {
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

export async function summarizeDay(
  userId: string,
  date: Date,
): Promise<DailySummary> {
  const clocks = await listClocksForDate(userId, date);
  return buildDailySummary(date, clocks);
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

// 月一括取得 + in-memory group。30 query → 1 query に圧縮する。
export async function summarizeMonth(
  userId: string,
  yearMonth: string,
): Promise<DailySummary[]> {
  const days = listMonthDays(yearMonth);
  const clocks = await listClocksForMonth(userId, yearMonth);
  const byKey = groupByJstDateKey(clocks);
  return days.map((d) => {
    const key = formatInTimeZone(d, JST_TIMEZONE, 'yyyy-MM-dd');
    return buildDailySummary(d, byKey.get(key) ?? []);
  });
}

// 複数 user の月次サマリを 1 query で構築する。admin/attendance のような
// ユーザーリスト × 月のテーブルを 600 query → 1 query で済ませる。
export async function summarizeMonthForUsers(
  userIds: string[],
  yearMonth: string,
): Promise<Map<string, DailySummary[]>> {
  const result = new Map<string, DailySummary[]>();
  if (userIds.length === 0) return result;
  const days = listMonthDays(yearMonth);
  const dayKeys = days.map((d) => ({
    date: d,
    key: formatInTimeZone(d, JST_TIMEZONE, 'yyyy-MM-dd'),
  }));
  const byUser = await listClocksForUsersMonth(userIds, yearMonth);
  for (const userId of userIds) {
    const byKey = groupByJstDateKey(byUser.get(userId) ?? []);
    result.set(
      userId,
      dayKeys.map(({ date, key }) =>
        buildDailySummary(date, byKey.get(key) ?? []),
      ),
    );
  }
  return result;
}

// pure: clocks を JST 日付キーで group する。
function groupByJstDateKey(
  clocks: MockTimeClock[],
): Map<string, MockTimeClock[]> {
  const byKey = new Map<string, MockTimeClock[]>();
  for (const c of clocks) {
    const key = formatInTimeZone(c.occurredAt, JST_TIMEZONE, 'yyyy-MM-dd');
    const arr = byKey.get(key) ?? [];
    arr.push(c);
    byKey.set(key, arr);
  }
  return byKey;
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
