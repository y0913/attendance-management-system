import { fromZonedTime } from 'date-fns-tz';
import { JST_TIMEZONE } from '../constants';

export const jst = (s: string): Date => fromZonedTime(s, JST_TIMEZONE);
