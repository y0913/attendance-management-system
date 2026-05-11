// computeMonthlyPayrollForUsers (super-batch) の振る舞いを実 DB で検証。
// - 単発 (computeMonthlyPayroll × N) と batch の結果が一致 (summary / premium / dailyAttendances)
// - 空 userIds は空 Map
// - 不在 userId は emptyResult (rule:null / summary:null / premium:null) で埋まる
// - work-rule version が無い場合は全 user emptyResult

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import {
  computeMonthlyPayroll,
  computeMonthlyPayrollForUsers,
} from '@/lib/data/payroll-bridge';
import { appendClock } from '@/lib/data/time-clocks';
import { prisma } from '@/lib/db';
import { seedCompany, seedUser } from './helpers';

const ymKey = '2026-04';

async function seedRule(createdById: string) {
  await prisma.workRuleVersion.create({
    data: {
      companyId: 'co_default',
      validFrom: new Date('2020-01-01T00:00:00+09:00'),
      createdById,
    },
  });
}

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

describe('computeMonthlyPayrollForUsers (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('batch と単発の summary / premium が user ごとに一致する', async () => {
    await seedCompany();
    const admin = await seedUser({
      id: 'u_admin',
      role: 'admin',
      email: 'admin@example.com',
    });
    await seedRule(admin.id);

    const u1 = await seedUser({ id: 'u_1', email: '1@example.com' });
    const u2 = await seedUser({
      id: 'u_2',
      email: '2@example.com',
      employmentType: 'hourly',
      baseSalary: 1500,
    });

    await seedTypicalDay(u1.id, '2026-04-01');
    await seedTypicalDay(u1.id, '2026-04-02');
    await seedTypicalDay(u2.id, '2026-04-01');

    const single1 = await computeMonthlyPayroll(u1.id, ymKey);
    const single2 = await computeMonthlyPayroll(u2.id, ymKey);

    const batch = await computeMonthlyPayrollForUsers('co_default', [u1.id, u2.id], ymKey);

    const b1 = batch.get(u1.id)!;
    const b2 = batch.get(u2.id)!;

    expect(b1.baseHourlyRate).toBe(single1.baseHourlyRate);
    expect(b2.baseHourlyRate).toBe(single2.baseHourlyRate);
    expect(b1.summary).toEqual(single1.summary);
    expect(b2.summary).toEqual(single2.summary);
    expect(b1.premium).toEqual(single1.premium);
    expect(b2.premium).toEqual(single2.premium);
    expect(b1.dailyAttendances.length).toBe(single1.dailyAttendances.length);

    // sanity: u1 = 2 日 × (9h - 1h 休憩) = 16h 所定内勤務 (日次 8h 閾値ちょうど)
    expect(b1.summary?.regularWorkMinutes).toBe(16 * 60);
    expect(b1.summary?.regularOtMinutes).toBe(0);
  });

  it('空 userIds は空 Map を返す', async () => {
    const m = await computeMonthlyPayrollForUsers('co_default', [], ymKey);
    // empty 入力は companyId 関係なく短絡で空 Map を返す
    expect(m.size).toBe(0);
  });

  it('不在 userId は emptyResult (rule/summary/premium null) で埋まる', async () => {
    await seedCompany();
    const admin = await seedUser({
      id: 'u_admin',
      role: 'admin',
      email: 'admin@example.com',
    });
    await seedRule(admin.id);

    const batch = await computeMonthlyPayrollForUsers(
      'co_default',
      ['u_does_not_exist'],
      ymKey,
    );
    const r = batch.get('u_does_not_exist')!;
    expect(r.rule).toBeNull();
    expect(r.summary).toBeNull();
    expect(r.premium).toBeNull();
    expect(r.baseHourlyRate).toBe(0);
    expect(r.dailyAttendances).toEqual([]);
  });

  it('work-rule version が 1 件も無い月は全 user emptyResult', async () => {
    await seedCompany();
    const u1 = await seedUser({ id: 'u_1', email: '1@example.com' });
    await seedTypicalDay(u1.id, '2026-04-01');

    // seedRule は呼ばない
    const batch = await computeMonthlyPayrollForUsers('co_default', [u1.id], ymKey);
    const r = batch.get(u1.id)!;
    expect(r.rule).toBeNull();
    expect(r.summary).toBeNull();
    expect(r.premium).toBeNull();
  });
});
