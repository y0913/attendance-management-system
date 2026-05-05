import {
  JST_OFFSET_MS,
  MINUTES_PER_HOUR,
  MS_PER_DAY,
  MS_PER_MINUTE,
} from './constants';
import type {
  DailyAttendance,
  DailyAttendanceStatus,
  TimeClock,
  WorkRuleVersion,
} from './types';

type Interval = [number, number];

function jstDayIndex(utcMs: number): number {
  return Math.floor((utcMs + JST_OFFSET_MS) / MS_PER_DAY);
}

function jstMidnightUtcMs(dayIndex: number): number {
  return dayIndex * MS_PER_DAY - JST_OFFSET_MS;
}

function parseHmToMs(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return (h * MINUTES_PER_HOUR + m) * MS_PER_MINUTE;
}

function intersect(a: Interval, b: Interval): Interval | null {
  const lo = Math.max(a[0], b[0]);
  const hi = Math.min(a[1], b[1]);
  if (lo >= hi) return null;
  return [lo, hi];
}

function intersectMany(as: Interval[], bs: Interval[]): Interval[] {
  const result: Interval[] = [];
  for (const a of as) {
    for (const b of bs) {
      const r = intersect(a, b);
      if (r !== null) result.push(r);
    }
  }
  return result;
}

function subtract(intervals: Interval[], remove: Interval[]): Interval[] {
  let result = [...intervals];
  for (const r of remove) {
    const next: Interval[] = [];
    for (const i of result) {
      if (r[1] <= i[0] || r[0] >= i[1]) {
        next.push(i);
      } else {
        if (i[0] < r[0]) next.push([i[0], r[0]]);
        if (r[1] < i[1]) next.push([r[1], i[1]]);
      }
    }
    result = next;
  }
  return result;
}

function totalMs(intervals: Interval[]): number {
  return intervals.reduce((s, [a, b]) => s + (b - a), 0);
}

function totalMinutes(intervals: Interval[]): number {
  return Math.round(totalMs(intervals) / MS_PER_MINUTE);
}

function takeLast(intervals: Interval[], minutes: number): Interval[] {
  let remaining = minutes * MS_PER_MINUTE;
  const result: Interval[] = [];
  for (let i = intervals.length - 1; i >= 0 && remaining > 0; i--) {
    const [a, b] = intervals[i];
    const dur = b - a;
    if (dur <= remaining) {
      result.unshift([a, b]);
      remaining -= dur;
    } else {
      result.unshift([b - remaining, b]);
      remaining = 0;
    }
  }
  return result;
}

function buildNightWindows(
  fromMs: number,
  toMs: number,
  nightStart: string,
  nightEnd: string,
): Interval[] {
  const startMs = parseHmToMs(nightStart);
  const endMs = parseHmToMs(nightEnd);
  const wraps = startMs >= endMs;

  const fromDay = jstDayIndex(fromMs);
  const toDay = jstDayIndex(toMs);

  const windows: Interval[] = [];
  for (let d = fromDay - 1; d <= toDay; d++) {
    const dayStart = jstMidnightUtcMs(d);
    if (wraps) {
      windows.push([dayStart + startMs, jstMidnightUtcMs(d + 1) + endMs]);
    } else {
      windows.push([dayStart + startMs, dayStart + endMs]);
    }
  }
  return windows;
}

export function calcDailyAttendance(
  timeClocks: TimeClock[],
  workDate: Date,
  rule: WorkRuleVersion,
  isLegalHoliday: boolean,
): DailyAttendance {
  const sorted = [...timeClocks].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
  );

  const clockInEvent = sorted.find((t) => t.type === 'clock_in') ?? null;
  let clockOutEvent: TimeClock | null = null;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].type === 'clock_out') {
      clockOutEvent = sorted[i];
      break;
    }
  }

  const clockInAt = clockInEvent?.occurredAt ?? null;
  const clockOutAt = clockOutEvent?.occurredAt ?? null;

  let status: DailyAttendanceStatus;
  if (clockInAt && clockOutAt) status = 'resolved';
  else if (clockInAt && !clockOutAt) status = 'missing_clock_out';
  else if (!clockInAt && clockOutAt) status = 'missing_clock_in';
  else status = 'no_record';

  if (status !== 'resolved' || !clockInAt || !clockOutAt) {
    return {
      workDate,
      status,
      clockInAt,
      clockOutAt,
      breakMinutes: null,
      workMinutes: null,
      otMinutes: null,
      nightMinutes: null,
      otNightMinutes: null,
      legalHolidayFlag: isLegalHoliday,
    };
  }

  const inMs = clockInAt.getTime();
  const outMs = clockOutAt.getTime();

  const breakIntervals: Interval[] = [];
  let pendingBreakStart: number | null = null;
  for (const e of sorted) {
    const ts = e.occurredAt.getTime();
    if (ts < inMs || ts > outMs) continue;
    if (e.type === 'break_start') {
      pendingBreakStart = ts;
    } else if (e.type === 'break_end') {
      if (pendingBreakStart !== null) {
        breakIntervals.push([pendingBreakStart, ts]);
        pendingBreakStart = null;
      }
    }
  }

  const workingIntervals = subtract([[inMs, outMs]], breakIntervals).sort(
    (a, b) => a[0] - b[0],
  );

  const breakMinutes = totalMinutes(breakIntervals);
  const workMinutes = totalMinutes(workingIntervals);
  const otMinutes = isLegalHoliday
    ? 0
    : Math.max(0, workMinutes - rule.dailyOtThresholdMin);

  const nightWindows = buildNightWindows(
    inMs,
    outMs,
    rule.nightStartTime,
    rule.nightEndTime,
  );
  const nightMinutes = totalMinutes(
    intersectMany(workingIntervals, nightWindows),
  );

  let otNightMinutes = 0;
  if (otMinutes > 0) {
    const otIntervals = takeLast(workingIntervals, otMinutes);
    otNightMinutes = totalMinutes(intersectMany(otIntervals, nightWindows));
  }

  return {
    workDate,
    status: 'resolved',
    clockInAt,
    clockOutAt,
    breakMinutes,
    workMinutes,
    otMinutes,
    nightMinutes,
    otNightMinutes,
    legalHolidayFlag: isLegalHoliday,
  };
}
