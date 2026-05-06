import { formatInTimeZone } from 'date-fns-tz';
import { JST_TIMEZONE } from '@/lib/calc/constants';
import {
  summarizeMonth,
  totalWorkMinutes,
  type DailySummary,
} from './attendance-summary';
import { listLeaveRequests } from './leave-requests';

const fmtTime = (d: Date) => formatInTimeZone(d, JST_TIMEZONE, 'HH:mm');

export interface DailyClosingEntry {
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  breakMinutes: number;
  workMinutes: number | null;
}

export interface ClosingSnapshot {
  yearMonth: string;
  workedDays: number;
  totalWorkMinutes: number;
  totalBreakMinutes: number;
  missingClockOutDays: number;
  approvedLeaveDays: number;
  daily: DailyClosingEntry[];
}

export interface MockAttendanceClosing {
  id: string;
  userId: string;
  yearMonth: string;
  closedAt: Date;
  closedById: string;
  snapshot: ClosingSnapshot;
}

const store: MockAttendanceClosing[] = [];

const dailyToEntry = (s: DailySummary): DailyClosingEntry => ({
  date: s.jstDateKey,
  clockIn: s.clockIn ? fmtTime(s.clockIn.occurredAt) : null,
  clockOut: s.clockOut ? fmtTime(s.clockOut.occurredAt) : null,
  breakMinutes: s.breakMinutes,
  workMinutes: s.workMinutes,
});

const overlapsMonth = (
  startDate: string,
  endDate: string,
  yearMonth: string,
): boolean => {
  // 期間 [startDate, endDate] と yearMonth (yyyy-MM) が重なるか
  const ymStart = `${yearMonth}-01`;
  const lastDay = new Date(`${yearMonth}-01T00:00:00+09:00`);
  lastDay.setUTCMonth(lastDay.getUTCMonth() + 1);
  lastDay.setUTCDate(0);
  const ymEnd = formatInTimeZone(lastDay, JST_TIMEZONE, 'yyyy-MM-dd');
  return !(endDate < ymStart || startDate > ymEnd);
};

export function buildClosingSnapshot(
  userId: string,
  yearMonth: string,
): ClosingSnapshot {
  const summaries = summarizeMonth(userId, yearMonth);
  const daily = summaries.map(dailyToEntry);
  const workedDays = summaries.filter((s) => s.workMinutes != null).length;
  const totalWork = totalWorkMinutes(summaries);
  const totalBreak = summaries.reduce((sum, s) => sum + s.breakMinutes, 0);
  const missingClockOutDays = summaries.filter(
    (s) => s.clockIn && !s.clockOut,
  ).length;

  const approvedLeaveDays = listLeaveRequests(userId)
    .filter(
      (r) =>
        r.status === 'approved' &&
        overlapsMonth(r.startDate, r.endDate, yearMonth),
    )
    .reduce((sum, r) => sum + r.days, 0);

  return {
    yearMonth,
    workedDays,
    totalWorkMinutes: totalWork,
    totalBreakMinutes: totalBreak,
    missingClockOutDays,
    approvedLeaveDays,
    daily,
  };
}

export function findClosing(
  userId: string,
  yearMonth: string,
): MockAttendanceClosing | null {
  return (
    store.find((c) => c.userId === userId && c.yearMonth === yearMonth) ?? null
  );
}

export function listClosingsForMonth(
  yearMonth: string,
): MockAttendanceClosing[] {
  return store.filter((c) => c.yearMonth === yearMonth).slice();
}

export function findClosingById(
  id: string,
): MockAttendanceClosing | null {
  return store.find((c) => c.id === id) ?? null;
}

export function deleteClosing(id: string): MockAttendanceClosing | null {
  const idx = store.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  const [removed] = store.splice(idx, 1);
  return removed;
}

export function closeMonth(
  userId: string,
  yearMonth: string,
  closedById: string,
): MockAttendanceClosing | null {
  if (findClosing(userId, yearMonth)) return null;
  const snapshot = buildClosingSnapshot(userId, yearMonth);
  const closing: MockAttendanceClosing = {
    id: `acl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    userId,
    yearMonth,
    closedAt: new Date(),
    closedById,
    snapshot,
  };
  store.push(closing);
  return closing;
}

export interface EffectiveMonthlySummary {
  isClosed: boolean;
  closedAt: Date | null;
  closedById: string | null;
  yearMonth: string;
  workedDays: number;
  totalWorkMinutes: number;
  totalBreakMinutes: number;
  missingClockOutDays: number;
  approvedLeaveDays: number;
  daily: DailyClosingEntry[];
}

export function getEffectiveMonthlySummary(
  userId: string,
  yearMonth: string,
): EffectiveMonthlySummary {
  const closing = findClosing(userId, yearMonth);
  if (closing) {
    return {
      isClosed: true,
      closedAt: closing.closedAt,
      closedById: closing.closedById,
      ...closing.snapshot,
    };
  }
  const snapshot = buildClosingSnapshot(userId, yearMonth);
  return {
    isClosed: false,
    closedAt: null,
    closedById: null,
    ...snapshot,
  };
}
