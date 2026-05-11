import {
  listAllCorrections,
  listAllPendingCorrections,
  listPendingCorrectionsForApprover,
  type MockClockCorrectionRequest,
} from './clock-corrections';
import {
  listAllLeaves,
  listAllPendingLeaves,
  listPendingLeavesForApprover,
  type MockLeaveRequest,
} from './leave-requests';

export type PendingItem =
  | { kind: 'correction'; request: MockClockCorrectionRequest }
  | { kind: 'leave'; request: MockLeaveRequest };

export async function listPendingForApprover(
  approverId: string,
): Promise<PendingItem[]> {
  const [corrs, leaves] = await Promise.all([
    listPendingCorrectionsForApprover(approverId),
    listPendingLeavesForApprover(approverId),
  ]);
  const corrections: PendingItem[] = corrs.map((request) => ({
    kind: 'correction',
    request,
  }));
  const leavesItems: PendingItem[] = leaves.map((request) => ({
    kind: 'leave',
    request,
  }));
  return [...corrections, ...leavesItems].sort(
    (a, b) =>
      a.request.submittedAt.getTime() - b.request.submittedAt.getTime(),
  );
}

export async function countPendingForApprover(
  approverId: string,
): Promise<number> {
  const [corrs, leaves] = await Promise.all([
    listPendingCorrectionsForApprover(approverId),
    listPendingLeavesForApprover(approverId),
  ]);
  return corrs.length + leaves.length;
}

export async function listAllPending(
  companyId: string,
): Promise<PendingItem[]> {
  const [corrs, leaves] = await Promise.all([
    listAllPendingCorrections(companyId),
    listAllPendingLeaves(companyId),
  ]);
  const corrections: PendingItem[] = corrs.map((request) => ({
    kind: 'correction',
    request,
  }));
  const leavesItems: PendingItem[] = leaves.map((request) => ({
    kind: 'leave',
    request,
  }));
  return [...corrections, ...leavesItems].sort(
    (a, b) =>
      a.request.submittedAt.getTime() - b.request.submittedAt.getTime(),
  );
}

export async function countAllPending(companyId: string): Promise<number> {
  const [corrs, leaves] = await Promise.all([
    listAllPendingCorrections(companyId),
    listAllPendingLeaves(companyId),
  ]);
  return corrs.length + leaves.length;
}

export async function listAllRecentRequests(
  companyId: string,
  limit: number,
): Promise<PendingItem[]> {
  const [corrs, leaves] = await Promise.all([
    listAllCorrections(companyId),
    listAllLeaves(companyId),
  ]);
  const corrections: PendingItem[] = corrs.map((request) => ({
    kind: 'correction',
    request,
  }));
  const leavesItems: PendingItem[] = leaves.map((request) => ({
    kind: 'leave',
    request,
  }));
  return [...corrections, ...leavesItems]
    .sort(
      (a, b) =>
        b.request.submittedAt.getTime() - a.request.submittedAt.getTime(),
    )
    .slice(0, limit);
}
