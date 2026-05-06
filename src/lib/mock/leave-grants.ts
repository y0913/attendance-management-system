import {
  applyFifoConsumption,
  computeLegalGrants,
  nextLegalGrant,
  summarizeBalance,
  type BalanceSummary,
  type GrantWithUsage,
  type LegalGrant,
} from '@/lib/calc/leave-grants';
import { listLeaveRequests } from './leave-requests';
import { findMockUserById } from './users';

export interface UserLeaveBalance {
  userId: string;
  asOf: Date;
  hiredAt: Date;
  grants: GrantWithUsage[];
  summary: BalanceSummary;
  totalApprovedDays: number;
  nextGrant: LegalGrant | null;
}

export async function getUserLeaveBalance(
  userId: string,
  asOf: Date = new Date(),
): Promise<UserLeaveBalance | null> {
  const user = await findMockUserById(userId);
  if (!user) return null;

  const grants = computeLegalGrants(user.hiredAt, asOf);
  const totalApprovedDays = (await listLeaveRequests(userId))
    .filter((r) => r.status === 'approved')
    .reduce((sum, r) => sum + r.days, 0);

  const grantsWithUsage = applyFifoConsumption(grants, totalApprovedDays, asOf);
  const summary = summarizeBalance(grantsWithUsage, asOf);
  const next = nextLegalGrant(user.hiredAt, asOf);

  return {
    userId,
    asOf,
    hiredAt: user.hiredAt,
    grants: grantsWithUsage,
    summary,
    totalApprovedDays,
    nextGrant: next,
  };
}
