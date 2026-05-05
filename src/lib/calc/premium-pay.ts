import { MINUTES_PER_HOUR } from './constants';
import type {
  MonthlySummary,
  PremiumPayBreakdown,
  WorkRuleVersion,
} from './types';

export function calcPremiumPay(
  monthlySummary: MonthlySummary,
  baseHourlyRate: number,
  rule: WorkRuleVersion,
): PremiumPayBreakdown {
  const baseRate = baseHourlyRate / MINUTES_PER_HOUR;

  const regularPay = monthlySummary.regularWorkMinutes * baseRate * 1.0;
  const regularNightPay =
    monthlySummary.regularNightMinutes * baseRate * (1.0 + rule.nightRateAddition);
  const regularOtPay = monthlySummary.regularOtMinutes * baseRate * rule.otRate;
  const regularOtNightPay =
    monthlySummary.regularOtNightMinutes *
    baseRate *
    (rule.otRate + rule.nightRateAddition);
  const monthly60hOtPay =
    monthlySummary.monthly60hOtMinutes * baseRate * rule.monthly60hOtRate;
  const monthly60hOtNightPay =
    monthlySummary.monthly60hOtNightMinutes *
    baseRate *
    (rule.monthly60hOtRate + rule.nightRateAddition);
  const legalHolidayPay =
    monthlySummary.legalHolidayWorkMinutes * baseRate * rule.legalHolidayRate;
  const legalHolidayNightPay =
    monthlySummary.legalHolidayNightMinutes *
    baseRate *
    (rule.legalHolidayRate + rule.nightRateAddition);

  const total =
    regularPay +
    regularNightPay +
    regularOtPay +
    regularOtNightPay +
    monthly60hOtPay +
    monthly60hOtNightPay +
    legalHolidayPay +
    legalHolidayNightPay;

  return {
    baseRatePerMinute: baseRate,
    regularPay,
    regularNightPay,
    regularOtPay,
    regularOtNightPay,
    monthly60hOtPay,
    monthly60hOtNightPay,
    legalHolidayPay,
    legalHolidayNightPay,
    total,
  };
}
