import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { JST_TIMEZONE } from '@/lib/calc/constants';
import type {
  ClockCorrectionStatus,
  ClockSnapshot,
} from './clock-corrections';

export interface SeedCorrection {
  requesterId: string;
  approverId: string | null;
  status: ClockCorrectionStatus;
  submittedAt: Date;
  decidedAt: Date | null;
  reason: string;
  targetDate: string;
  before: ClockSnapshot;
  after: ClockSnapshot;
}

const subDays = (d: Date, n: number): Date => {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() - n);
  return out;
};

const jstDateOf = (d: Date): string =>
  formatInTimeZone(d, JST_TIMEZONE, 'yyyy-MM-dd');

const advanceToWeekday = (d: Date): Date => {
  const out = new Date(d);
  while (true) {
    const dow = toZonedTime(out, JST_TIMEZONE).getDay();
    if (dow !== 0 && dow !== 6) return out;
    out.setUTCDate(out.getUTCDate() - 1);
  }
};

export function buildSeedCorrections(now: Date = new Date()): SeedCorrection[] {
  const requesterId = 'u_general';
  const approverId = 'u_approver';

  const targetA = jstDateOf(advanceToWeekday(subDays(now, 3)));
  const targetB = jstDateOf(advanceToWeekday(subDays(now, 10)));
  const targetC = jstDateOf(advanceToWeekday(subDays(now, 17)));

  return [
    {
      requesterId,
      approverId,
      status: 'submitted',
      submittedAt: subDays(now, 2),
      decidedAt: null,
      reason: '退勤打刻を忘れたため、実際の退勤時刻に修正をお願いします。',
      targetDate: targetA,
      before: {
        clockIn: '09:00',
        clockOut: null,
        breakStart: '12:00',
        breakEnd: '13:00',
      },
      after: {
        clockIn: '09:00',
        clockOut: '20:00',
        breakStart: '12:00',
        breakEnd: '13:00',
      },
    },
    {
      requesterId,
      approverId,
      status: 'approved',
      submittedAt: subDays(now, 9),
      decidedAt: subDays(now, 8),
      reason: '客先直行で出勤打刻ができませんでした。',
      targetDate: targetB,
      before: {
        clockIn: null,
        clockOut: '18:00',
        breakStart: '12:00',
        breakEnd: '13:00',
      },
      after: {
        clockIn: '08:30',
        clockOut: '18:00',
        breakStart: '12:00',
        breakEnd: '13:00',
      },
    },
    {
      requesterId,
      approverId,
      status: 'rejected',
      submittedAt: subDays(now, 16),
      decidedAt: subDays(now, 15),
      reason: '休憩時間の入力ミス。',
      targetDate: targetC,
      before: {
        clockIn: '09:00',
        clockOut: '18:00',
        breakStart: '12:00',
        breakEnd: '13:00',
      },
      after: {
        clockIn: '09:00',
        clockOut: '18:00',
        breakStart: '11:30',
        breakEnd: '12:30',
      },
    },
  ];
}
