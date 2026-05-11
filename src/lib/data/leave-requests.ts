// Phase 4: 内部を Prisma 経由に書き換え。すべて async。
//
// 型差異:
// - mock leaveType 'paid' ↔ Prisma 'annual' (mock 側の意味は変わらず、APIだけ揃える)
// - days: number ↔ Prisma Decimal(4,1) (Number() で変換)
// - startDate/endDate: 'yyyy-MM-dd' ↔ DateTime @db.Date

import type { LeaveDayUnit, LeaveRequest, RequestStatus } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import { JST_TIMEZONE } from '@/lib/calc/constants';
import { countBusinessDaysBetween } from '@/lib/calc/weekday-count';
import { prisma, withTx, type DbClient } from '@/lib/db';
import { findMockUserById } from './users';

export { countBusinessDaysBetween };

export type LeaveRequestStatus =
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'withdrawn'
  | 'returned';

export type LeaveType = 'paid';
export type { LeaveDayUnit };

export interface MockLeaveRequest {
  id: string;
  requesterId: string;
  status: LeaveRequestStatus;
  currentApproverId: string | null;
  submittedAt: Date;
  decidedAt: Date | null;
  reason: string;
  leaveType: LeaveType;
  dayUnit: LeaveDayUnit;
  startDate: string;
  endDate: string;
  days: number;
}

export const LEAVE_REASON_MAX_LENGTH = 500;

const toJstDateString = (d: Date): string =>
  formatInTimeZone(d, JST_TIMEZONE, 'yyyy-MM-dd');

const toJstDate = (jstDate: string): Date =>
  new Date(`${jstDate}T00:00:00+09:00`);

const toMockLeave = (r: LeaveRequest): MockLeaveRequest => ({
  id: r.id,
  requesterId: r.requesterId,
  status: r.status as LeaveRequestStatus,
  currentApproverId: r.currentApproverId,
  submittedAt: r.submittedAt ?? r.createdAt,
  decidedAt: r.decidedAt,
  reason: r.reason,
  leaveType: 'paid', // Prisma 'annual' を mock の 'paid' にマップ
  dayUnit: r.dayUnit,
  startDate: toJstDateString(r.startDate),
  endDate: toJstDateString(r.endDate),
  days: Number(r.days),
});

export async function listLeaveRequests(
  userId: string,
): Promise<MockLeaveRequest[]> {
  const list = await prisma.leaveRequest.findMany({
    where: { requesterId: userId },
    orderBy: { submittedAt: 'desc' },
  });
  return list.map(toMockLeave);
}

// 複数 user 分を 1 query で取得し、user ごとに group して返す。
// admin/attendance のような super-batch 集計用。
export async function listLeaveRequestsForUsers(
  userIds: string[],
): Promise<Map<string, MockLeaveRequest[]>> {
  const byUser = new Map<string, MockLeaveRequest[]>();
  if (userIds.length === 0) return byUser;
  const list = await prisma.leaveRequest.findMany({
    where: { requesterId: { in: userIds } },
    orderBy: { submittedAt: 'desc' },
  });
  for (const r of list) {
    const m = toMockLeave(r);
    const arr = byUser.get(m.requesterId) ?? [];
    arr.push(m);
    byUser.set(m.requesterId, arr);
  }
  return byUser;
}

export async function findLeaveRequestById(
  companyId: string,
  id: string,
): Promise<MockLeaveRequest | null> {
  const r = await prisma.leaveRequest.findFirst({
    where: { id, requester: { companyId } },
  });
  return r ? toMockLeave(r) : null;
}

export async function listPendingLeavesForApprover(
  approverId: string,
): Promise<MockLeaveRequest[]> {
  const list = await prisma.leaveRequest.findMany({
    where: { currentApproverId: approverId, status: 'submitted' },
    orderBy: { submittedAt: 'asc' },
  });
  return list.map(toMockLeave);
}

export async function listAllPendingLeaves(
  companyId: string,
): Promise<MockLeaveRequest[]> {
  const list = await prisma.leaveRequest.findMany({
    where: { status: 'submitted', requester: { companyId } },
    orderBy: { submittedAt: 'asc' },
  });
  return list.map(toMockLeave);
}

export async function listAllLeaves(
  companyId: string,
): Promise<MockLeaveRequest[]> {
  const list = await prisma.leaveRequest.findMany({
    where: { requester: { companyId } },
    orderBy: { submittedAt: 'desc' },
  });
  return list.map(toMockLeave);
}

export interface SubmitLeaveInput {
  requesterId: string;
  leaveType: LeaveType;
  dayUnit: LeaveDayUnit;
  startDate: string;
  endDate: string;
  reason: string;
}

export type SubmitLeaveResult =
  | { ok: true; request: MockLeaveRequest }
  | { ok: false; reason: 'HALF_DAY_REQUIRES_SINGLE_DATE' };

export async function submitLeave(
  input: SubmitLeaveInput,
  db: DbClient = prisma,
): Promise<SubmitLeaveResult> {
  if (input.dayUnit === 'half' && input.startDate !== input.endDate) {
    return { ok: false, reason: 'HALF_DAY_REQUIRES_SINGLE_DATE' };
  }
  const requester = await findMockUserById(input.requesterId);
  const approverId = requester?.managerId ?? null;
  const days =
    input.dayUnit === 'half'
      ? 0.5
      : countBusinessDaysBetween(input.startDate, input.endDate);
  const created = await db.leaveRequest.create({
    data: {
      requesterId: input.requesterId,
      currentApproverId: approverId,
      status: 'submitted',
      submittedAt: new Date(),
      reason: input.reason,
      leaveType: 'annual',
      dayUnit: input.dayUnit,
      startDate: toJstDate(input.startDate),
      endDate: toJstDate(input.endDate),
      days,
    },
  });
  return { ok: true, request: toMockLeave(created) };
}

export type WithdrawLeaveResult =
  | { ok: true; request: MockLeaveRequest }
  | { ok: false; reason: 'NOT_FOUND' | 'NOT_PENDING' | 'FORBIDDEN' };

export async function withdrawLeave(
  input: {
    id: string;
    requesterId: string;
  },
  db: DbClient = prisma,
): Promise<WithdrawLeaveResult> {
  return withTx(db, async (tx) => {
    const req = await tx.leaveRequest.findUnique({ where: { id: input.id } });
    if (!req) return { ok: false, reason: 'NOT_FOUND' };
    if (req.requesterId !== input.requesterId) {
      return { ok: false, reason: 'FORBIDDEN' };
    }
    if (req.status !== 'submitted') {
      return { ok: false, reason: 'NOT_PENDING' };
    }
    const updated = await tx.leaveRequest.update({
      where: { id: input.id },
      data: {
        status: 'withdrawn',
        decidedAt: new Date(),
        currentApproverId: null,
      },
    });
    return { ok: true, request: toMockLeave(updated) };
  });
}

export type LeaveDecision = 'approve' | 'reject' | 'return';

export type DecideLeaveResult =
  | { ok: true; request: MockLeaveRequest }
  | { ok: false; reason: 'NOT_FOUND' | 'NOT_PENDING' | 'FORBIDDEN' };

export async function decideLeave(
  input: {
    companyId: string;
    id: string;
    deciderId: string;
    decision: LeaveDecision;
    isAdmin: boolean;
  },
  db: DbClient = prisma,
): Promise<DecideLeaveResult> {
  return withTx(db, async (tx) => {
    const req = await tx.leaveRequest.findFirst({
      where: { id: input.id, requester: { companyId: input.companyId } },
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
    const updated = await tx.leaveRequest.update({
      where: { id: input.id },
      data: { status: nextStatus, decidedAt: new Date() },
    });
    return { ok: true, request: toMockLeave(updated) };
  });
}

export const LEAVE_STATUS_LABEL: Record<LeaveRequestStatus, string> = {
  submitted: '審査中',
  approved: '承認済',
  rejected: '却下',
  withdrawn: '取下げ',
  returned: '差戻し',
};

export const LEAVE_STATUS_BADGE_CLASS: Record<LeaveRequestStatus, string> = {
  submitted: 'bg-amber-100 text-amber-900',
  approved: 'bg-emerald-100 text-emerald-900',
  rejected: 'bg-rose-100 text-rose-900',
  withdrawn: 'bg-zinc-200 text-zinc-700',
  returned: 'bg-orange-100 text-orange-900',
};

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  paid: '有給休暇',
};
