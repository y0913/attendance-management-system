import { describe, expect, it } from 'vitest';
import { calcDailyAttendance } from './daily-attendance';
import { jst } from './_test/jst';
import { baseRule, clock } from './_test/fixtures';
import type { TimeClock } from './types';

const day = jst('2025-04-01 00:00');

describe('calcDailyAttendance', () => {
  it('1. 通常 8h 勤務 (09-12, 12-13 break, 13-18)', () => {
    const tcs: TimeClock[] = [
      clock('2025-04-01 09:00', 'clock_in'),
      clock('2025-04-01 12:00', 'break_start'),
      clock('2025-04-01 13:00', 'break_end'),
      clock('2025-04-01 18:00', 'clock_out'),
    ];
    const r = calcDailyAttendance(tcs, day, baseRule(), false);
    expect(r.status).toBe('resolved');
    expect(r.workMinutes).toBe(480);
    expect(r.otMinutes).toBe(0);
    expect(r.nightMinutes).toBe(0);
    expect(r.otNightMinutes).toBe(0);
    expect(r.breakMinutes).toBe(60);
    expect(r.legalHolidayFlag).toBe(false);
  });

  it('2. 閾値ちょうど 8h (09-17, no break)', () => {
    const tcs: TimeClock[] = [
      clock('2025-04-01 09:00', 'clock_in'),
      clock('2025-04-01 17:00', 'clock_out'),
    ];
    const r = calcDailyAttendance(tcs, day, baseRule(), false);
    expect(r.workMinutes).toBe(480);
    expect(r.otMinutes).toBe(0);
  });

  it('3. 閾値+1 (09-17:01)', () => {
    const tcs: TimeClock[] = [
      clock('2025-04-01 09:00', 'clock_in'),
      clock('2025-04-01 17:01', 'clock_out'),
    ];
    const r = calcDailyAttendance(tcs, day, baseRule(), false);
    expect(r.workMinutes).toBe(481);
    expect(r.otMinutes).toBe(1);
  });

  it('4. 閾値-1 (09-16:59)', () => {
    const tcs: TimeClock[] = [
      clock('2025-04-01 09:00', 'clock_in'),
      clock('2025-04-01 16:59', 'clock_out'),
    ];
    const r = calcDailyAttendance(tcs, day, baseRule(), false);
    expect(r.workMinutes).toBe(479);
    expect(r.otMinutes).toBe(0);
  });

  it('5. 残業 2h (09-12, 13-20)', () => {
    const tcs: TimeClock[] = [
      clock('2025-04-01 09:00', 'clock_in'),
      clock('2025-04-01 12:00', 'break_start'),
      clock('2025-04-01 13:00', 'break_end'),
      clock('2025-04-01 20:00', 'clock_out'),
    ];
    const r = calcDailyAttendance(tcs, day, baseRule(), false);
    expect(r.workMinutes).toBe(600);
    expect(r.otMinutes).toBe(120);
    expect(r.nightMinutes).toBe(0);
    expect(r.otNightMinutes).toBe(0);
    expect(r.breakMinutes).toBe(60);
  });

  it('6. 深夜のみ (22-23)', () => {
    const tcs: TimeClock[] = [
      clock('2025-04-01 22:00', 'clock_in'),
      clock('2025-04-01 23:00', 'clock_out'),
    ];
    const r = calcDailyAttendance(tcs, day, baseRule(), false);
    expect(r.workMinutes).toBe(60);
    expect(r.otMinutes).toBe(0);
    expect(r.nightMinutes).toBe(60);
    expect(r.otNightMinutes).toBe(0);
  });

  it('7. 残業+深夜 (14:00-翌00:30, no break)', () => {
    const tcs: TimeClock[] = [
      clock('2025-04-01 14:00', 'clock_in'),
      clock('2025-04-02 00:30', 'clock_out'),
    ];
    const r = calcDailyAttendance(tcs, day, baseRule(), false);
    expect(r.workMinutes).toBe(630);
    expect(r.otMinutes).toBe(150);
    expect(r.nightMinutes).toBe(150);
    expect(r.otNightMinutes).toBe(150);
  });

  it('8. 法定休日 8h (09-12, 13-18, isLegalHoliday=true)', () => {
    const tcs: TimeClock[] = [
      clock('2025-04-01 09:00', 'clock_in'),
      clock('2025-04-01 12:00', 'break_start'),
      clock('2025-04-01 13:00', 'break_end'),
      clock('2025-04-01 18:00', 'clock_out'),
    ];
    const r = calcDailyAttendance(tcs, day, baseRule(), true);
    expect(r.workMinutes).toBe(480);
    expect(r.otMinutes).toBe(0);
    expect(r.nightMinutes).toBe(0);
    expect(r.otNightMinutes).toBe(0);
    expect(r.legalHolidayFlag).toBe(true);
  });

  it('9. 法定休日+深夜 (20:00-翌04:00, isLegalHoliday=true)', () => {
    const tcs: TimeClock[] = [
      clock('2025-04-01 20:00', 'clock_in'),
      clock('2025-04-02 04:00', 'clock_out'),
    ];
    const r = calcDailyAttendance(tcs, day, baseRule(), true);
    expect(r.workMinutes).toBe(480);
    expect(r.otMinutes).toBe(0);
    expect(r.nightMinutes).toBe(360);
    expect(r.otNightMinutes).toBe(0);
    expect(r.legalHolidayFlag).toBe(true);
  });

  it('10. 打刻なし (no_record)', () => {
    const r = calcDailyAttendance([], day, baseRule(), false);
    expect(r.status).toBe('no_record');
    expect(r.clockInAt).toBeNull();
    expect(r.clockOutAt).toBeNull();
    expect(r.workMinutes).toBeNull();
    expect(r.otMinutes).toBeNull();
    expect(r.nightMinutes).toBeNull();
    expect(r.otNightMinutes).toBeNull();
    expect(r.breakMinutes).toBeNull();
  });

  it('11. 退勤打刻忘れ (missing_clock_out)', () => {
    const tcs: TimeClock[] = [clock('2025-04-01 09:00', 'clock_in')];
    const r = calcDailyAttendance(tcs, day, baseRule(), false);
    expect(r.status).toBe('missing_clock_out');
    expect(r.clockInAt).toEqual(jst('2025-04-01 09:00'));
    expect(r.clockOutAt).toBeNull();
    expect(r.workMinutes).toBeNull();
  });

  it('12. 日跨ぎ勤務 (22:00-翌06:00)', () => {
    const tcs: TimeClock[] = [
      clock('2025-04-01 22:00', 'clock_in'),
      clock('2025-04-02 06:00', 'clock_out'),
    ];
    const r = calcDailyAttendance(tcs, day, baseRule(), false);
    expect(r.workMinutes).toBe(480);
    expect(r.otMinutes).toBe(0);
    expect(r.nightMinutes).toBe(420);
    expect(r.otNightMinutes).toBe(0);
  });

  it('13. 休憩 2 回 (09-12, 13-15, 15:15-18)', () => {
    const tcs: TimeClock[] = [
      clock('2025-04-01 09:00', 'clock_in'),
      clock('2025-04-01 12:00', 'break_start'),
      clock('2025-04-01 13:00', 'break_end'),
      clock('2025-04-01 15:00', 'break_start'),
      clock('2025-04-01 15:15', 'break_end'),
      clock('2025-04-01 18:00', 'clock_out'),
    ];
    const r = calcDailyAttendance(tcs, day, baseRule(), false);
    expect(r.workMinutes).toBe(465);
    expect(r.breakMinutes).toBe(75);
    expect(r.otMinutes).toBe(0);
  });

  it('14. 休憩中の深夜 (21:30-22 work, 22-23 break, 23-23:30 work)', () => {
    const tcs: TimeClock[] = [
      clock('2025-04-01 21:30', 'clock_in'),
      clock('2025-04-01 22:00', 'break_start'),
      clock('2025-04-01 23:00', 'break_end'),
      clock('2025-04-01 23:30', 'clock_out'),
    ];
    const r = calcDailyAttendance(tcs, day, baseRule(), false);
    expect(r.workMinutes).toBe(60);
    expect(r.breakMinutes).toBe(60);
    expect(r.nightMinutes).toBe(30);
    expect(r.otMinutes).toBe(0);
    expect(r.otNightMinutes).toBe(0);
  });

  it('15. compliance_mode OFF + dailyOtThreshold=0 → 全部 ot', () => {
    const tcs: TimeClock[] = [
      clock('2025-04-01 09:00', 'clock_in'),
      clock('2025-04-01 17:00', 'clock_out'),
    ];
    const r = calcDailyAttendance(
      tcs,
      day,
      baseRule({ dailyOtThresholdMin: 0, complianceMode: false }),
      false,
    );
    expect(r.workMinutes).toBe(480);
    expect(r.otMinutes).toBe(480);
    expect(r.otNightMinutes).toBe(0);
  });

  it('16. break_end のみ (不整合) は無視', () => {
    const tcs: TimeClock[] = [
      clock('2025-04-01 09:00', 'clock_in'),
      clock('2025-04-01 13:00', 'break_end'),
      clock('2025-04-01 18:00', 'clock_out'),
    ];
    const r = calcDailyAttendance(tcs, day, baseRule(), false);
    expect(r.workMinutes).toBe(540);
    expect(r.breakMinutes).toBe(0);
    expect(r.otMinutes).toBe(60);
  });

  it('17. 残業中に深夜重複 (17:00-翌02:00) → ot=60, otNight=60', () => {
    const tcs: TimeClock[] = [
      clock('2025-04-01 17:00', 'clock_in'),
      clock('2025-04-02 02:00', 'clock_out'),
    ];
    const r = calcDailyAttendance(tcs, day, baseRule(), false);
    expect(r.workMinutes).toBe(540);
    expect(r.otMinutes).toBe(60);
    expect(r.nightMinutes).toBe(240);
    expect(r.otNightMinutes).toBe(60);
  });

  it('18. ot 期間と night 期間が非重複 (03:00-14:00) → night=120, otNight=0', () => {
    const tcs: TimeClock[] = [
      clock('2025-04-01 03:00', 'clock_in'),
      clock('2025-04-01 14:00', 'clock_out'),
    ];
    const r = calcDailyAttendance(tcs, day, baseRule(), false);
    expect(r.workMinutes).toBe(660);
    expect(r.otMinutes).toBe(180);
    expect(r.nightMinutes).toBe(120);
    expect(r.otNightMinutes).toBe(0);
  });
});
