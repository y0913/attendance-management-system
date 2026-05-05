import { toZonedTime } from 'date-fns-tz';
import { JST_TIMEZONE } from './constants';

export function countWeekdaysBetween(
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
    const dow = toZonedTime(cursor, JST_TIMEZONE).getDay();
    if (dow !== 0 && dow !== 6) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}
