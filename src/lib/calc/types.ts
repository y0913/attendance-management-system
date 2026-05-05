export type TimeClockType =
  | 'clock_in'
  | 'clock_out'
  | 'break_start'
  | 'break_end';

export type TimeClockSource = 'web' | 'manual_correction';

export interface TimeClock {
  occurredAt: Date;
  type: TimeClockType;
  source: TimeClockSource;
}

export interface WorkRuleVersion {
  validFrom: Date;
  dailyOtThresholdMin: number;
  weeklyOtThresholdMin: number;
  otRate: number;
  nightStartTime: string;
  nightEndTime: string;
  nightRateAddition: number;
  legalHolidayRate: number;
  monthly60hOtRate: number;
  monthly60hThresholdMin: number;
  complianceMode: boolean;
}

export type DailyAttendanceStatus =
  | 'resolved'
  | 'missing_clock_out'
  | 'missing_clock_in'
  | 'no_record';

export interface DailyAttendance {
  workDate: Date;
  status: DailyAttendanceStatus;
  clockInAt: Date | null;
  clockOutAt: Date | null;
  breakMinutes: number | null;
  workMinutes: number | null;
  otMinutes: number | null;
  nightMinutes: number | null;
  otNightMinutes: number | null;
  legalHolidayFlag: boolean;
}

export type MidMonthRateChangeStrategy = 'daily' | 'month_end';

export interface MonthlySummary {
  yearMonth: string;
  regularWorkMinutes: number;
  regularNightMinutes: number;
  regularOtMinutes: number;
  regularOtNightMinutes: number;
  monthly60hOtMinutes: number;
  monthly60hOtNightMinutes: number;
  legalHolidayWorkMinutes: number;
  legalHolidayNightMinutes: number;
  exceptionDaysCount: number;
}

export interface PremiumPayBreakdown {
  baseRatePerMinute: number;
  regularPay: number;
  regularNightPay: number;
  regularOtPay: number;
  regularOtNightPay: number;
  monthly60hOtPay: number;
  monthly60hOtNightPay: number;
  legalHolidayPay: number;
  legalHolidayNightPay: number;
  total: number;
}
