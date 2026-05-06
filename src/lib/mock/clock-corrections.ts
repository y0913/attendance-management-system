import { formatInTimeZone } from 'date-fns-tz';
import { JST_TIMEZONE } from '@/lib/calc/constants';
import { findMockUserById } from './users';
import { listClocksForDate, replaceClocksForDate } from './time-clocks';
import { buildSeedCorrections } from './seed-clock-corrections';

export type ClockCorrectionStatus =
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'withdrawn'
  | 'returned';

export interface ClockSnapshot {
  clockIn: string | null;
  clockOut: string | null;
  breakStart: string | null;
  breakEnd: string | null;
}

export interface MockClockCorrectionRequest {
  id: string;
  requesterId: string;
  status: ClockCorrectionStatus;
  currentApproverId: string | null;
  submittedAt: Date;
  decidedAt: Date | null;
  reason: string;
  targetDate: string;
  beforePayload: ClockSnapshot;
  afterPayload: ClockSnapshot;
}

export const REASON_MAX_LENGTH = 500;

const store: MockClockCorrectionRequest[] = [];

let seeded = false;
function ensureSeeded(): void {
  if (seeded) return;
  seeded = true;
  for (const r of buildSeedCorrections()) {
    store.push({
      id: `ccr_seed_${store.length}`,
      requesterId: r.requesterId,
      status: r.status,
      currentApproverId: r.approverId,
      submittedAt: r.submittedAt,
      decidedAt: r.decidedAt,
      reason: r.reason,
      targetDate: r.targetDate,
      beforePayload: r.before,
      afterPayload: r.after,
    });
  }
}

export function listCorrectionRequests(
  userId: string,
): MockClockCorrectionRequest[] {
  ensureSeeded();
  return store
    .filter((r) => r.requesterId === userId)
    .slice()
    .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
}

export function findActiveCorrection(
  userId: string,
  targetDate: string,
): MockClockCorrectionRequest | null {
  ensureSeeded();
  return (
    store.find(
      (r) =>
        r.requesterId === userId &&
        r.targetDate === targetDate &&
        r.status === 'submitted',
    ) ?? null
  );
}

export function findCorrectionById(
  id: string,
): MockClockCorrectionRequest | null {
  ensureSeeded();
  return store.find((r) => r.id === id) ?? null;
}

export function listCorrectionRequestsForUserDate(
  userId: string,
  targetDate: string,
): MockClockCorrectionRequest[] {
  ensureSeeded();
  return store
    .filter((r) => r.requesterId === userId && r.targetDate === targetDate)
    .slice()
    .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
}

export function listPendingCorrectionsForApprover(
  approverId: string,
): MockClockCorrectionRequest[] {
  ensureSeeded();
  return store
    .filter(
      (r) =>
        r.currentApproverId === approverId && r.status === 'submitted',
    )
    .slice()
    .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
}

export function listAllPendingCorrections(): MockClockCorrectionRequest[] {
  ensureSeeded();
  return store
    .filter((r) => r.status === 'submitted')
    .slice()
    .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
}

export function listAllCorrections(): MockClockCorrectionRequest[] {
  ensureSeeded();
  return store
    .slice()
    .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
}

const fmt = (d: Date): string =>
  formatInTimeZone(d, JST_TIMEZONE, 'HH:mm');

export function captureCurrentSnapshot(
  userId: string,
  targetDate: string,
): ClockSnapshot {
  const dayDate = new Date(`${targetDate}T00:00:00+09:00`);
  const clocks = listClocksForDate(userId, dayDate);
  const find = (t: string) =>
    clocks.find((c) => c.type === t)?.occurredAt ?? null;
  return {
    clockIn: find('clock_in') ? fmt(find('clock_in') as Date) : null,
    clockOut: find('clock_out') ? fmt(find('clock_out') as Date) : null,
    breakStart: find('break_start') ? fmt(find('break_start') as Date) : null,
    breakEnd: find('break_end') ? fmt(find('break_end') as Date) : null,
  };
}

export interface SubmitCorrectionInput {
  requesterId: string;
  targetDate: string;
  reason: string;
  before: ClockSnapshot;
  after: ClockSnapshot;
}

export function submitCorrection(
  input: SubmitCorrectionInput,
): MockClockCorrectionRequest {
  ensureSeeded();
  const requester = findMockUserById(input.requesterId);
  const approverId = requester?.managerId ?? null;
  const req: MockClockCorrectionRequest = {
    id: `ccr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    requesterId: input.requesterId,
    status: 'submitted',
    currentApproverId: approverId,
    submittedAt: new Date(),
    decidedAt: null,
    reason: input.reason,
    targetDate: input.targetDate,
    beforePayload: input.before,
    afterPayload: input.after,
  };
  store.push(req);
  return req;
}

export type WithdrawCorrectionResult =
  | { ok: true; request: MockClockCorrectionRequest }
  | { ok: false; reason: 'NOT_FOUND' | 'NOT_PENDING' | 'FORBIDDEN' };

export function withdrawCorrection(input: {
  id: string;
  requesterId: string;
}): WithdrawCorrectionResult {
  ensureSeeded();
  const req = store.find((r) => r.id === input.id);
  if (!req) return { ok: false, reason: 'NOT_FOUND' };
  if (req.requesterId !== input.requesterId) {
    return { ok: false, reason: 'FORBIDDEN' };
  }
  if (req.status !== 'submitted') {
    return { ok: false, reason: 'NOT_PENDING' };
  }
  req.status = 'withdrawn';
  req.decidedAt = new Date();
  req.currentApproverId = null;
  return { ok: true, request: req };
}

export type CorrectionDecision = 'approve' | 'reject' | 'return';

export type DecideCorrectionResult =
  | { ok: true; request: MockClockCorrectionRequest }
  | { ok: false; reason: 'NOT_FOUND' | 'NOT_PENDING' | 'FORBIDDEN' };

export function decideCorrection(input: {
  id: string;
  deciderId: string;
  decision: CorrectionDecision;
  isAdmin: boolean;
}): DecideCorrectionResult {
  ensureSeeded();
  const req = store.find((r) => r.id === input.id);
  if (!req) return { ok: false, reason: 'NOT_FOUND' };
  if (!input.isAdmin && req.currentApproverId !== input.deciderId) {
    return { ok: false, reason: 'FORBIDDEN' };
  }
  if (req.status !== 'submitted') {
    return { ok: false, reason: 'NOT_PENDING' };
  }

  const nextStatus: ClockCorrectionStatus =
    input.decision === 'approve'
      ? 'approved'
      : input.decision === 'reject'
        ? 'rejected'
        : 'returned';

  req.status = nextStatus;
  req.decidedAt = new Date();

  if (nextStatus === 'approved') {
    replaceClocksForDate(req.requesterId, req.targetDate, req.afterPayload);
  }

  return { ok: true, request: req };
}

export const STATUS_LABEL: Record<ClockCorrectionStatus, string> = {
  submitted: '審査中',
  approved: '承認済',
  rejected: '却下',
  withdrawn: '取下げ',
  returned: '差戻し',
};

export const STATUS_BADGE_CLASS: Record<ClockCorrectionStatus, string> = {
  submitted: 'bg-amber-100 text-amber-900',
  approved: 'bg-emerald-100 text-emerald-900',
  rejected: 'bg-rose-100 text-rose-900',
  withdrawn: 'bg-zinc-200 text-zinc-700',
  returned: 'bg-orange-100 text-orange-900',
};
