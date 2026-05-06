import type { NextRequest } from 'next/server';
import { getEffectiveMonthlySummary } from '@/lib/mock/attendance-closings';
import { currentYearMonthJst } from '@/lib/mock/attendance-summary';
import { getCompany } from '@/lib/mock/companies';
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
    '締め状態',
  ];
  const body: unknown[][] = users.map((u) => {
    const summary = getEffectiveMonthlySummary(u.id, ym);
    const manager = u.managerId ? findMockUserById(u.managerId) : null;
    return [
      u.id,
      u.name,
      u.email,
      ROLE_LABEL[u.role],
      EMPLOYMENT_LABEL[u.employmentType],
      u.baseSalary ?? '',
      summary.workedDays,
      fmtMinutes(summary.totalWorkMinutes),
      summary.missingClockOutDays,
      summary.approvedLeaveDays,
      manager?.name ?? '',
      summary.isClosed ? '締め済み' : '未締め',
    ];
  });

  const meta: unknown[][] = [
    ['会社', company.name],
    ['対象月', ym],
    [
      '締日',
      company.closingDay === 0 ? '月末' : `毎月 ${company.closingDay} 日`,
    ],
    [],
  ];
  const csv = rowsToCsv([...meta, header, ...body]);

  const filename = `payroll_${ym}.csv`;
  return csvResponse(filename, csv);
}
