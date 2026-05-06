// Phase 5: 内部を Prisma 経由に書き換え。すべて async。
//
// snapshot は Prisma の Json として保存。読み込み時は ClosingSnapshot に cast。

import type { AttendanceClosing } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import { JST_TIMEZONE } from '@/lib/calc/constants';
import { prisma } from '@/lib/db';
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

const DEFAULT_COMPANY_ID = 'co_default';

const toMockClosing = (c: AttendanceClosing): MockAttendanceClosing => ({
  id: c.id,
  userId: c.userId,
  yearMonth: c.yearMonth,
  closedAt: c.closedAt,
  closedById: c.closedById,
  snapshot: c.snapshot as unknown as ClosingSnapshot,
});

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
  const ymStart = `${yearMonth}-01`;
  const lastDay = new Date(`${yearMonth}-01T00:00:00+09:00`);
  lastDay.setUTCMonth(lastDay.getUTCMonth() + 1);
  lastDay.setUTCDate(0);
  const ymEnd = formatInTimeZone(lastDay, JST_TIMEZONE, 'yyyy-MM-dd');
  return !(endDate < ymStart || startDate > ymEnd);
};

export async function buildClosingSnapshot(
  userId: string,
  yearMonth: string,
): Promise<ClosingSnapshot> {
  const summaries = await summarizeMonth(userId, yearMonth);
  const daily = summaries.map(dailyToEntry);
  const workedDays = summaries.filter((s) => s.workMinutes != null).length;
  const totalWork = totalWorkMinutes(summaries);
  const totalBreak = summaries.reduce((sum, s) => sum + s.breakMinutes, 0);
  const missingClockOutDays = summaries.filter(
    (s) => s.clockIn && !s.clockOut,
  ).length;

  const approvedLeaveDays = (await listLeaveRequests(userId))
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

export async function findClosing(
  userId: string,
  yearMonth: string,
): Promise<MockAttendanceClosing | null> {
  const c = await prisma.attendanceClosing.findUnique({
    where: { userId_yearMonth: { userId, yearMonth } },
  });
  return c ? toMockClosing(c) : null;
}

export async function listClosingsForMonth(
  yearMonth: string,
): Promise<MockAttendanceClosing[]> {
  const list = await prisma.attendanceClosing.findMany({
    where: { yearMonth },
  });
  return list.map(toMockClosing);
}

export async function findClosingById(
  id: string,
): Promise<MockAttendanceClosing | null> {
  const c = await prisma.attendanceClosing.findUnique({ where: { id } });
  return c ? toMockClosing(c) : null;
}

export async function deleteClosing(
  id: string,
): Promise<MockAttendanceClosing | null> {
  try {
    const removed = await prisma.attendanceClosing.delete({ where: { id } });
    return toMockClosing(removed);
  } catch {
    return null;
  }
}

export async function closeMonth(
  userId: string,
  yearMonth: string,
  closedById: string,
): Promise<MockAttendanceClosing | null> {
  const existing = await findClosing(userId, yearMonth);
  if (existing) return null;
  const snapshot = await buildClosingSnapshot(userId, yearMonth);
  const created = await prisma.attendanceClosing.create({
    data: {
      companyId: DEFAULT_COMPANY_ID,
      userId,
      yearMonth,
      closedById,
      snapshot: snapshot as unknown as object,
    },
  });
  return toMockClosing(created);
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

export async function getEffectiveMonthlySummary(
  userId: string,
  yearMonth: string,
): Promise<EffectiveMonthlySummary> {
  const closing = await findClosing(userId, yearMonth);
  if (closing) {
    return {
      isClosed: true,
      closedAt: closing.closedAt,
      closedById: closing.closedById,
      ...closing.snapshot,
    };
  }
  const snapshot = await buildClosingSnapshot(userId, yearMonth);
  return {
    isClosed: false,
    closedAt: null,
    closedById: null,
    ...snapshot,
  };
}
