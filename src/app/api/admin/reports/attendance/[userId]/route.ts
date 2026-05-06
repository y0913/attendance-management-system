import { formatInTimeZone } from 'date-fns-tz';
import type { NextRequest } from 'next/server';
import { JST_TIMEZONE } from '@/lib/calc/constants';
import { getEffectiveMonthlySummary } from '@/lib/mock/attendance-closings';
import { currentYearMonthJst } from '@/lib/mock/attendance-summary';
import { getMockSession } from '@/lib/mock/session';
import { findMockUserById } from '@/lib/mock/users';
import { csvResponse, rowsToCsv } from '@/lib/util/csv';

const WEEKDAY = ['日', '月', '火', '水', '木', '金', '土'] as const;

const isValidYm = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

const fmtMinutes = (n: number | null): string => {
  if (n == null) return '';
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
};

const fmtDateTime = (d: Date) =>
  formatInTimeZone(d, JST_TIMEZONE, 'yyyy-MM-dd HH:mm');

const weekdayOf = (jstDate: string): number => {
  const d = new Date(`${jstDate}T00:00:00+09:00`);
  return Number(formatInTimeZone(d, JST_TIMEZONE, 'i')) % 7;
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
  const target = await findMockUserById(userId);
  if (!target) return new Response('Not Found', { status: 404 });

  const { searchParams } = new URL(request.url);
  const ymParam = searchParams.get('ym');
  const ym = ymParam && isValidYm(ymParam) ? ymParam : currentYearMonthJst();

  const summary = getEffectiveMonthlySummary(target.id, ym);

  const header: unknown[] = [
    '日付',
    '曜日',
    '出勤',
    '退勤',
    '休憩(分)',
    '勤務時間',
  ];
  const body: unknown[][] = summary.daily.map((d) => [
    d.date,
    WEEKDAY[weekdayOf(d.date)],
    d.clockIn ?? '',
    d.clockOut ?? '',
    d.breakMinutes,
    fmtMinutes(d.workMinutes),
  ]);
  const meta: unknown[][] = [
    ['対象者', target.name],
    ['メール', target.email],
    ['年月', ym],
    ['締め状態', summary.isClosed ? '締め済み' : '未締め'],
    ...(summary.isClosed && summary.closedAt
      ? [['締め日時', fmtDateTime(summary.closedAt)]]
      : []),
    [],
  ];
  const csv = rowsToCsv([...meta, header, ...body]);

  const filename = `attendance_${target.id}_${ym}.csv`;
  return csvResponse(filename, csv);
}
