import { describe, expect, it } from 'vitest';
import { countBusinessDaysBetween } from './weekday-count';

describe('countBusinessDaysBetween', () => {
  it('counts a single business day', () => {
    // 2026-04-15 水曜日（祝日でない）
    expect(countBusinessDaysBetween('2026-04-15', '2026-04-15')).toBe(1);
  });

  it('returns 0 when single day is weekend', () => {
    expect(countBusinessDaysBetween('2026-04-04', '2026-04-04')).toBe(0); // 土
    expect(countBusinessDaysBetween('2026-04-05', '2026-04-05')).toBe(0); // 日
  });

  it('returns 0 when single day is a holiday', () => {
    expect(countBusinessDaysBetween('2026-05-04', '2026-05-04')).toBe(0); // みどりの日（月）
  });

  it('counts a normal week (Mon-Fri) as 5', () => {
    // 2026-04-13 月 〜 2026-04-17 金（祝日なし）
    expect(countBusinessDaysBetween('2026-04-13', '2026-04-17')).toBe(5);
  });

  it('excludes weekends from a span including weekend', () => {
    // 2026-04-13 月 〜 2026-04-19 日 → 平日5日
    expect(countBusinessDaysBetween('2026-04-13', '2026-04-19')).toBe(5);
  });

  it('excludes holidays in a GW-like span', () => {
    // 2026-05-01 金 〜 2026-05-08 金
    // 5/1 金, 5/2 土, 5/3 日(憲法), 5/4 月(みどり), 5/5 火(こども),
    // 5/6 水(振替), 5/7 木, 5/8 金
    // 業務日: 5/1, 5/7, 5/8 = 3日
    expect(countBusinessDaysBetween('2026-05-01', '2026-05-08')).toBe(3);
  });

  it('returns 0 for invalid date order', () => {
    expect(countBusinessDaysBetween('2026-04-20', '2026-04-15')).toBe(0);
  });
});
