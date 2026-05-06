import { describe, expect, it } from 'vitest';
import {
  estimateMonthlyOvertime,
  OVERTIME_ALERT_THRESHOLD_MIN,
} from './overtime-estimate';

describe('estimateMonthlyOvertime', () => {
  it('returns zero overtime when total work equals baseline', () => {
    // 2026-04: 22 平日 × 480分 = 10560分
    const daily = Array.from({ length: 30 }, (_, i) => {
      const day = String(i + 1).padStart(2, '0');
      const date = `2026-04-${day}`;
      const d = new Date(`${date}T00:00:00+09:00`);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      return { date, workMinutes: isWeekend ? null : 480 };
    });
    const r = estimateMonthlyOvertime('2026-04', daily);
    expect(r.businessDaysInMonth).toBe(22);
    expect(r.totalWorkMinutes).toBe(22 * 480);
    expect(r.estimatedOtMinutes).toBe(0);
    expect(r.exceedsThreshold).toBe(false);
  });

  it('flags when overtime exceeds 60h', () => {
    // 22 平日 × (480 + 180) = 14520分 → 残業 3960分 > 3600
    const daily = Array.from({ length: 30 }, (_, i) => {
      const day = String(i + 1).padStart(2, '0');
      const date = `2026-04-${day}`;
      const d = new Date(`${date}T00:00:00+09:00`);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      return { date, workMinutes: isWeekend ? null : 480 + 180 };
    });
    const r = estimateMonthlyOvertime('2026-04', daily);
    expect(r.estimatedOtMinutes).toBe(22 * 180);
    expect(r.exceedsThreshold).toBe(true);
    expect(OVERTIME_ALERT_THRESHOLD_MIN).toBe(3600);
  });

  it('does not flag exactly 60h threshold (must exceed strictly)', () => {
    // 残業ぴったり 3600分 → exceedsThreshold = false (>3600 は超えてない)
    const daily = [
      { date: '2026-04-01', workMinutes: 22 * 480 + 3600 },
    ];
    const r = estimateMonthlyOvertime('2026-04', daily);
    expect(r.estimatedOtMinutes).toBe(3600);
    expect(r.exceedsThreshold).toBe(false);
  });

  it('counts only days with workMinutes != null as worked', () => {
    const daily = [
      { date: '2026-04-01', workMinutes: 480 },
      { date: '2026-04-02', workMinutes: null },
      { date: '2026-04-03', workMinutes: 0 },
    ];
    const r = estimateMonthlyOvertime('2026-04', daily);
    expect(r.workedDays).toBe(2);
  });
});
