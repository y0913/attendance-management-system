import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import type { TimeClockType } from '@prisma/client';
import { JST_TIMEZONE } from '@/lib/calc/constants';

export interface SeedRecord {
  userId: string;
  type: TimeClockType;
  occurredAt: Date;
}

const jstAt = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date => new Date(Date.UTC(year, month - 1, day, hour - 9, minute, 0));

type DayPattern = Array<[number, number, TimeClockType]>;

const PATTERN_STANDARD: DayPattern = [
  [9, 0, 'clock_in'],
  [12, 0, 'break_start'],
  [13, 0, 'break_end'],
  [18, 0, 'clock_out'],
];

const PATTERN_OVERTIME: DayPattern = [
  [9, 0, 'clock_in'],
  [12, 30, 'break_start'],
  [13, 30, 'break_end'],
  [21, 30, 'clock_out'],
];

const PATTERN_EARLY: DayPattern = [
  [8, 30, 'clock_in'],
  [12, 0, 'break_start'],
  [12, 45, 'break_end'],
  [17, 30, 'clock_out'],
];

const PATTERN_FORGOT_OUT: DayPattern = [
  [9, 0, 'clock_in'],
  [12, 0, 'break_start'],
  [13, 0, 'break_end'],
];

function pickPattern(daysAgo: number): DayPattern {
  const seq = daysAgo % 7;
  if (seq === 0) return PATTERN_OVERTIME;
  if (seq === 3) return PATTERN_FORGOT_OUT;
  if (seq === 5) return PATTERN_EARLY;
  return PATTERN_STANDARD;
}

export function buildSeedRecords(now: Date = new Date()): SeedRecord[] {
  const records: SeedRecord[] = [];
  const userId = 'u_general';

  for (let daysAgo = 60; daysAgo >= 1; daysAgo--) {
    const target = new Date(now);
    target.setUTCDate(target.getUTCDate() - daysAgo);

    const zoned = toZonedTime(target, JST_TIMEZONE);
    const dow = zoned.getDay();
    if (dow === 0 || dow === 6) continue;

    const targetJst = formatInTimeZone(target, JST_TIMEZONE, 'yyyy-MM-dd');
    const [yStr, mStr, dStr] = targetJst.split('-');
    const year = Number(yStr);
    const month = Number(mStr);
    const day = Number(dStr);

    for (const [h, min, type] of pickPattern(daysAgo)) {
      records.push({
        userId,
        type,
        occurredAt: jstAt(year, month, day, h, min),
      });
    }
  }

  return records;
}
