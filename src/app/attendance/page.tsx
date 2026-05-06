import { formatInTimeZone } from 'date-fns-tz';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { JST_TIMEZONE } from '@/lib/calc/constants';
import { AppHeader } from '@/components/app-header';
import { countPendingForApprover } from '@/lib/mock/pending-approvals';
import { getMockSession } from '@/lib/mock/session';
import {
  currentYearMonthJst,
  shiftYearMonth,
  summarizeMonth,
  totalWorkMinutes,
  type DailySummary,
} from '@/lib/mock/attendance-summary';
import { getDailyNotesMap } from '@/lib/mock/daily-notes';

const WEEKDAY_LABEL = ['日', '月', '火', '水', '木', '金', '土'] as const;

const isValidYm = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

const fmtTime = (d: Date) => formatInTimeZone(d, JST_TIMEZONE, 'HH:mm');
const fmtMonthTitle = (ym: string) => {
  const [y, m] = ym.split('-');
  return `${y}年${Number(m)}月`;
};

const fmtMinutes = (min: number | null): string => {
  if (min == null) return '-';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
};

const dayClass = (s: DailySummary): string => {
  if (s.weekday === 0) return 'text-rose-600';
  if (s.weekday === 6) return 'text-sky-600';
  return '';
};

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  const session = await getMockSession();
  if (!session) redirect('/login');

  const params = await searchParams;
  const ym =
    params.ym && isValidYm(params.ym) ? params.ym : currentYearMonthJst();

  const summaries = await summarizeMonth(session.id, ym);
  const notesMap = await getDailyNotesMap(
    session.id,
    summaries.map((s) => s.jstDateKey),
  );
  const totalMin = totalWorkMinutes(summaries);
  const totalBreakMin = summaries.reduce((sum, s) => sum + s.breakMinutes, 0);
  const workedDays = summaries.filter((s) => s.workMinutes != null).length;
  const missingClockOutDays = summaries.filter(
    (s) => s.clockIn && !s.clockOut,
  ).length;
  const pendingCount = countPendingForApprover(session.id);

  const prevYm = shiftYearMonth(ym, -1);
  const nextYm = shiftYearMonth(ym, 1);

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader
        user={session}
        active="attendance"
        pendingApprovalCount={pendingCount}
      />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl">勤怠一覧</CardTitle>
              <p className="text-sm text-muted-foreground">
                {fmtMonthTitle(ym)} ・ 勤務日数 {workedDays} 日 ・ 合計勤務時間{' '}
                {fmtMinutes(totalMin)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/attendance?ym=${prevYm}`}>← 前月</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/attendance?ym=${currentYearMonthJst()}`}>
                  今月
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/attendance?ym=${nextYm}`}>次月 →</Link>
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
                  {summaries.map((s) => {
                    const empty = !s.clockIn && !s.clockOut;
                    const note = notesMap.get(s.jstDateKey);
                    return (
                      <tr
                        key={s.jstDateKey}
                        className={`border-b last:border-b-0 ${
                          empty ? 'text-muted-foreground' : ''
                        }`}
                      >
                        <td className="px-3 py-2 font-mono">
                          <Link
                            href={`/attendance/${s.jstDateKey}?ym=${ym}`}
                            className="text-primary underline-offset-4 hover:underline"
                          >
                            {s.jstDateKey}
                          </Link>
                        </td>
                        <td className={`px-3 py-2 ${dayClass(s)}`}>
                          {WEEKDAY_LABEL[s.weekday]}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {s.clockIn ? fmtTime(s.clockIn.occurredAt) : '-'}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {s.clockOut ? fmtTime(s.clockOut.occurredAt) : '-'}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {s.breakMinutes > 0
                            ? fmtMinutes(s.breakMinutes)
                            : '-'}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {fmtMinutes(s.workMinutes)}
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
                      {missingClockOutDays > 0 && (
                        <span className="ml-2 text-xs font-normal text-rose-600">
                          （退勤打刻なし {missingClockOutDays} 日）
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-muted-foreground" colSpan={2}>
                      勤務 {workedDays} 日
                    </td>
                    <td className="px-3 py-3 font-mono">
                      {fmtMinutes(totalBreakMin)}
                    </td>
                    <td className="px-3 py-3 font-mono text-base">
                      {fmtMinutes(totalMin)}
                    </td>
                    <td className="px-3 py-3"></td>
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
