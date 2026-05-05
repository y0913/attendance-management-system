import { describe, expect, it } from 'vitest';
import { calcPremiumPay } from './premium-pay';
import { baseRule } from './_test/fixtures';
import type { MonthlySummary } from './types';

const emptySummary = (
  override: Partial<MonthlySummary> = {},
): MonthlySummary => ({
  yearMonth: '2025-04',
  regularWorkMinutes: 0,
  regularNightMinutes: 0,
  regularOtMinutes: 0,
  regularOtNightMinutes: 0,
  monthly60hOtMinutes: 0,
  monthly60hOtNightMinutes: 0,
  legalHolidayWorkMinutes: 0,
  legalHolidayNightMinutes: 0,
  exceptionDaysCount: 0,
  ...override,
});

const BASE = 1500;

describe('calcPremiumPay', () => {
  it('1. 通常 8h × 22日 (regularWork=10560)', () => {
    const r = calcPremiumPay(
      emptySummary({ regularWorkMinutes: 10560 }),
      BASE,
      baseRule(),
    );
    expect(r.regularPay).toBeCloseTo(264_000, 5);
    expect(r.total).toBeCloseTo(264_000, 5);
  });

  it('2. 通常 + 残業 60h以下 (regularOt=3000) → ×1.25 上乗せ', () => {
    const r = calcPremiumPay(
      emptySummary({ regularWorkMinutes: 10560, regularOtMinutes: 3000 }),
      BASE,
      baseRule(),
    );
    expect(r.regularOtPay).toBeCloseTo(93_750, 5);
    expect(r.total).toBeCloseTo(264_000 + 93_750, 5);
  });

  it('3. 月60h超 (monthly60hOt=600) → ×1.5', () => {
    const r = calcPremiumPay(
      emptySummary({ monthly60hOtMinutes: 600 }),
      BASE,
      baseRule(),
    );
    expect(r.monthly60hOtPay).toBeCloseTo(22_500, 5);
    expect(r.total).toBeCloseTo(22_500, 5);
  });

  it('4. 残業+深夜 60h以下 (regularOtNight=60) → ×1.5', () => {
    const r = calcPremiumPay(
      emptySummary({ regularOtNightMinutes: 60 }),
      BASE,
      baseRule(),
    );
    expect(r.regularOtNightPay).toBeCloseTo(2_250, 5);
    expect(r.total).toBeCloseTo(2_250, 5);
  });

  it('5. 法定休日 8h (legalHolidayWork=480) → ×1.35', () => {
    const r = calcPremiumPay(
      emptySummary({ legalHolidayWorkMinutes: 480 }),
      BASE,
      baseRule(),
    );
    expect(r.legalHolidayPay).toBeCloseTo(16_200, 5);
    expect(r.total).toBeCloseTo(16_200, 5);
  });

  it('6. 法休+深夜 (legalHolidayNight=360) → ×1.6', () => {
    const r = calcPremiumPay(
      emptySummary({ legalHolidayNightMinutes: 360 }),
      BASE,
      baseRule(),
    );
    expect(r.legalHolidayNightPay).toBeCloseTo(14_400, 5);
    expect(r.total).toBeCloseTo(14_400, 5);
  });

  it('7. compliance OFF + otRate=1.0 (regularOt=3600) → 上乗せなし', () => {
    const r = calcPremiumPay(
      emptySummary({ regularOtMinutes: 3600 }),
      BASE,
      baseRule({ otRate: 1.0, complianceMode: false }),
    );
    expect(r.regularOtPay).toBeCloseTo(90_000, 5);
    expect(r.total).toBeCloseTo(90_000, 5);
  });

  it('8. 通常深夜 (regularNight=120) → ×1.25', () => {
    const r = calcPremiumPay(
      emptySummary({ regularNightMinutes: 120 }),
      BASE,
      baseRule(),
    );
    expect(r.regularNightPay).toBeCloseTo(120 * 25 * 1.25, 5);
    expect(r.total).toBeCloseTo(3_750, 5);
  });

  it('9. 月60h超+深夜 (monthly60hOtNight=120) → ×1.75', () => {
    const r = calcPremiumPay(
      emptySummary({ monthly60hOtNightMinutes: 120 }),
      BASE,
      baseRule(),
    );
    expect(r.monthly60hOtNightPay).toBeCloseTo(120 * 25 * 1.75, 5);
    expect(r.total).toBeCloseTo(5_250, 5);
  });
});
