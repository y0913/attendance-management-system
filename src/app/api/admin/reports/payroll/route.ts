import type { NextRequest } from 'next/server';
import { getEffectiveMonthlySummariesForUsers } from '@/lib/data/attendance-closings';
import { currentYearMonthJst } from '@/lib/data/attendance-summary';
import { getCompany } from '@/lib/data/companies';
import { computeMonthlyPayrollForUsers } from '@/lib/data/payroll-bridge';
import { getMockSession } from '@/lib/data/session';
import { listActiveUsers } from '@/lib/data/users';
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

const fmtYen = (n: number): string => Math.round(n).toString();

export async function GET(request: NextRequest): Promise<Response> {
  const session = await getMockSession();
  if (!session) return new Response('Unauthorized', { status: 401 });
  if (session.role !== 'admin') {
    return new Response('Forbidden', { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const ymParam = searchParams.get('ym');
  const ym = ymParam && isValidYm(ymParam) ? ymParam : currentYearMonthJst();

  const company = await getCompany(session.companyId);
  const users = (await listActiveUsers(session.companyId)).sort((a, b) =>
    a.name.localeCompare(b.name, 'ja'),
  );
  const userById = new Map(users.map((u) => [u.id, u]));

  const header: unknown[] = [
    '社員ID',
    '氏名',
    'メール',
    'ロール',
    '雇用形態',
    '基本給',
    '時給単価',
    '勤務日数',
    '合計勤務時間',
    '退勤未打刻日数',
    '承認済有給日数',
    '承認者',
    '締め状態',
    // 詳細時間（分）
    '所定内勤務(分)',
    '深夜(分)',
    '法定外残業(分)',
    '残業×深夜(分)',
    '月60h超(分)',
    '月60h超×深夜(分)',
    '法定休日(分)',
    '法定休日×深夜(分)',
    // 賃金内訳（円）
    '所定内賃金',
    '深夜割増',
    '残業割増',
    '残業×深夜割増',
    '月60h超割増',
    '月60h超×深夜割増',
    '法定休日割増',
    '法定休日×深夜割増',
    '総額',
  ];
  const userIds = users.map((u) => u.id);
  const [baseSummaries, payrolls] = await Promise.all([
    getEffectiveMonthlySummariesForUsers(session.companyId, userIds, ym),
    computeMonthlyPayrollForUsers(session.companyId, userIds, ym),
  ]);

  const body: unknown[][] = users.map((u): unknown[] => {
    const baseSummary = baseSummaries.get(u.id)!;
    const payroll = payrolls.get(u.id)!;
    const manager = u.managerId ? userById.get(u.managerId) ?? null : null;
    const s = payroll.summary;
    const p = payroll.premium;
    return [
      u.id,
      u.name,
      u.email,
      ROLE_LABEL[u.role],
      EMPLOYMENT_LABEL[u.employmentType],
      u.baseSalary ?? '',
      Math.round(payroll.baseHourlyRate), // 円/時 概算
      baseSummary.workedDays,
      fmtMinutes(baseSummary.totalWorkMinutes),
      baseSummary.missingClockOutDays,
      baseSummary.approvedLeaveDays,
      manager?.name ?? '',
      baseSummary.isClosed ? '締め済み' : '未締め',
      // 時間
      s ? s.regularWorkMinutes : '',
      s ? s.regularNightMinutes : '',
      s ? s.regularOtMinutes : '',
      s ? s.regularOtNightMinutes : '',
      s ? s.monthly60hOtMinutes : '',
      s ? s.monthly60hOtNightMinutes : '',
      s ? s.legalHolidayWorkMinutes : '',
      s ? s.legalHolidayNightMinutes : '',
      // 賃金
      p ? fmtYen(p.regularPay) : '',
      p ? fmtYen(p.regularNightPay) : '',
      p ? fmtYen(p.regularOtPay) : '',
      p ? fmtYen(p.regularOtNightPay) : '',
      p ? fmtYen(p.monthly60hOtPay) : '',
      p ? fmtYen(p.monthly60hOtNightPay) : '',
      p ? fmtYen(p.legalHolidayPay) : '',
      p ? fmtYen(p.legalHolidayNightPay) : '',
      p ? fmtYen(p.total) : '',
    ];
  });

  const meta: unknown[][] = [
    ['会社', company.name],
    ['対象月', ym],
    [
      '締日',
      company.closingDay === 0 ? '月末' : `毎月 ${company.closingDay} 日`,
    ],
    [
      '月途中ルール変更戦略',
      company.midMonthRateChangeStrategy === 'daily' ? '日次' : '月末',
    ],
    ['月所定労働時間', `${company.monthlyStandardHours} h`],
    [
      '法定休日',
      ['日', '月', '火', '水', '木', '金', '土'][company.legalHolidayWeekday] +
        '曜日',
    ],
    [],
  ];
  const csv = rowsToCsv([...meta, header, ...body]);

  const filename = `payroll_${ym}.csv`;
  return csvResponse(filename, csv);
}
