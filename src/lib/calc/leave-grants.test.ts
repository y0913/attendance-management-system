import { describe, expect, it } from 'vitest';
import {
  applyFifoConsumption,
  computeLegalGrants,
  legalGrantDaysForIndex,
  summarizeBalance,
} from './leave-grants';

const jstDate = (s: string) => new Date(`${s}T00:00:00+09:00`);

describe('legalGrantDaysForIndex', () => {
  it('matches the legal schedule', () => {
    expect(legalGrantDaysForIndex(0)).toBe(10);
    expect(legalGrantDaysForIndex(1)).toBe(11);
    expect(legalGrantDaysForIndex(2)).toBe(12);
    expect(legalGrantDaysForIndex(3)).toBe(14);
    expect(legalGrantDaysForIndex(4)).toBe(16);
    expect(legalGrantDaysForIndex(5)).toBe(18);
    expect(legalGrantDaysForIndex(6)).toBe(20);
    expect(legalGrantDaysForIndex(20)).toBe(20);
  });
});

describe('computeLegalGrants', () => {
  it('returns no grants before 6 months', () => {
    const hired = jstDate('2024-01-01');
    const asOf = jstDate('2024-06-30');
    expect(computeLegalGrants(hired, asOf)).toEqual([]);
  });

  it('grants 10 days at 6 months exactly', () => {
    const hired = jstDate('2024-01-01');
    const asOf = jstDate('2024-07-01');
    const grants = computeLegalGrants(hired, asOf);
    expect(grants).toHaveLength(1);
    expect(grants[0].grantedDays).toBe(10);
  });

  it('progresses through the schedule', () => {
    const hired = jstDate('2018-04-01');
    const asOf = jstDate('2026-05-01');
    const grants = computeLegalGrants(hired, asOf);
    expect(grants.map((g) => g.grantedDays)).toEqual([
      10,
      11,
      12,
      14,
      16,
      18,
      20,
      20,
    ]);
  });

  it('sets expiration 2 years after grant', () => {
    const hired = jstDate('2024-01-01');
    const asOf = jstDate('2024-12-01');
    const grants = computeLegalGrants(hired, asOf);
    expect(grants[0].grantedAt.toISOString()).toBe(
      jstDate('2024-07-01').toISOString(),
    );
    expect(grants[0].expiresAt.toISOString()).toBe(
      jstDate('2026-07-01').toISOString(),
    );
  });
});

describe('applyFifoConsumption', () => {
  const asOf = jstDate('2026-05-01');

  it('consumes oldest grant first', () => {
    const grants = computeLegalGrants(jstDate('2024-01-01'), asOf);
    const result = applyFifoConsumption(grants, 8, asOf);
    expect(result[0].usedDays).toBe(8);
    expect(result[0].remainingDays).toBe(2);
    expect(result[1].usedDays).toBe(0);
    expect(result[1].remainingDays).toBe(11);
  });

  it('cascades when oldest is depleted', () => {
    const grants = computeLegalGrants(jstDate('2024-01-01'), asOf);
    const result = applyFifoConsumption(grants, 13, asOf);
    expect(result[0].usedDays).toBe(10);
    expect(result[0].remainingDays).toBe(0);
    expect(result[1].usedDays).toBe(3);
    expect(result[1].remainingDays).toBe(8);
  });

  it('marks expired grants and skips them', () => {
    const grants = computeLegalGrants(jstDate('2018-04-01'), asOf);
    const result = applyFifoConsumption(grants, 5, asOf);
    expect(result[0].expired).toBe(true);
    expect(result[0].usedDays).toBe(0);
    const firstActive = result.find((g) => !g.expired);
    expect(firstActive?.usedDays).toBe(5);
  });
});

describe('summarizeBalance', () => {
  const asOf = jstDate('2026-05-01');

  it('totals remaining days across non-expired grants', () => {
    const grants = computeLegalGrants(jstDate('2024-01-01'), asOf);
    const usage = applyFifoConsumption(grants, 5, asOf);
    const summary = summarizeBalance(usage, asOf);
    expect(summary.totalRemaining).toBe(10 - 5 + 11);
  });

  it('flags grants expiring within the window', () => {
    const grants = computeLegalGrants(jstDate('2024-01-01'), asOf);
    const usage = applyFifoConsumption(grants, 0, asOf);
    const summary = summarizeBalance(usage, asOf, 90);
    expect(summary.expiringSoonDays).toBe(10);
  });

  it('does not flag grants outside the window', () => {
    const grants = computeLegalGrants(jstDate('2024-01-01'), asOf);
    const usage = applyFifoConsumption(grants, 0, asOf);
    const summary = summarizeBalance(usage, asOf, 30);
    expect(summary.expiringSoonDays).toBe(0);
  });
});
