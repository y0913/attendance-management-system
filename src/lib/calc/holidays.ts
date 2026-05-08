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
  // 注意: `holiday_jp.isHoliday(Date)` は date.getMonth() 等 system TZ ベースで
  // 日付を抽出するため、非 JST 環境では誤判定する。文字列を渡せば内部で
  // そのままキー一致で判定するので TZ 非依存。
  return holiday_jp.isHoliday(jstDate);
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
  // holiday_jp.between(Date, Date) も内部で getFullYear() 等を呼ぶので、
  // system local 解釈で「年/月/日」が startJst/endJst と一致するように Date を組む。
  // new Date(y, m-1, d) は local TZ の年月日コンストラクタなので任意の system TZ で安全。
  const start = jstYmdToLocalDate(startJstDate);
  const end = jstYmdToLocalDate(endJstDate);
  return holiday_jp.between(start, end).map((h) => ({
    date: formatInTimeZone(h.date, JST_TIMEZONE, 'yyyy-MM-dd'),
    name: h.name,
  }));
}

const jstYmdToLocalDate = (jstDate: string): Date => {
  const m = jstDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error(`Invalid jstDate: ${jstDate}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};
