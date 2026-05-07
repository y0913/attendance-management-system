// time-clocks.ts のうち特に重要な replaceClocksForDate (内部 $transaction) と
// stateFromClocks の状態判定、countClockStates の集計を検証。

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    timeClock: {
      create: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
  withTx: async <T,>(_db: unknown, fn: (tx: unknown) => Promise<T>) =>
    fn(prismaMock),
}));

import {
  appendClock,
  countClockStates,
  getClockState,
  replaceClocksForDate,
} from './time-clocks';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('appendClock', () => {
  it('inserts a single time clock with default source=web', async () => {
    prismaMock.timeClock.create.mockResolvedValueOnce({
      id: 'tc_001',
      userId: 'u_general',
      type: 'clock_in',
      occurredAt: new Date('2026-04-10T00:00:00Z'),
      source: 'web',
    });
    await appendClock('u_general', 'clock_in');
    expect(prismaMock.timeClock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u_general',
        type: 'clock_in',
        source: 'web',
      }),
    });
  });
});

describe('replaceClocksForDate (atomic delete + insert)', () => {
  it('deletes existing clocks for the day and creates new ones in the same tx', async () => {
    prismaMock.timeClock.findMany.mockResolvedValueOnce([
      {
        id: 'tc_in',
        userId: 'u_general',
        type: 'clock_in',
        occurredAt: new Date('2026-04-10T00:00:00Z'),
        source: 'manual_correction',
      },
      {
        id: 'tc_out',
        userId: 'u_general',
        type: 'clock_out',
        occurredAt: new Date('2026-04-10T09:00:00Z'),
        source: 'manual_correction',
      },
    ]);
    await replaceClocksForDate('u_general', '2026-04-10', {
      clockIn: '09:00',
      clockOut: '18:00',
      breakStart: null,
      breakEnd: null,
    });

    // delete + createMany + findMany が同 tx で順序通りに呼ばれる
    expect(prismaMock.timeClock.deleteMany).toHaveBeenCalledOnce();
    expect(prismaMock.timeClock.createMany).toHaveBeenCalledOnce();
    expect(prismaMock.timeClock.findMany).toHaveBeenCalledOnce();

    // delete の where 条件: user_id + 当日 JST 範囲
    const delArg = prismaMock.timeClock.deleteMany.mock.calls[0][0];
    expect(delArg.where.userId).toBe('u_general');
    expect(delArg.where.occurredAt.gte).toBeInstanceOf(Date);
    expect(delArg.where.occurredAt.lt).toBeInstanceOf(Date);

    // createMany に渡るレコードは clock_in / clock_out のみ (null は除外)
    const createArg = prismaMock.timeClock.createMany.mock.calls[0][0];
    expect(createArg.data).toHaveLength(2);
    expect(createArg.data.map((d: { type: string }) => d.type)).toEqual([
      'clock_in',
      'clock_out',
    ]);
  });

  it('skips createMany entirely when snapshot is all null', async () => {
    const result = await replaceClocksForDate('u_general', '2026-04-10', {
      clockIn: null,
      clockOut: null,
      breakStart: null,
      breakEnd: null,
    });
    expect(result).toEqual([]);
    expect(prismaMock.timeClock.deleteMany).toHaveBeenCalledOnce(); // 既存削除は実行
    expect(prismaMock.timeClock.createMany).not.toHaveBeenCalled();
    expect(prismaMock.timeClock.findMany).not.toHaveBeenCalled();
  });

  it('produces inserts in canonical order: in → break_start → break_end → out', async () => {
    prismaMock.timeClock.findMany.mockResolvedValueOnce([]);
    await replaceClocksForDate('u_general', '2026-04-10', {
      clockIn: '09:00',
      clockOut: '18:00',
      breakStart: '12:00',
      breakEnd: '13:00',
    });
    const createArg = prismaMock.timeClock.createMany.mock.calls[0][0];
    expect(createArg.data.map((d: { type: string }) => d.type)).toEqual([
      'clock_in',
      'break_start',
      'break_end',
      'clock_out',
    ]);
  });

  it('uses manual_correction source by default', async () => {
    prismaMock.timeClock.findMany.mockResolvedValueOnce([]);
    await replaceClocksForDate('u_general', '2026-04-10', {
      clockIn: '09:00',
      clockOut: null,
      breakStart: null,
      breakEnd: null,
    });
    const createArg = prismaMock.timeClock.createMany.mock.calls[0][0];
    expect(createArg.data[0].source).toBe('manual_correction');
  });
});

describe('getClockState (state machine)', () => {
  const dummyTime = new Date('2026-04-10T01:00:00Z');

  it('not_clocked_in when no clocks for the day', async () => {
    prismaMock.timeClock.findMany.mockResolvedValueOnce([]);
    expect(await getClockState('u_general')).toBe('not_clocked_in');
  });

  it('working after clock_in', async () => {
    prismaMock.timeClock.findMany.mockResolvedValueOnce([
      { id: 't1', userId: 'u_general', type: 'clock_in', occurredAt: dummyTime, source: 'web' },
    ]);
    expect(await getClockState('u_general')).toBe('working');
  });

  it('on_break after break_start', async () => {
    prismaMock.timeClock.findMany.mockResolvedValueOnce([
      { id: 't1', userId: 'u_general', type: 'clock_in', occurredAt: dummyTime, source: 'web' },
      { id: 't2', userId: 'u_general', type: 'break_start', occurredAt: dummyTime, source: 'web' },
    ]);
    expect(await getClockState('u_general')).toBe('on_break');
  });

  it('working again after break_end', async () => {
    prismaMock.timeClock.findMany.mockResolvedValueOnce([
      { id: 't1', userId: 'u_general', type: 'clock_in', occurredAt: dummyTime, source: 'web' },
      { id: 't2', userId: 'u_general', type: 'break_start', occurredAt: dummyTime, source: 'web' },
      { id: 't3', userId: 'u_general', type: 'break_end', occurredAt: dummyTime, source: 'web' },
    ]);
    expect(await getClockState('u_general')).toBe('working');
  });

  it('clocked_out after clock_out', async () => {
    prismaMock.timeClock.findMany.mockResolvedValueOnce([
      { id: 't1', userId: 'u_general', type: 'clock_in', occurredAt: dummyTime, source: 'web' },
      { id: 't2', userId: 'u_general', type: 'clock_out', occurredAt: dummyTime, source: 'web' },
    ]);
    expect(await getClockState('u_general')).toBe('clocked_out');
  });
});

describe('countClockStates (aggregation)', () => {
  it('returns zeros when input list is empty (no DB hit)', async () => {
    const result = await countClockStates([]);
    expect(result).toEqual({
      notClockedIn: 0,
      working: 0,
      onBreak: 0,
      clockedOut: 0,
    });
    expect(prismaMock.timeClock.findMany).not.toHaveBeenCalled();
  });

  it('counts states per user correctly', async () => {
    const at = new Date('2026-04-10T01:00:00Z');
    prismaMock.timeClock.findMany.mockResolvedValueOnce([
      { id: 't1', userId: 'u_a', type: 'clock_in', occurredAt: at, source: 'web' },
      { id: 't2', userId: 'u_b', type: 'clock_in', occurredAt: at, source: 'web' },
      { id: 't3', userId: 'u_b', type: 'break_start', occurredAt: at, source: 'web' },
      { id: 't4', userId: 'u_c', type: 'clock_in', occurredAt: at, source: 'web' },
      { id: 't5', userId: 'u_c', type: 'clock_out', occurredAt: at, source: 'web' },
      // u_d は出勤なし
    ]);
    const result = await countClockStates(['u_a', 'u_b', 'u_c', 'u_d']);
    expect(result).toEqual({
      notClockedIn: 1, // u_d
      working: 1, // u_a
      onBreak: 1, // u_b
      clockedOut: 1, // u_c
    });
  });
});
