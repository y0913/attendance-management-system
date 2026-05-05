import type { TimeClock, TimeClockType, WorkRuleVersion } from '../types';
import { jst } from './jst';

export const baseRule = (
  override: Partial<WorkRuleVersion> = {},
): WorkRuleVersion => ({
  validFrom: jst('2025-01-01 00:00'),
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

export const clock = (occurredAt: string, type: TimeClockType): TimeClock => ({
  occurredAt: jst(occurredAt),
  type,
  source: 'web',
});
