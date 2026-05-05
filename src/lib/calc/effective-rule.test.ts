import { describe, expect, it } from 'vitest';
import { getEffectiveRule } from './effective-rule';
import type { WorkRuleVersion } from './types';
import { jst } from './_test/jst';

const baseRule = (validFrom: Date, override: Partial<WorkRuleVersion> = {}): WorkRuleVersion => ({
  validFrom,
  dailyOtThresholdMin: 480,
  weeklyOtThresholdMin: 2400,
  otRate: 1.25,
  nightStartTime: '22:00',
  nightEndTime: '05:00',
  nightRateAddition: 0.25,
  legalHolidayRate: 1.35,
  monthly60hOtRate: 1.5,
  monthly60hThresholdMin: 3600,
  complianceMode: true,
  ...override,
});

describe('getEffectiveRule', () => {
  it('単一バージョンの validFrom 以降は常にそれを返す', () => {
    const rule = baseRule(jst('2025-01-01 00:00'));
    expect(getEffectiveRule([rule], jst('2025-06-01 00:00'))).toBe(rule);
  });

  it('複数バージョンから最大の validFrom を選ぶ', () => {
    const r1 = baseRule(jst('2025-01-01 00:00'), { otRate: 1.25 });
    const r2 = baseRule(jst('2025-04-01 00:00'), { otRate: 1.3 });
    const r3 = baseRule(jst('2025-07-01 00:00'), { otRate: 1.35 });
    expect(getEffectiveRule([r1, r3, r2], jst('2025-05-15 00:00'))).toBe(r2);
  });

  it('validFrom ぴったりはそのバージョンを採用', () => {
    const r1 = baseRule(jst('2025-01-01 00:00'));
    const r2 = baseRule(jst('2025-04-01 00:00'));
    expect(getEffectiveRule([r1, r2], jst('2025-04-01 00:00'))).toBe(r2);
  });

  it('全バージョンが date より未来のときは throw', () => {
    const r1 = baseRule(jst('2025-04-01 00:00'));
    expect(() => getEffectiveRule([r1], jst('2025-01-01 00:00'))).toThrow();
  });

  it('空配列は throw', () => {
    expect(() => getEffectiveRule([], jst('2025-01-01 00:00'))).toThrow();
  });
});
