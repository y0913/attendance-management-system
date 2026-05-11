// Phase 5: 内部を Prisma 経由に書き換え。すべて async。
//
// snapshot は Prisma の Json として保存。読み込み時は ClosingSnapshot に cast。

import { Prisma, type AttendanceClosing } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import { JST_TIMEZONE } from '@/lib/calc/constants';
import { prisma, withTx, type DbClient } from '@/lib/db';
import {
  summarizeMonth,
  summarizeMonthForUsers,
  totalWorkMinutes,
  type DailySummary,
} from './attendance-summary';
import {
  listLeaveRequests,
  listLeaveRequestsForUsers,
  type MockLeaveRequest,
} from './leave-requests';

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

// pure: 集計済みの daily summaries と leaves から snapshot を作る。DB 非依存。
// 単発呼び出し / batch 双方の合成基盤。
function buildSnapshotFromParts(
  yearMonth: string,
  summaries: DailySummary[],
  leaves: MockLeaveRequest[],
): ClosingSnapshot {
  const daily = summaries.map(dailyToEntry);
  const workedDays = summaries.filter((s) => s.workMinutes != null).length;
  const totalWork = totalWorkMinutes(summaries);
  const totalBreak = summaries.reduce((sum, s) => sum + s.breakMinutes, 0);
  const missingClockOutDays = summaries.filter(
    (s) => s.clockIn && !s.clockOut,
  ).length;
  const approvedLeaveDays = leaves
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

export async function buildClosingSnapshot(
  userId: string,
  yearMonth: string,
): Promise<ClosingSnapshot> {
  const [summaries, leaves] = await Promise.all([
    summarizeMonth(userId, yearMonth),
    listLeaveRequests(userId),
  ]);
  return buildSnapshotFromParts(yearMonth, summaries, leaves);
}

// 複数 user の月次 ClosingSnapshot を batch で構築する (3 query: clocks / leaves / pure)。
export async function buildClosingSnapshotsForUsers(
  userIds: string[],
  yearMonth: string,
): Promise<Map<string, ClosingSnapshot>> {
  const result = new Map<string, ClosingSnapshot>();
  if (userIds.length === 0) return result;
  const [byUserSummaries, byUserLeaves] = await Promise.all([
    summarizeMonthForUsers(userIds, yearMonth),
    listLeaveRequestsForUsers(userIds),
  ]);
  for (const userId of userIds) {
    const summaries = byUserSummaries.get(userId) ?? [];
    const leaves = byUserLeaves.get(userId) ?? [];
    result.set(userId, buildSnapshotFromParts(yearMonth, summaries, leaves));
  }
  return result;
}

export async function findClosing(
  userId: string,
  yearMonth: string,
  db: DbClient = prisma,
): Promise<MockAttendanceClosing | null> {
  const c = await db.attendanceClosing.findUnique({
    where: { userId_yearMonth: { userId, yearMonth } },
  });
  return c ? toMockClosing(c) : null;
}

export async function listClosingsForMonth(
  companyId: string,
  yearMonth: string,
): Promise<MockAttendanceClosing[]> {
  const list = await prisma.attendanceClosing.findMany({
    where: { companyId, yearMonth },
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
  db: DbClient = prisma,
): Promise<MockAttendanceClosing | null> {
  try {
    const removed = await db.attendanceClosing.delete({ where: { id } });
    return toMockClosing(removed);
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2025'
    ) {
      return null;
    }
    throw e;
  }
}

export async function closeMonth(
  companyId: string,
  userId: string,
  yearMonth: string,
  closedById: string,
  db: DbClient = prisma,
): Promise<MockAttendanceClosing | null> {
  // snapshot 構築は読み取りのみ (副作用なし)。tx 内で再度ユニーク違反を検出する。
  const snapshot = await buildClosingSnapshot(userId, yearMonth);
  return withTx(db, async (tx) => {
    try {
      const created = await tx.attendanceClosing.create({
        data: {
          companyId,
          userId,
          yearMonth,
          closedById,
          snapshot: snapshot as unknown as object,
        },
      });
      return toMockClosing(created);
    } catch (e) {
      // 同時実行で別 tx が先に締めた場合 (P2002 = unique violation)
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        return null;
      }
      throw e;
    }
  });
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

// 複数 user の EffectiveMonthlySummary を batch で取得する。
// 締め済み user は snapshot 利用、未締め user は clocks/leaves から構築。
// 合計クエリ数: listClosingsForMonth (1) + summarizeMonthForUsers (1) + listLeaveRequestsForUsers (1)
// = 最大 3 query (未締め user が居なければ未締め分は 0 query)。
export async function getEffectiveMonthlySummariesForUsers(
  companyId: string,
  userIds: string[],
  yearMonth: string,
): Promise<Map<string, EffectiveMonthlySummary>> {
  const result = new Map<string, EffectiveMonthlySummary>();
  if (userIds.length === 0) return result;

  const closings = await listClosingsForMonth(companyId, yearMonth);
  const closedById = new Map(closings.map((c) => [c.userId, c]));
  const unclosedIds = userIds.filter((id) => !closedById.has(id));
  const unclosedSnapshots =
    unclosedIds.length > 0
      ? await buildClosingSnapshotsForUsers(unclosedIds, yearMonth)
      : new Map<string, ClosingSnapshot>();

  for (const userId of userIds) {
    const closing = closedById.get(userId);
    if (closing) {
      result.set(userId, {
        isClosed: true,
        closedAt: closing.closedAt,
        closedById: closing.closedById,
        ...closing.snapshot,
      });
    } else {
      const snap =
        unclosedSnapshots.get(userId) ??
        // userId が users テーブルに居ない場合は空 snapshot で埋める。
        ({
          yearMonth,
          workedDays: 0,
          totalWorkMinutes: 0,
          totalBreakMinutes: 0,
          missingClockOutDays: 0,
          approvedLeaveDays: 0,
          daily: [],
        } satisfies ClosingSnapshot);
      result.set(userId, {
        isClosed: false,
        closedAt: null,
        closedById: null,
        ...snap,
      });
    }
  }
  return result;
}
