import { formatInTimeZone } from 'date-fns-tz';
import type { NextRequest } from 'next/server';
import { JST_TIMEZONE } from '@/lib/calc/constants';
import {
  currentYearMonthJst,
  summarizeMonth,
  totalWorkMinutes,
} from '@/lib/mock/attendance-summary';
import { getCompany } from '@/lib/mock/companies';
import { listLeaveRequests } from '@/lib/mock/leave-requests';
import { getMockSession } from '@/lib/mock/session';
import { findMockUserById, listActiveUsers } from '@/lib/mock/users';
import { csvResponse, rowsToCsv } from '@/lib/util/csv';

const ROLE_LABEL: Record<string, string> = {
  admin: '管理者',
  approver: '承認者',
  general: '一般',
};

const EMPLOYMENT_LABEL: Record<string, string> = {
  monthly: '月給',
  hourly: '時給',
};

const isValidYm = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

const fmtMinutes = (n: number): string => {
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
};

const overlapsMonth = (
  startDate: string,
  endDate: string,
  yearMonth: string,
): boolean => {
  const ymStart = `${yearMonth}-01`;
  const lastDay = new Date(`${yearMonth}-01T00:00:00+09:00`);
  lastDay.setUTCMonth(lastDay.getUTCMonth() + 1);
  lastDay.setUTCDate(0);
  const ymEnd = formatInTimeZone(lastDay, JST_TIMEZONE, 'yyyy-MM-dd');
  return !(endDate < ymStart || startDate > ymEnd);
};

export async function GET(request: NextRequest): Promise<Response> {
  const session = await getMockSession();
  if (!session) return new Response('Unauthorized', { status: 401 });
  if (session.role !== 'admin') {
    return new Response('Forbidden', { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const ymParam = searchParams.get('ym');
  const ym = ymParam && isValidYm(ymParam) ? ymParam : currentYearMonthJst();

  const company = getCompany();
  const users = listActiveUsers().sort((a, b) =>
    a.name.localeCompare(b.name, 'ja'),
  );

  const header: unknown[] = [
    '社員ID',
    '氏名',
    'メール',
    'ロール',
    '雇用形態',
    '基本給',
    '勤務日数',
    '合計勤務時間',
    '退勤未打刻日数',
    '承認済有給日数',
    '承認者',
  ];
  const body: unknown[][] = users.map((u) => {
    const summaries = summarizeMonth(u.id, ym);
    const workedDays = summaries.filter((s) => s.workMinutes != null).length;
    const total = totalWorkMinutes(summaries);
    const missing = summaries.filter((s) => s.clockIn && !s.clockOut).length;
    const approvedLeaves = listLeaveRequests(u.id)
      .filter(
        (r) =>
          r.status === 'approved' && overlapsMonth(r.startDate, r.endDate, ym),
      )
      .reduce((sum, r) => sum + r.days, 0);
    const manager = u.managerId ? findMockUserById(u.managerId) : null;
    return [
      u.id,
      u.name,
      u.email,
      ROLE_LABEL[u.role],
      EMPLOYMENT_LABEL[u.employmentType],
      u.baseSalary ?? '',
      workedDays,
      fmtMinutes(total),
      missing,
      approvedLeaves,
      manager?.name ?? '',
    ];
  });

  const meta: unknown[][] = [
    ['会社', company.name],
    ['対象月', ym],
    [
      '締日',
      company.closingDay === 0
        ? '月末'
        : `毎月 ${company.closingDay} 日`,
    ],
    [],
  ];
  const csv = rowsToCsv([...meta, header, ...body]);

  const filename = `payroll_${ym}.csv`;
  return csvResponse(filename, csv);
}
