// 日本の祝日カレンダー
// `@holiday-jp/holiday_jp` (v2.5.1) を使用。1970 年〜2050 年程度の長期データを内蔵。
// 振替休日と国民の休日も含む。
//
// 旧実装（2024-2027 のハードコード）は削除済み。`isYearSupported` は互換維持のため
// 残しているが、ライブラリの内蔵データは広範囲なので常に true を返す。

import holiday_jp from '@holiday-jp/holiday_jp';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { JST_TIMEZONE } from './constants';

const isWeekendJst = (jstDate: string): boolean => {
  const d = new Date(`${jstDate}T00:00:00+09:00`);
  const dow = toZonedTime(d, JST_TIMEZONE).getDay();
  return dow === 0 || dow === 6;
};

export function isHoliday(jstDate: string): boolean {
  // ライブラリは Date を受け取り JST 解釈する。yyyy-MM-dd 文字列を JST 0:00 の Date に変換。
  const d = new Date(`${jstDate}T00:00:00+09:00`);
  return holiday_jp.isHoliday(d);
}

export function isBusinessDay(jstDate: string): boolean {
  return !isWeekendJst(jstDate) && !isHoliday(jstDate);
}

export function isYearSupported(_year: number): boolean {
  // ライブラリ内蔵データが広範囲のため常に true。
  // 互換性維持のため関数自体は残す。
  return true;
}

export const HOLIDAY_DATA_LATEST_YEAR = 2050;

interface HolidayInfo {
  date: string; // yyyy-MM-dd (JST)
  name: string;
}

/**
 * 期間内の祝日一覧を返す。表示用。
 */
export function listHolidaysBetween(
  startJstDate: string,
  endJstDate: string,
): HolidayInfo[] {
  const start = new Date(`${startJstDate}T00:00:00+09:00`);
  const end = new Date(`${endJstDate}T23:59:59+09:00`);
  return holiday_jp.between(start, end).map((h) => ({
    date: formatInTimeZone(h.date, JST_TIMEZONE, 'yyyy-MM-dd'),
    name: h.name,
  }));
}
