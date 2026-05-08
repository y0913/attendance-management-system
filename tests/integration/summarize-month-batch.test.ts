// summarizeMonthForUsers / getEffectiveMonthlySummariesForUsers の振る舞いを実 DB で検証。
// - 単発 (summarizeMonth × N) と batch (summarizeMonthForUsers) の結果が一致
// - 締め済み / 未締め user 混在で getEffectiveMonthlySummariesForUsers が正しく分岐
// - 空配列 / 存在しない userId は空 / null-like で埋まる

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import {
  getEffectiveMonthlySummariesForUsers,
  getEffectiveMonthlySummary,
} from '@/lib/data/attendance-closings';
import {
  summarizeMonth,
  summarizeMonthForUsers,
} from '@/lib/data/attendance-summary';
import { appendClock } from '@/lib/data/time-clocks';
import { prisma } from '@/lib/db';
import { seedCompany, seedUser } from './helpers';

const ymKey = '2026-04';

async function seedClock(
  userId: string,
  jstDate: string,
  hhmm: string,
  type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end',
) {
  const occurred = new Date(`${jstDate}T${hhmm}:00+09:00`);
  await appendClock(userId, type, occurred, 'web');
}

async function seedTypicalDay(userId: string, jstDate: string) {
  await seedClock(userId, jstDate, '09:00', 'clock_in');
  await seedClock(userId, jstDate, '12:00', 'break_start');
  await seedClock(userId, jstDate, '13:00', 'break_end');
  await seedClock(userId, jstDate, '18:00', 'clock_out');
}

describe('summarizeMonthForUsers (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('batch returns identical per-day summaries to per-user summarizeMonth calls', async () => {
    await seedCompany();
    const u1 = await seedUser({ id: 'u_1', email: '1@example.com' });
    const u2 = await seedUser({ id: 'u_2', email: '2@example.com' });

    await seedTypicalDay(u1.id, '2026-04-01');
    await seedTypicalDay(u1.id, '2026-04-02');
    await seedTypicalDay(u2.id, '2026-04-01');

    const single1 = await summarizeMonth(u1.id, ymKey);
    const single2 = await summarizeMonth(u2.id, ymKey);

    const batch = await summarizeMonthForUsers([u1.id, u2.id], ymKey);

    // 単発と batch の長さ・work 合計が一致 (内部の Date オブジェクト identity は異なる)
    const u1Batch = batch.get(u1.id)!;
    const u2Batch = batch.get(u2.id)!;
    expect(u1Batch).toHaveLength(single1.length);
    expect(u2Batch).toHaveLength(single2.length);

    const sumWork = (xs: { workMinutes: number | null }[]) =>
      xs.reduce((sum, x) => sum + (x.workMinutes ?? 0), 0);
    expect(sumWork(u1Batch)).toBe(sumWork(single1));
    expect(sumWork(u2Batch)).toBe(sumWork(single2));
    // u1 = 2 日 × (9h - 1h 休憩) = 16h = 960 min
    expect(sumWork(u1Batch)).toBe(960);
    expect(sumWork(u2Batch)).toBe(480);
  });

  it('returns empty Map for empty userIds', async () => {
    const m = await summarizeMonthForUsers([], ymKey);
    expect(m.size).toBe(0);
  });
});

describe('getEffectiveMonthlySummariesForUsers (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mixed closed and unclosed users return correct isClosed flag and totals', async () => {
    await seedCompany();
    const admin = await seedUser({
      id: 'u_admin',
      role: 'admin',
      email: 'admin@example.com',
    });
    const u1 = await seedUser({ id: 'u_1', email: '1@example.com' });
    const u2 = await seedUser({ id: 'u_2', email: '2@example.com' });

    await seedTypicalDay(u1.id, '2026-04-01');
    await seedTypicalDay(u2.id, '2026-04-01');
    await seedTypicalDay(u2.id, '2026-04-02');

    // u1 だけ先に締めておく
    await prisma.attendanceClosing.create({
      data: {
        companyId: 'co_default',
        userId: u1.id,
        yearMonth: ymKey,
        closedById: admin.id,
        snapshot: {
          yearMonth: ymKey,
          workedDays: 1,
          totalWorkMinutes: 480,
          totalBreakMinutes: 60,
          missingClockOutDays: 0,
          approvedLeaveDays: 0,
          daily: [],
        },
      },
    });

    const batch = await getEffectiveMonthlySummariesForUsers(
      [u1.id, u2.id],
      ymKey,
    );

    const s1 = batch.get(u1.id)!;
    const s2 = batch.get(u2.id)!;

    expect(s1.isClosed).toBe(true);
    expect(s1.totalWorkMinutes).toBe(480); // snapshot から
    expect(s2.isClosed).toBe(false);
    expect(s2.totalWorkMinutes).toBe(960); // 2 日 = 960 分

    // 単発 API との一貫性
    const s1Single = await getEffectiveMonthlySummary(u1.id, ymKey);
    const s2Single = await getEffectiveMonthlySummary(u2.id, ymKey);
    expect(s1.totalWorkMinutes).toBe(s1Single.totalWorkMinutes);
    expect(s2.totalWorkMinutes).toBe(s2Single.totalWorkMinutes);
  });

  it('non-existent userId yields zeroed unclosed summary', async () => {
    await seedCompany();
    const batch = await getEffectiveMonthlySummariesForUsers(
      ['u_does_not_exist'],
      ymKey,
    );
    const s = batch.get('u_does_not_exist')!;
    expect(s.isClosed).toBe(false);
    expect(s.totalWorkMinutes).toBe(0);
    expect(s.workedDays).toBe(0);
  });
});
