import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { JST_TIMEZONE } from '@/lib/calc/constants';
import type {
  LeaveDayUnit,
  LeaveRequestStatus,
  LeaveType,
} from './leave-requests';

export interface SeedLeave {
  requesterId: string;
  approverId: string | null;
  status: LeaveRequestStatus;
  submittedAt: Date;
  decidedAt: Date | null;
  reason: string;
  leaveType: LeaveType;
  dayUnit: LeaveDayUnit;
  startDate: string;
  endDate: string;
  days: number;
}

const addDays = (d: Date, n: number): Date => {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
};

const jstDateOf = (d: Date): string =>
  formatInTimeZone(d, JST_TIMEZONE, 'yyyy-MM-dd');

const advanceToWeekday = (d: Date, direction: 1 | -1 = 1): Date => {
  const out = new Date(d);
  while (true) {
    const dow = toZonedTime(out, JST_TIMEZONE).getDay();
    if (dow !== 0 && dow !== 6) return out;
    out.setUTCDate(out.getUTCDate() + direction);
  }
};

export function buildSeedLeaves(now: Date = new Date()): SeedLeave[] {
  const requesterId = 'u_general';
  const approverId = 'u_approver';

  const submittedStart = advanceToWeekday(addDays(now, 7));
  const submittedEnd = advanceToWeekday(addDays(submittedStart, 1));

  const approvedStart = advanceToWeekday(addDays(now, -25), -1);
  const approvedEnd = advanceToWeekday(addDays(approvedStart, 2));

  const rejectedDay = advanceToWeekday(addDays(now, -18), -1);

  const halfDay = advanceToWeekday(addDays(now, -10), -1);

  return [
    {
      requesterId,
      approverId,
      status: 'submitted',
      submittedAt: addDays(now, -1),
      decidedAt: null,
      reason: '私用のため',
      leaveType: 'paid',
      dayUnit: 'full',
      startDate: jstDateOf(submittedStart),
      endDate: jstDateOf(submittedEnd),
      days: 2,
    },
    {
      requesterId,
      approverId,
      status: 'approved',
      submittedAt: addDays(now, -28),
      decidedAt: addDays(now, -27),
      reason: '帰省のため',
      leaveType: 'paid',
      dayUnit: 'full',
      startDate: jstDateOf(approvedStart),
      endDate: jstDateOf(approvedEnd),
      days: 3,
    },
    {
      requesterId,
      approverId,
      status: 'rejected',
      submittedAt: addDays(now, -19),
      decidedAt: addDays(now, -18),
      reason: 'リフレッシュのため',
      leaveType: 'paid',
      dayUnit: 'full',
      startDate: jstDateOf(rejectedDay),
      endDate: jstDateOf(rejectedDay),
      days: 1,
    },
    {
      requesterId,
      approverId,
      status: 'approved',
      submittedAt: addDays(now, -11),
      decidedAt: addDays(now, -10),
      reason: '通院のため（午後半休）',
      leaveType: 'paid',
      dayUnit: 'half',
      startDate: jstDateOf(halfDay),
      endDate: jstDateOf(halfDay),
      days: 0.5,
    },
  ];
}
