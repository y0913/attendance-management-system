import { describe, expect, it } from 'vitest';
import {
  isBusinessDay,
  isHoliday,
  isYearSupported,
} from './holidays';

describe('isHoliday', () => {
  it('returns true for known holidays', () => {
    expect(isHoliday('2025-01-01')).toBe(true); // 元日
    expect(isHoliday('2026-05-03')).toBe(true); // 憲法記念日
    expect(isHoliday('2026-05-06')).toBe(true); // 振替休日
    expect(isHoliday('2026-09-22')).toBe(true); // 国民の休日
  });

  it('returns false for non-holiday weekdays', () => {
    expect(isHoliday('2026-04-15')).toBe(false); // 平日
    expect(isHoliday('2026-05-07')).toBe(false); // 連休明け
  });

  it('returns false for weekends that are not holidays', () => {
    // 2026-04-04 は土曜日（祝日ではない）
    expect(isHoliday('2026-04-04')).toBe(false);
  });
});

describe('isBusinessDay', () => {
  it('weekdays that are not holidays are business days', () => {
    expect(isBusinessDay('2026-04-15')).toBe(true); // 水曜
  });

  it('weekends are not business days', () => {
    expect(isBusinessDay('2026-04-04')).toBe(false); // 土曜
    expect(isBusinessDay('2026-04-05')).toBe(false); // 日曜
  });

  it('holidays on weekdays are not business days', () => {
    expect(isBusinessDay('2026-05-04')).toBe(false); // 月曜・みどりの日
    expect(isBusinessDay('2026-04-29')).toBe(false); // 水曜・昭和の日
  });

  it('holidays falling on weekends are also not business days', () => {
    expect(isBusinessDay('2026-05-03')).toBe(false); // 日曜・憲法記念日
  });
});

describe('isYearSupported', () => {
  // @holiday-jp/holiday_jp に移行後、内蔵データが広範囲のため常に true。
  // 関数は API 互換のため残置している。
  it('returns true for any reasonable year', () => {
    expect(isYearSupported(2024)).toBe(true);
    expect(isYearSupported(2027)).toBe(true);
    expect(isYearSupported(2023)).toBe(true);
    expect(isYearSupported(2028)).toBe(true);
  });
});
