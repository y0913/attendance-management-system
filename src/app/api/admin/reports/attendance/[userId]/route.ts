import { formatInTimeZone } from 'date-fns-tz';
import type { NextRequest } from 'next/server';
import { JST_TIMEZONE } from '@/lib/calc/constants';
import {
  currentYearMonthJst,
  summarizeMonth,
} from '@/lib/mock/attendance-summary';
import { getMockSession } from '@/lib/mock/session';
import { findMockUserById } from '@/lib/mock/users';
import { csvResponse, rowsToCsv } from '@/lib/util/csv';

const WEEKDAY = ['日', '月', '火', '水', '木', '金', '土'] as const;

const isValidYm = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

const fmtTime = (d: Date) => formatInTimeZone(d, JST_TIMEZONE, 'HH:mm');

const fmtMinutes = (n: number | null): string => {
  if (n == null) return '';
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
): Promise<Response> {
  const session = await getMockSession();
  if (!session) return new Response('Unauthorized', { status: 401 });
  if (session.role !== 'admin') {
    return new Response('Forbidden', { status: 403 });
  }

  const { userId } = await context.params;
  const target = findMockUserById(userId);
  if (!target) return new Response('Not Found', { status: 404 });

  const { searchParams } = new URL(request.url);
  const ymParam = searchParams.get('ym');
  const ym = ymParam && isValidYm(ymParam) ? ymParam : currentYearMonthJst();

  const summaries = summarizeMonth(target.id, ym);

  const header: unknown[] = [
    '日付',
    '曜日',
    '出勤',
    '退勤',
    '休憩(分)',
    '勤務時間',
  ];
  const body: unknown[][] = summaries.map((s) => [
    s.jstDateKey,
    WEEKDAY[s.weekday],
    s.clockIn ? fmtTime(s.clockIn.occurredAt) : '',
    s.clockOut ? fmtTime(s.clockOut.occurredAt) : '',
    s.breakMinutes,
    fmtMinutes(s.workMinutes),
  ]);
  const meta: unknown[][] = [
    ['対象者', target.name],
    ['メール', target.email],
    ['年月', ym],
    [],
  ];
  const csv = rowsToCsv([...meta, header, ...body]);

  const filename = `attendance_${target.id}_${ym}.csv`;
  return csvResponse(filename, csv);
}
