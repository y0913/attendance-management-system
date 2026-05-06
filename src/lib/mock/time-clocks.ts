// Phase 3: 内部を Prisma 経由に書き換え。すべて async。

import { formatInTimeZone } from 'date-fns-tz';
import type { TimeClock, TimeClockType } from '@prisma/client';
import { JST_TIMEZONE } from '@/lib/calc/constants';
import { prisma } from '@/lib/db';

export type TimeClockSource = 'web' | 'manual_correction';

export interface MockTimeClock {
  id: string;
  userId: string;
  type: TimeClockType;
  occurredAt: Date;
  source: TimeClockSource;
}

const toMockTimeClock = (t: TimeClock): MockTimeClock => ({
  id: t.id,
  userId: t.userId,
  type: t.type,
  occurredAt: t.occurredAt,
  source: t.source,
});

const jstDateKey = (d: Date) => formatInTimeZone(d, JST_TIMEZONE, 'yyyy-MM-dd');

const jstDayBoundsUtc = (jstDate: string): { start: Date; end: Date } => {
  const start = new Date(`${jstDate}T00:00:00+09:00`);
  const end = new Date(`${jstDate}T00:00:00+09:00`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
};

export async function listClocksFor(userId: string): Promise<MockTimeClock[]> {
  const list = await prisma.timeClock.findMany({
    where: { userId },
    orderBy: { occurredAt: 'asc' },
  });
  return list.map(toMockTimeClock);
}

export async function listClocksForDate(
  userId: string,
  date: Date = new Date(),
): Promise<MockTimeClock[]> {
  const target = jstDateKey(date);
  const { start, end } = jstDayBoundsUtc(target);
  const list = await prisma.timeClock.findMany({
    where: {
      userId,
      occurredAt: { gte: start, lt: end },
    },
    orderBy: { occurredAt: 'asc' },
  });
  return list.map(toMockTimeClock);
}

export async function appendClock(
  userId: string,
  type: TimeClockType,
  occurredAt: Date = new Date(),
  source: TimeClockSource = 'web',
): Promise<MockTimeClock> {
  const created = await prisma.timeClock.create({
    data: { userId, type, occurredAt, source },
  });
  return toMockTimeClock(created);
}

export interface ClockSnapshotInput {
  clockIn: string | null;
  clockOut: string | null;
  breakStart: string | null;
  breakEnd: string | null;
}

const toJstInstant = (jstDate: string, hhmm: string): Date =>
  new Date(`${jstDate}T${hhmm}:00+09:00`);

export async function replaceClocksForDate(
  userId: string,
  jstDate: string,
  snapshot: ClockSnapshotInput,
  source: TimeClockSource = 'manual_correction',
): Promise<MockTimeClock[]> {
  const { start, end } = jstDayBoundsUtc(jstDate);
  await prisma.timeClock.deleteMany({
    where: { userId, occurredAt: { gte: start, lt: end } },
  });

  const order: { type: TimeClockType; value: string | null }[] = [
    { type: 'clock_in', value: snapshot.clockIn },
    { type: 'break_start', value: snapshot.breakStart },
    { type: 'break_end', value: snapshot.breakEnd },
    { type: 'clock_out', value: snapshot.clockOut },
  ];

  const newClocks: Array<{
    userId: string;
    type: TimeClockType;
    occurredAt: Date;
    source: TimeClockSource;
  }> = [];
  for (const { type, value } of order) {
    if (!value) continue;
    newClocks.push({
      userId,
      type,
      occurredAt: toJstInstant(jstDate, value),
      source,
    });
  }
  if (newClocks.length === 0) return [];

  await prisma.timeClock.createMany({ data: newClocks });
  // Prisma の createMany は返り値が件数のみ。再度 findMany で返す。
  const list = await prisma.timeClock.findMany({
    where: { userId, occurredAt: { gte: start, lt: end } },
    orderBy: { occurredAt: 'asc' },
  });
  return list.map(toMockTimeClock);
}

export type ClockState =
  | 'not_clocked_in'
  | 'working'
  | 'on_break'
  | 'clocked_out';

const stateFromClocks = (clocks: MockTimeClock[]): ClockState => {
  if (clocks.length === 0) return 'not_clocked_in';
  const latest = clocks[clocks.length - 1];
  switch (latest.type) {
    case 'clock_in':
    case 'break_end':
      return 'working';
    case 'break_start':
      return 'on_break';
    case 'clock_out':
      return 'clocked_out';
  }
};

export async function getClockState(
  userId: string,
  date: Date = new Date(),
): Promise<ClockState> {
  const clocks = await listClocksForDate(userId, date);
  return stateFromClocks(clocks);
}

export async function getLatestClockIn(
  userId: string,
  date: Date = new Date(),
): Promise<MockTimeClock | null> {
  const clocks = await listClocksForDate(userId, date);
  for (let i = clocks.length - 1; i >= 0; i--) {
    if (clocks[i].type === 'clock_in') return clocks[i];
  }
  return null;
}

export interface ClockStateCount {
  notClockedIn: number;
  working: number;
  onBreak: number;
  clockedOut: number;
}

export async function countClockStates(
  userIds: string[],
  date: Date = new Date(),
): Promise<ClockStateCount> {
  const acc: ClockStateCount = {
    notClockedIn: 0,
    working: 0,
    onBreak: 0,
    clockedOut: 0,
  };
  if (userIds.length === 0) return acc;

  const target = jstDateKey(date);
  const { start, end } = jstDayBoundsUtc(target);
  const clocks = await prisma.timeClock.findMany({
    where: {
      userId: { in: userIds },
      occurredAt: { gte: start, lt: end },
    },
    orderBy: { occurredAt: 'asc' },
  });

  const byUser = new Map<string, MockTimeClock[]>();
  for (const c of clocks) {
    const m = toMockTimeClock(c);
    const arr = byUser.get(m.userId) ?? [];
    arr.push(m);
    byUser.set(m.userId, arr);
  }

  for (const userId of userIds) {
    const state = stateFromClocks(byUser.get(userId) ?? []);
    switch (state) {
      case 'not_clocked_in':
        acc.notClockedIn += 1;
        break;
      case 'working':
        acc.working += 1;
        break;
      case 'on_break':
        acc.onBreak += 1;
        break;
      case 'clocked_out':
        acc.clockedOut += 1;
        break;
    }
  }
  return acc;
}
