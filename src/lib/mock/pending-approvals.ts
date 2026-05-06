import {
  listPendingCorrectionsForApprover,
  type MockClockCorrectionRequest,
} from './clock-corrections';
import {
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
