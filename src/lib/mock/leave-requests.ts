import { countWeekdaysBetween } from '@/lib/calc/weekday-count';
import { findMockUserById } from './users';
import { buildSeedLeaves } from './seed-leave-requests';

export { countWeekdaysBetween };

export type LeaveRequestStatus =
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'withdrawn'
  | 'returned';

export type LeaveType = 'paid';

export interface MockLeaveRequest {
  id: string;
  requesterId: string;
  status: LeaveRequestStatus;
  currentApproverId: string | null;
  submittedAt: Date;
  decidedAt: Date | null;
  reason: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
}

export const LEAVE_REASON_MAX_LENGTH = 500;

const store: MockLeaveRequest[] = [];

let seeded = false;
function ensureSeeded(): void {
  if (seeded) return;
  seeded = true;
  for (const r of buildSeedLeaves()) {
    store.push({
      id: `lr_seed_${store.length}`,
      requesterId: r.requesterId,
      status: r.status,
      currentApproverId: r.approverId,
      submittedAt: r.submittedAt,
      decidedAt: r.decidedAt,
      reason: r.reason,
      leaveType: r.leaveType,
      startDate: r.startDate,
      endDate: r.endDate,
      days: r.days,
    });
  }
}

export function listLeaveRequests(userId: string): MockLeaveRequest[] {
  ensureSeeded();
  return store
    .filter((r) => r.requesterId === userId)
    .slice()
    .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
}

export function findLeaveRequestById(id: string): MockLeaveRequest | null {
  ensureSeeded();
  return store.find((r) => r.id === id) ?? null;
}

export function listPendingLeavesForApprover(
  approverId: string,
): MockLeaveRequest[] {
  ensureSeeded();
  return store
    .filter(
      (r) =>
        r.currentApproverId === approverId && r.status === 'submitted',
    )
    .slice()
    .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
}

export interface SubmitLeaveInput {
  requesterId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}

export function submitLeave(input: SubmitLeaveInput): MockLeaveRequest {
  ensureSeeded();
  const requester = findMockUserById(input.requesterId);
  const approverId = requester?.managerId ?? null;
  const days = countWeekdaysBetween(input.startDate, input.endDate);
  const req: MockLeaveRequest = {
    id: `lr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    requesterId: input.requesterId,
    status: 'submitted',
    currentApproverId: approverId,
    submittedAt: new Date(),
    decidedAt: null,
    reason: input.reason,
    leaveType: input.leaveType,
    startDate: input.startDate,
    endDate: input.endDate,
    days,
  };
  store.push(req);
  return req;
}

export type LeaveDecision = 'approve' | 'reject' | 'return';

export type DecideLeaveResult =
  | { ok: true; request: MockLeaveRequest }
  | { ok: false; reason: 'NOT_FOUND' | 'NOT_PENDING' | 'FORBIDDEN' };

export function decideLeave(input: {
  id: string;
  deciderId: string;
  decision: LeaveDecision;
  isAdmin: boolean;
}): DecideLeaveResult {
  ensureSeeded();
  const req = store.find((r) => r.id === input.id);
  if (!req) return { ok: false, reason: 'NOT_FOUND' };
  if (!input.isAdmin && req.currentApproverId !== input.deciderId) {
    return { ok: false, reason: 'FORBIDDEN' };
  }
  if (req.status !== 'submitted') {
    return { ok: false, reason: 'NOT_PENDING' };
  }

  const nextStatus: LeaveRequestStatus =
    input.decision === 'approve'
      ? 'approved'
      : input.decision === 'reject'
        ? 'rejected'
        : 'returned';

  req.status = nextStatus;
  req.decidedAt = new Date();

  return { ok: true, request: req };
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
