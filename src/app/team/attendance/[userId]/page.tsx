import { formatInTimeZone } from 'date-fns-tz';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { JST_TIMEZONE } from '@/lib/calc/constants';
import { AppHeader } from '@/components/app-header';
import { getEffectiveMonthlySummary } from '@/lib/mock/attendance-closings';
import {
  currentYearMonthJst,
  shiftYearMonth,
} from '@/lib/mock/attendance-summary';
import { getDailyNotesMap } from '@/lib/mock/daily-notes';
import { countPendingForApprover } from '@/lib/mock/pending-approvals';
import { getMockSession } from '@/lib/mock/session';
import { findMockUserById, isManagerOf } from '@/lib/mock/users';

const WEEKDAY_LABEL = ['日', '月', '火', '水', '木', '金', '土'] as const;

const isValidYm = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

const weekdayOf = (jstDate: string): number => {
  const d = new Date(`${jstDate}T00:00:00+09:00`);
  return Number(formatInTimeZone(d, JST_TIMEZONE, 'i')) % 7; // 1=Mon..7=Sun → 1..0
};

const fmtMinutes = (min: number | null): string => {
  if (min == null) return '-';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
};

const fmtMonthTitle = (ym: string) => {
  const [y, m] = ym.split('-');
  return `${y}年${Number(m)}月`;
};

const fmtDateTime = (d: Date) =>
  formatInTimeZone(d, JST_TIMEZONE, 'yyyy-MM-dd HH:mm');

const dayClass = (weekday: number): string => {
  if (weekday === 0) return 'text-rose-600';
  if (weekday === 6) return 'text-sky-600';
  return '';
};

export default async function TeamAttendanceUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ ym?: string }>;
}) {
  const session = await getMockSession();
  if (!session) redirect('/login');
  if (session.role !== 'approver' && session.role !== 'admin') {
    redirect('/clock');
  }

  const { userId } = await params;
  const target = await findMockUserById(userId);
  if (!target) notFound();

  if (session.role !== 'admin' && !(await isManagerOf(session.id, userId))) {
    redirect('/team/attendance');
  }

  const sp = await searchParams;
  const ym = sp.ym && isValidYm(sp.ym) ? sp.ym : currentYearMonthJst();

  const summary = await getEffectiveMonthlySummary(target.id, ym);
  const notesMap = await getDailyNotesMap(
    target.id,
    summary.daily.map((d) => d.date),
  );
  const closedBy = summary.closedById
    ? await findMockUserById(summary.closedById)
    : null;
  const pendingCount = await countPendingForApprover(session.id);

  const prevYm = shiftYearMonth(ym, -1);
  const nextYm = shiftYearMonth(ym, 1);

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader
        user={session}
        active="team-attendance"
        pendingApprovalCount={pendingCount}
      />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <Link
              href="/team/attendance"
              className="text-xs text-muted-foreground hover:underline"
            >
              ← 部下の勤怠一覧へ
            </Link>
            <h1 className="mt-1 text-xl font-semibold">{target.name} の勤怠</h1>
            <p className="text-xs text-muted-foreground">{target.email}</p>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">
                  {fmtMonthTitle(ym)} の勤怠
                </CardTitle>
                {summary.isClosed && (
                  <span
                    className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-900"
                    title={
                      summary.closedAt
                        ? `${closedBy?.name ?? '-'} ・ ${fmtDateTime(summary.closedAt)}`
                        : ''
                    }
                  >
                    締め済み
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                勤務日数 {summary.workedDays} 日 ・ 合計勤務時間{' '}
                {fmtMinutes(summary.totalWorkMinutes)}
                {summary.isClosed && summary.closedAt && (
                  <span className="ml-2 text-xs">
                    （{fmtDateTime(summary.closedAt)} に snapshot 凍結）
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/team/attendance/${target.id}?ym=${prevYm}`}>
                  ← 前月
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link
                  href={`/team/attendance/${target.id}?ym=${currentYearMonthJst()}`}
                >
                  今月
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/team/attendance/${target.id}?ym=${nextYm}`}>
                  次月 →
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">日付</th>
                    <th className="px-3 py-2 font-medium">曜日</th>
                    <th className="px-3 py-2 font-medium">出勤</th>
                    <th className="px-3 py-2 font-medium">退勤</th>
                    <th className="px-3 py-2 font-medium">休憩</th>
                    <th className="px-3 py-2 font-medium">勤務時間</th>
                    <th className="px-3 py-2 font-medium">業務内容</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.daily.map((d) => {
                    const empty = !d.clockIn && !d.clockOut;
                    const note = notesMap.get(d.date);
                    const wd = weekdayOf(d.date);
                    return (
                      <tr
                        key={d.date}
                        className={`border-b last:border-b-0 ${
                          empty ? 'text-muted-foreground' : ''
                        }`}
                      >
                        <td className="px-3 py-2 font-mono">
                          <Link
                            href={`/team/attendance/${target.id}/${d.date}?ym=${ym}`}
                            className="text-primary underline-offset-4 hover:underline"
                          >
                            {d.date}
                          </Link>
                        </td>
                        <td className={`px-3 py-2 ${dayClass(wd)}`}>
                          {WEEKDAY_LABEL[wd]}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {d.clockIn ?? '-'}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {d.clockOut ?? '-'}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {d.breakMinutes > 0
                            ? fmtMinutes(d.breakMinutes)
                            : '-'}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {fmtMinutes(d.workMinutes)}
                        </td>
                        <td
                          className="max-w-[260px] truncate px-3 py-2"
                          title={note ?? ''}
                        >
                          {note ? (
                            note
                          ) : (
                            <span className="text-muted-foreground">未入力</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-muted/60 font-medium">
                  <tr className="border-t-2">
                    <td className="px-3 py-3" colSpan={2}>
                      合計
                      {summary.missingClockOutDays > 0 && (
                        <span className="ml-2 text-xs font-normal text-rose-600">
                          （退勤打刻なし {summary.missingClockOutDays} 日）
                        </span>
                      )}
                    </td>
                    <td
                      className="px-3 py-3 text-sm text-muted-foreground"
                      colSpan={2}
                    >
                      勤務 {summary.workedDays} 日
                    </td>
                    <td className="px-3 py-3 font-mono">
                      {fmtMinutes(summary.totalBreakMinutes)}
                    </td>
                    <td className="px-3 py-3 font-mono text-base">
                      {fmtMinutes(summary.totalWorkMinutes)}
                    </td>
                    <td className="px-3 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
