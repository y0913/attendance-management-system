// Phase 4: 内部を Prisma 経由に書き換え。すべて async。
//
// Prisma の DateTime ↔ mock の 'yyyy-MM-dd' 文字列、Json ↔ ClockSnapshot は
// マッパー関数で変換する。

import { formatInTimeZone } from 'date-fns-tz';
import type { ClockCorrectionRequest, RequestStatus } from '@prisma/client';
import { JST_TIMEZONE } from '@/lib/calc/constants';
import { prisma } from '@/lib/db';
import { listClocksForDate, replaceClocksForDate } from './time-clocks';
import { findMockUserById } from './users';

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

const toJstDateString = (d: Date): string =>
  formatInTimeZone(d, JST_TIMEZONE, 'yyyy-MM-dd');

const toJstDate = (jstDate: string): Date =>
  new Date(`${jstDate}T00:00:00+09:00`);

const toMockCorrection = (
  r: ClockCorrectionRequest,
): MockClockCorrectionRequest => ({
  id: r.id,
  requesterId: r.requesterId,
  status: r.status as ClockCorrectionStatus,
  currentApproverId: r.currentApproverId,
  submittedAt: r.submittedAt ?? r.createdAt,
  decidedAt: r.decidedAt,
  reason: r.reason,
  targetDate: toJstDateString(r.targetDate),
  beforePayload: r.beforePayload as unknown as ClockSnapshot,
  afterPayload: r.afterPayload as unknown as ClockSnapshot,
});

export async function listCorrectionRequests(
  userId: string,
): Promise<MockClockCorrectionRequest[]> {
  const list = await prisma.clockCorrectionRequest.findMany({
    where: { requesterId: userId },
    orderBy: { submittedAt: 'desc' },
  });
  return list.map(toMockCorrection);
}

export async function findActiveCorrection(
  userId: string,
  targetDate: string,
): Promise<MockClockCorrectionRequest | null> {
  const r = await prisma.clockCorrectionRequest.findFirst({
    where: {
      requesterId: userId,
      targetDate: toJstDate(targetDate),
      status: 'submitted',
    },
  });
  return r ? toMockCorrection(r) : null;
}

export async function findCorrectionById(
  id: string,
): Promise<MockClockCorrectionRequest | null> {
  const r = await prisma.clockCorrectionRequest.findUnique({ where: { id } });
  return r ? toMockCorrection(r) : null;
}

export async function listCorrectionRequestsForUserDate(
  userId: string,
  targetDate: string,
): Promise<MockClockCorrectionRequest[]> {
  const list = await prisma.clockCorrectionRequest.findMany({
    where: { requesterId: userId, targetDate: toJstDate(targetDate) },
    orderBy: { submittedAt: 'desc' },
  });
  return list.map(toMockCorrection);
}

export async function listPendingCorrectionsForApprover(
  approverId: string,
): Promise<MockClockCorrectionRequest[]> {
  const list = await prisma.clockCorrectionRequest.findMany({
    where: { currentApproverId: approverId, status: 'submitted' },
    orderBy: { submittedAt: 'asc' },
  });
  return list.map(toMockCorrection);
}

export async function listAllPendingCorrections(): Promise<
  MockClockCorrectionRequest[]
> {
  const list = await prisma.clockCorrectionRequest.findMany({
    where: { status: 'submitted' },
    orderBy: { submittedAt: 'asc' },
  });
  return list.map(toMockCorrection);
}

export async function listAllCorrections(): Promise<
  MockClockCorrectionRequest[]
> {
  const list = await prisma.clockCorrectionRequest.findMany({
    orderBy: { submittedAt: 'desc' },
  });
  return list.map(toMockCorrection);
}

const fmtTime = (d: Date): string =>
  formatInTimeZone(d, JST_TIMEZONE, 'HH:mm');

export async function captureCurrentSnapshot(
  userId: string,
  targetDate: string,
): Promise<ClockSnapshot> {
  const dayDate = toJstDate(targetDate);
  const clocks = await listClocksForDate(userId, dayDate);
  const find = (t: string) =>
    clocks.find((c) => c.type === t)?.occurredAt ?? null;
  return {
    clockIn: find('clock_in') ? fmtTime(find('clock_in') as Date) : null,
    clockOut: find('clock_out') ? fmtTime(find('clock_out') as Date) : null,
    breakStart: find('break_start') ? fmtTime(find('break_start') as Date) : null,
    breakEnd: find('break_end') ? fmtTime(find('break_end') as Date) : null,
  };
}

export interface SubmitCorrectionInput {
  requesterId: string;
  targetDate: string;
  reason: string;
  before: ClockSnapshot;
  after: ClockSnapshot;
}

export async function submitCorrection(
  input: SubmitCorrectionInput,
): Promise<MockClockCorrectionRequest> {
  const requester = await findMockUserById(input.requesterId);
  const approverId = requester?.managerId ?? null;
  const created = await prisma.clockCorrectionRequest.create({
    data: {
      requesterId: input.requesterId,
      currentApproverId: approverId,
      status: 'submitted',
      submittedAt: new Date(),
      reason: input.reason,
      targetDate: toJstDate(input.targetDate),
      beforePayload: input.before as object,
      afterPayload: input.after as object,
    },
  });
  return toMockCorrection(created);
}

export type WithdrawCorrectionResult =
  | { ok: true; request: MockClockCorrectionRequest }
  | { ok: false; reason: 'NOT_FOUND' | 'NOT_PENDING' | 'FORBIDDEN' };

export async function withdrawCorrection(input: {
  id: string;
  requesterId: string;
}): Promise<WithdrawCorrectionResult> {
  const req = await prisma.clockCorrectionRequest.findUnique({
    where: { id: input.id },
  });
  if (!req) return { ok: false, reason: 'NOT_FOUND' };
  if (req.requesterId !== input.requesterId) {
    return { ok: false, reason: 'FORBIDDEN' };
  }
  if (req.status !== 'submitted') {
    return { ok: false, reason: 'NOT_PENDING' };
  }
  const updated = await prisma.clockCorrectionRequest.update({
    where: { id: input.id },
    data: {
      status: 'withdrawn',
      decidedAt: new Date(),
      currentApproverId: null,
    },
  });
  return { ok: true, request: toMockCorrection(updated) };
}

export type CorrectionDecision = 'approve' | 'reject' | 'return';

export type DecideCorrectionResult =
  | { ok: true; request: MockClockCorrectionRequest }
  | { ok: false; reason: 'NOT_FOUND' | 'NOT_PENDING' | 'FORBIDDEN' };

export async function decideCorrection(input: {
  id: string;
  deciderId: string;
  decision: CorrectionDecision;
  isAdmin: boolean;
}): Promise<DecideCorrectionResult> {
  const req = await prisma.clockCorrectionRequest.findUnique({
    where: { id: input.id },
  });
  if (!req) return { ok: false, reason: 'NOT_FOUND' };
  if (!input.isAdmin && req.currentApproverId !== input.deciderId) {
    return { ok: false, reason: 'FORBIDDEN' };
  }
  if (req.status !== 'submitted') {
    return { ok: false, reason: 'NOT_PENDING' };
  }

  const nextStatus: RequestStatus =
    input.decision === 'approve'
      ? 'approved'
      : input.decision === 'reject'
        ? 'rejected'
        : 'returned';

  const updated = await prisma.clockCorrectionRequest.update({
    where: { id: input.id },
    data: { status: nextStatus, decidedAt: new Date() },
  });

  if (nextStatus === 'approved') {
    await replaceClocksForDate(
      req.requesterId,
      toJstDateString(req.targetDate),
      req.afterPayload as unknown as ClockSnapshot,
    );
  }

  return { ok: true, request: toMockCorrection(updated) };
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
