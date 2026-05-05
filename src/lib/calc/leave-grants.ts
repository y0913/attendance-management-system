import { addMonths, addYears } from 'date-fns';

export interface LegalGrant {
  grantedAt: Date;
  expiresAt: Date;
  grantedDays: number;
}

const GRANT_SCHEDULE = [10, 11, 12, 14, 16, 18] as const;
const STEADY_STATE_DAYS = 20;

export function legalGrantDaysForIndex(index: number): number {
  if (index < GRANT_SCHEDULE.length) return GRANT_SCHEDULE[index];
  return STEADY_STATE_DAYS;
}

export function computeLegalGrants(
  hiredAt: Date,
  asOf: Date,
): LegalGrant[] {
  const grants: LegalGrant[] = [];
  for (let i = 0; ; i++) {
    const monthsAfterHire = 6 + 12 * i;
    const grantedAt = addMonths(hiredAt, monthsAfterHire);
    if (grantedAt.getTime() > asOf.getTime()) break;
    grants.push({
      grantedAt,
      expiresAt: addYears(grantedAt, 2),
      grantedDays: legalGrantDaysForIndex(i),
    });
  }
  return grants;
}

export function nextLegalGrant(
  hiredAt: Date,
  asOf: Date,
): LegalGrant | null {
  const granted = computeLegalGrants(hiredAt, asOf);
  const nextIndex = granted.length;
  const monthsAfterHire = 6 + 12 * nextIndex;
  const grantedAt = addMonths(hiredAt, monthsAfterHire);
  return {
    grantedAt,
    expiresAt: addYears(grantedAt, 2),
    grantedDays: legalGrantDaysForIndex(nextIndex),
  };
}

export interface GrantWithUsage extends LegalGrant {
  usedDays: number;
  remainingDays: number;
  expired: boolean;
}

export function applyFifoConsumption(
  grants: LegalGrant[],
  totalUsedDays: number,
  asOf: Date,
): GrantWithUsage[] {
  let remainingToConsume = totalUsedDays;
  return grants.map((g) => {
    const expired = g.expiresAt.getTime() <= asOf.getTime();
    if (expired) {
      return { ...g, usedDays: 0, remainingDays: 0, expired: true };
    }
    const consumed = Math.min(g.grantedDays, remainingToConsume);
    remainingToConsume -= consumed;
    return {
      ...g,
      usedDays: consumed,
      remainingDays: g.grantedDays - consumed,
      expired: false,
    };
  });
}

export interface BalanceSummary {
  totalRemaining: number;
  expiringSoonDays: number;
  expiringSoonThreshold: Date;
}

export function summarizeBalance(
  grantsWithUsage: GrantWithUsage[],
  asOf: Date,
  expirationWindowDays = 90,
): BalanceSummary {
  const threshold = new Date(asOf);
  threshold.setUTCDate(threshold.getUTCDate() + expirationWindowDays);
  let totalRemaining = 0;
  let expiringSoonDays = 0;
  for (const g of grantsWithUsage) {
    if (g.expired) continue;
    totalRemaining += g.remainingDays;
    if (g.expiresAt.getTime() <= threshold.getTime()) {
      expiringSoonDays += g.remainingDays;
    }
  }
  return {
    totalRemaining,
    expiringSoonDays,
    expiringSoonThreshold: threshold,
  };
}
