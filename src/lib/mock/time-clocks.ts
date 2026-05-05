import { formatInTimeZone } from 'date-fns-tz';
import type { TimeClockType } from '@prisma/client';
import { JST_TIMEZONE } from '@/lib/calc/constants';
import { buildSeedRecords } from './seed-time-clocks';

export interface MockTimeClock {
  id: string;
  userId: string;
  type: TimeClockType;
  occurredAt: Date;
}

const store = new Map<string, MockTimeClock[]>();

let seeded = false;
function ensureSeeded(): void {
  if (seeded) return;
  seeded = true;
  let counter = 0;
  for (const r of buildSeedRecords()) {
    const clock: MockTimeClock = {
      id: `seed_${counter++}`,
      userId: r.userId,
      type: r.type,
      occurredAt: r.occurredAt,
    };
    const list = store.get(r.userId) ?? [];
    list.push(clock);
    store.set(r.userId, list);
  }
}

export function listClocksFor(userId: string): MockTimeClock[] {
  ensureSeeded();
  return [...(store.get(userId) ?? [])].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
  );
}

const jstDateKey = (d: Date) => formatInTimeZone(d, JST_TIMEZONE, 'yyyy-MM-dd');

export function listClocksForDate(
  userId: string,
  date: Date = new Date(),
): MockTimeClock[] {
  const target = jstDateKey(date);
  return listClocksFor(userId).filter(
    (c) => jstDateKey(c.occurredAt) === target,
  );
}

export function appendClock(
  userId: string,
  type: TimeClockType,
  occurredAt: Date = new Date(),
): MockTimeClock {
  ensureSeeded();
  const clock: MockTimeClock = {
    id: `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    type,
    occurredAt,
  };
  const existing = store.get(userId) ?? [];
  existing.push(clock);
  store.set(userId, existing);
  return clock;
}

export type ClockState =
  | 'not_clocked_in'
  | 'working'
  | 'on_break'
  | 'clocked_out';

export function getClockState(
  userId: string,
  date: Date = new Date(),
): ClockState {
  const clocks = listClocksForDate(userId, date);
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
}

export function getLatestClockIn(
  userId: string,
  date: Date = new Date(),
): MockTimeClock | null {
  const clocks = listClocksForDate(userId, date);
  for (let i = clocks.length - 1; i >= 0; i--) {
    if (clocks[i].type === 'clock_in') return clocks[i];
  }
  return null;
}
