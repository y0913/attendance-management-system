import { formatInTimeZone } from 'date-fns-tz';
import { JST_TIMEZONE } from './constants';
import { isBusinessDay } from './holidays';

/**
 * 期間 [startDate, endDate]（両端含む）の中で、土日と祝日を除いた営業日数を返す。
 * 旧名称 countWeekdaysBetween との互換のため、有給消化日数の計算で使用される。
 */
export function countBusinessDaysBetween(
  startDate: string,
  endDate: string,
): number {
  const start = new Date(`${startDate}T00:00:00+09:00`);
  const end = new Date(`${endDate}T00:00:00+09:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  if (end.getTime() < start.getTime()) return 0;
  let count = 0;
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const jstDate = formatInTimeZone(cursor, JST_TIMEZONE, 'yyyy-MM-dd');
    if (isBusinessDay(jstDate)) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

/**
 * @deprecated 旧名称。countBusinessDaysBetween を使用してください。
 * 祝日も除外する仕様に変更されました。
 */
export const countWeekdaysBetween = countBusinessDaysBetween;
