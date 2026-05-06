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

export async function listAllPending(): Promise<PendingItem[]> {
  const [corrs, leaves] = await Promise.all([
    listAllPendingCorrections(),
    listAllPendingLeaves(),
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

export async function countAllPending(): Promise<number> {
  const [corrs, leaves] = await Promise.all([
    listAllPendingCorrections(),
    listAllPendingLeaves(),
  ]);
  return corrs.length + leaves.length;
}

export async function listAllRecentRequests(
  limit: number,
): Promise<PendingItem[]> {
  const [corrs, leaves] = await Promise.all([
    listAllCorrections(),
    listAllLeaves(),
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
