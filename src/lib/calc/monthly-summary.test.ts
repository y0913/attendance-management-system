import { describe, expect, it } from 'vitest';
import { calcMonthlySummary } from './monthly-summary';
import { jst } from './_test/jst';
import { baseRule } from './_test/fixtures';
import type { DailyAttendance, DailyAttendanceStatus } from './types';

const day = (
  ymd: string,
  override: Partial<Omit<DailyAttendance, 'workDate'>> = {},
): DailyAttendance => ({
  workDate: jst(`${ymd} 00:00`),
  status: 'resolved' as DailyAttendanceStatus,
  clockInAt: jst(`${ymd} 09:00`),
  clockOutAt: jst(`${ymd} 18:00`),
  breakMinutes: 0,
  workMinutes: 480,
  otMinutes: 0,
  nightMinutes: 0,
  otNightMinutes: 0,
  legalHolidayFlag: false,
  ...override,
});

const rule = baseRule({ validFrom: jst('2025-01-01 00:00') });

describe('calcMonthlySummary', () => {
  it('1. 通常 22 営業日 8h、残業なし', () => {
    const days = Array.from({ length: 22 }, (_, i) =>
      day(`2025-04-${String(i + 1).padStart(2, '0')}`),
    );
    const r = calcMonthlySummary(days, '2025-04', [rule], 'month_end');
    expect(r.regularWorkMinutes).toBe(10560);
    expect(r.regularOtMinutes).toBe(0);
    expect(r.monthly60hOtMinutes).toBe(0);
    expect(r.exceptionDaysCount).toBe(0);
  });

  it('2. 月60h ぴったり (15日 × 12h、ot=240/日)', () => {
    const days = Array.from({ length: 15 }, (_, i) =>
      day(`2025-04-${String(i + 1).padStart(2, '0')}`, {
        workMinutes: 720,
        otMinutes: 240,
      }),
    );
    const r = calcMonthlySummary(days, '2025-04', [rule], 'month_end');
    expect(r.regularOtMinutes).toBe(3600);
    expect(r.monthly60hOtMinutes).toBe(0);
  });

  it('3. 月60h +1分', () => {
    const baseDays = Array.from({ length: 15 }, (_, i) =>
      day(`2025-04-${String(i + 1).padStart(2, '0')}`, {
        workMinutes: 720,
        otMinutes: 240,
      }),
    );
    const extra = day('2025-04-16', { workMinutes: 481, otMinutes: 1 });
    const r = calcMonthlySummary(
      [...baseDays, extra],
      '2025-04',
      [rule],
      'month_end',
    );
    expect(r.regularOtMinutes).toBe(3600);
    expect(r.monthly60hOtMinutes).toBe(1);
  });

  it('4. 月60h −1分', () => {
    const baseDays = Array.from({ length: 14 }, (_, i) =>
      day(`2025-04-${String(i + 1).padStart(2, '0')}`, {
        workMinutes: 720,
        otMinutes: 240,
      }),
    );
    const last = day('2025-04-15', { workMinutes: 719, otMinutes: 239 });
    const r = calcMonthlySummary(
      [...baseDays, last],
      '2025-04',
      [rule],
      'month_end',
    );
    expect(r.regularOtMinutes).toBe(3599);
    expect(r.monthly60hOtMinutes).toBe(0);
  });

  it('5. 60h跨ぎ 1日内分割 (累計3590に+30の残業)', () => {
    const baseDays = Array.from({ length: 14 }, (_, i) =>
      day(`2025-04-${String(i + 1).padStart(2, '0')}`, {
        workMinutes: 720,
        otMinutes: 240,
      }),
    );
    // 14日後の累計 = 14 × 240 = 3360
    // ot=230 を 1日入れて累計 3590
    const day15 = day('2025-04-15', { workMinutes: 710, otMinutes: 230 });
    // ot=30 を入れて累計 3620（10分 under、20分 over）
    const day16 = day('2025-04-16', { workMinutes: 510, otMinutes: 30 });
    const r = calcMonthlySummary(
      [...baseDays, day15, day16],
      '2025-04',
      [rule],
      'month_end',
    );
    expect(r.regularOtMinutes).toBe(3600);
    expect(r.monthly60hOtMinutes).toBe(20);
  });

  it('6. 60h跨ぎ + その日の night 30分按分 (ot=30 全部 night)', () => {
    const baseDays = Array.from({ length: 14 }, (_, i) =>
      day(`2025-04-${String(i + 1).padStart(2, '0')}`, {
        workMinutes: 720,
        otMinutes: 240,
      }),
    );
    const day15 = day('2025-04-15', { workMinutes: 710, otMinutes: 230 });
    // 当日 ot=30, otNight=30 → underOt=10/30 が night → underOtNight=10
    const day16 = day('2025-04-16', {
      workMinutes: 510,
      otMinutes: 30,
      nightMinutes: 30,
      otNightMinutes: 30,
    });
    const r = calcMonthlySummary(
      [...baseDays, day15, day16],
      '2025-04',
      [rule],
      'month_end',
    );
    expect(r.regularOtMinutes).toBe(3590);
    expect(r.regularOtNightMinutes).toBe(10);
    expect(r.monthly60hOtMinutes).toBe(0);
    expect(r.monthly60hOtNightMinutes).toBe(20);
  });

  it("7. strategy='daily' 月途中で 60h閾値変更 (3600→3000)", () => {
    const ruleA = baseRule({
      validFrom: jst('2025-04-01 00:00'),
      monthly60hThresholdMin: 3600,
    });
    const ruleB = baseRule({
      validFrom: jst('2025-04-15 00:00'),
      monthly60hThresholdMin: 3000,
    });
    // 4/1-4/14 の 14日: ot=200/日 → 累計 2800（rule A の 3600 未満、全 under）
    // 4/15: ot=300、prevCum=2800、cumOt=3100。rule B (3000) で判定
    //   prevCum < 3000、cumOt > 3000 → under=200, over=100
    // 4/16: ot=300、prevCum=3100。rule B 3000 → all over（300）
    const days = [
      ...Array.from({ length: 14 }, (_, i) =>
        day(`2025-04-${String(i + 1).padStart(2, '0')}`, {
          workMinutes: 680,
          otMinutes: 200,
        }),
      ),
      day('2025-04-15', { workMinutes: 780, otMinutes: 300 }),
      day('2025-04-16', { workMinutes: 780, otMinutes: 300 }),
    ];
    const r = calcMonthlySummary(days, '2025-04', [ruleA, ruleB], 'daily');
    // regular = 2800 + 200 = 3000
    // monthly60h = 100 + 300 = 400
    expect(r.regularOtMinutes).toBe(3000);
    expect(r.monthly60hOtMinutes).toBe(400);
  });

  it("8. strategy='month_end' 月途中で閾値変更 → 月末rule(3000)で全月計算", () => {
    const ruleA = baseRule({
      validFrom: jst('2025-04-01 00:00'),
      monthly60hThresholdMin: 3600,
    });
    const ruleB = baseRule({
      validFrom: jst('2025-04-15 00:00'),
      monthly60hThresholdMin: 3000,
    });
    // 月末rule = ruleB (3000)
    const days = [
      ...Array.from({ length: 14 }, (_, i) =>
        day(`2025-04-${String(i + 1).padStart(2, '0')}`, {
          workMinutes: 680,
          otMinutes: 200,
        }),
      ),
      day('2025-04-15', { workMinutes: 780, otMinutes: 300 }),
      day('2025-04-16', { workMinutes: 780, otMinutes: 300 }),
    ];
    const r = calcMonthlySummary(days, '2025-04', [ruleA, ruleB], 'month_end');
    // 4/1-4/14 累計: 14×200=2800 (under 3000)
    // 4/15 ot=300: prevCum=2800, cumOt=3100, th=3000 → under=200, over=100
    // 4/16 ot=300: prevCum=3100, th=3000 → all over=300
    // regular = 2800 + 200 = 3000
    // 60h = 100 + 300 = 400
    expect(r.regularOtMinutes).toBe(3000);
    expect(r.monthly60hOtMinutes).toBe(400);
  });

  it('9. 法定休日 8h × 1日 + 通常 21日', () => {
    const normal = Array.from({ length: 21 }, (_, i) =>
      day(`2025-04-${String(i + 1).padStart(2, '0')}`),
    );
    const holiday = day('2025-04-22', {
      legalHolidayFlag: true,
      workMinutes: 480,
      nightMinutes: 0,
    });
    const r = calcMonthlySummary(
      [...normal, holiday],
      '2025-04',
      [rule],
      'month_end',
    );
    expect(r.regularWorkMinutes).toBe(10080);
    expect(r.legalHolidayWorkMinutes).toBe(480);
    expect(r.legalHolidayNightMinutes).toBe(0);
    expect(r.regularOtMinutes).toBe(0);
  });

  it('10. 異常日 1 + 通常 21', () => {
    const normal = Array.from({ length: 21 }, (_, i) =>
      day(`2025-04-${String(i + 1).padStart(2, '0')}`),
    );
    const broken: DailyAttendance = {
      workDate: jst('2025-04-22 00:00'),
      status: 'missing_clock_out',
      clockInAt: jst('2025-04-22 09:00'),
      clockOutAt: null,
      breakMinutes: null,
      workMinutes: null,
      otMinutes: null,
      nightMinutes: null,
      otNightMinutes: null,
      legalHolidayFlag: false,
    };
    const r = calcMonthlySummary(
      [...normal, broken],
      '2025-04',
      [rule],
      'month_end',
    );
    expect(r.regularWorkMinutes).toBe(10080);
    expect(r.exceptionDaysCount).toBe(1);
  });
});
