import { toZonedTime } from 'date-fns-tz';
import { describe, expect, it } from 'vitest';
import { JST_TIMEZONE } from './constants';
import {
  estimateMonthlyOvertime,
  OVERTIME_ALERT_THRESHOLD_MIN,
} from './overtime-estimate';

// system TZ に依存しない JST 曜日判定。Date.getDay() は local TZ で評価されるので、
// CI (UTC) のような非 JST 環境では結果がずれる。
const isJstWeekend = (jstDate: string): boolean => {
  const d = new Date(`${jstDate}T00:00:00+09:00`);
  const dow = toZonedTime(d, JST_TIMEZONE).getDay();
  return dow === 0 || dow === 6;
};

describe('estimateMonthlyOvertime', () => {
  it('returns zero overtime when total work equals baseline (2026-06: no holidays)', () => {
    // 2026-06: 30日。土日 8日 → 平日 22日。祝日なし → 営業日 22日 × 480 = 10560分
    const daily = Array.from({ length: 30 }, (_, i) => {
      const day = String(i + 1).padStart(2, '0');
      const date = `2026-06-${day}`;
      return { date, workMinutes: isJstWeekend(date) ? null : 480 };
    });
    const r = estimateMonthlyOvertime('2026-06', daily);
    expect(r.businessDaysInMonth).toBe(22);
    expect(r.totalWorkMinutes).toBe(22 * 480);
    expect(r.estimatedOtMinutes).toBe(0);
    expect(r.exceedsThreshold).toBe(false);
  });

  it('flags when overtime exceeds 60h (2026-06: no holidays)', () => {
    // 22 平日 × (480 + 180) = 14520分 → 残業 3960分 > 3600
    const daily = Array.from({ length: 30 }, (_, i) => {
      const day = String(i + 1).padStart(2, '0');
      const date = `2026-06-${day}`;
      return { date, workMinutes: isJstWeekend(date) ? null : 480 + 180 };
    });
    const r = estimateMonthlyOvertime('2026-06', daily);
    expect(r.estimatedOtMinutes).toBe(22 * 180);
    expect(r.exceedsThreshold).toBe(true);
    expect(OVERTIME_ALERT_THRESHOLD_MIN).toBe(3600);
  });

  it('does not flag exactly 60h threshold (must exceed strictly)', () => {
    // baseline = 22*480 = 10560、加算 3600 → total 14160 → OT 3600
    // 2026-06 で祝日なし、22 営業日
    const daily = [
      { date: '2026-06-01', workMinutes: 22 * 480 + 3600 },
    ];
    const r = estimateMonthlyOvertime('2026-06', daily);
    expect(r.businessDaysInMonth).toBe(22);
    expect(r.estimatedOtMinutes).toBe(3600);
    expect(r.exceedsThreshold).toBe(false);
  });

  it('counts only days with workMinutes != null as worked', () => {
    const daily = [
      { date: '2026-06-01', workMinutes: 480 },
      { date: '2026-06-02', workMinutes: null },
      { date: '2026-06-03', workMinutes: 0 },
    ];
    const r = estimateMonthlyOvertime('2026-06', daily);
    expect(r.workedDays).toBe(2);
  });

  it('excludes holidays from businessDaysInMonth (2026-04 has 4/29 昭和の日)', () => {
    // 2026-04: 平日22日 - 4/29(水)昭和の日 = 営業日 21日
    const r = estimateMonthlyOvertime('2026-04', []);
    expect(r.businessDaysInMonth).toBe(21);
  });

  it('GW with multiple holidays reduces businessDaysInMonth (2026-05)', () => {
    // 2026-05: 31日。土日 10日(2,3,9,10,16,17,23,24,30,31)。
    //   ※ 5/3(日) は日曜だが祝日でもある (重複でカウント減らない)。
    // 平日21日(31-10)。祝日(平日のみ): 5/4(月みどり)・5/5(火こども)・5/6(水振替) = 3日
    // 営業日 = 21 - 3 = 18
    const r = estimateMonthlyOvertime('2026-05', []);
    expect(r.businessDaysInMonth).toBe(18);
  });
});
