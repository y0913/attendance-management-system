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

export function listPendingForApprover(approverId: string): PendingItem[] {
  const corrections: PendingItem[] = listPendingCorrectionsForApprover(
    approverId,
  ).map((request) => ({ kind: 'correction', request }));
  const leaves: PendingItem[] = listPendingLeavesForApprover(approverId).map(
    (request) => ({ kind: 'leave', request }),
  );
  return [...corrections, ...leaves].sort(
    (a, b) =>
      a.request.submittedAt.getTime() - b.request.submittedAt.getTime(),
  );
}

export function countPendingForApprover(approverId: string): number {
  return (
    listPendingCorrectionsForApprover(approverId).length +
    listPendingLeavesForApprover(approverId).length
  );
}

export function listAllPending(): PendingItem[] {
  const corrections: PendingItem[] = listAllPendingCorrections().map(
    (request) => ({ kind: 'correction', request }),
  );
  const leaves: PendingItem[] = listAllPendingLeaves().map((request) => ({
    kind: 'leave',
    request,
  }));
  return [...corrections, ...leaves].sort(
    (a, b) =>
      a.request.submittedAt.getTime() - b.request.submittedAt.getTime(),
  );
}

export function countAllPending(): number {
  return listAllPendingCorrections().length + listAllPendingLeaves().length;
}

export function listAllRecentRequests(limit: number): PendingItem[] {
  const corrections: PendingItem[] = listAllCorrections().map((request) => ({
    kind: 'correction',
    request,
  }));
  const leaves: PendingItem[] = listAllLeaves().map((request) => ({
    kind: 'leave',
    request,
  }));
  return [...corrections, ...leaves]
    .sort(
      (a, b) =>
        b.request.submittedAt.getTime() - a.request.submittedAt.getTime(),
    )
    .slice(0, limit);
}
