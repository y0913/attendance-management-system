import type { WorkRuleVersion } from './types';

export function getEffectiveRule(
  rules: WorkRuleVersion[],
  date: Date,
): WorkRuleVersion {
  const candidates = rules.filter((r) => r.validFrom.getTime() <= date.getTime());
  if (candidates.length === 0) {
    throw new Error(
      `No effective WorkRuleVersion found for date ${date.toISOString()}`,
    );
  }
  return candidates.reduce((latest, r) =>
    r.validFrom.getTime() > latest.validFrom.getTime() ? r : latest,
  );
}
