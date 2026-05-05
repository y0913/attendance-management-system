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
import { signOutAction } from '@/app/login/actions';
import { getMockSession } from '@/lib/mock/session';
import {
  currentYearMonthJst,
  shiftYearMonth,
  summarizeMonth,
  totalWorkMinutes,
  type DailySummary,
} from '@/lib/mock/attendance-summary';

const ROLE_LABEL: Record<string, string> = {
  admin: '管理者',
  approver: '承認者',
  general: '一般',
};

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

  const summaries = summarizeMonth(session.id, ym);
  const totalMin = totalWorkMinutes(summaries);
  const workedDays = summaries.filter((s) => s.workMinutes != null).length;

  const prevYm = shiftYearMonth(ym, -1);
  const nextYm = shiftYearMonth(ym, 1);

  return (
    <div className="min-h-screen bg-muted">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-sm text-muted-foreground">勤怠管理システム</p>
              <p className="text-base font-semibold">
                {session.name}{' '}
                <span className="ml-2 text-xs text-muted-foreground">
                  {ROLE_LABEL[session.role]}
                </span>
              </p>
            </div>
            <nav className="flex gap-2 text-sm">
              <Link
                href="/clock"
                className="rounded-md px-3 py-1.5 hover:bg-muted"
              >
                打刻
              </Link>
              <Link
                href="/attendance"
                className="rounded-md bg-muted px-3 py-1.5 font-medium"
              >
                勤怠
              </Link>
            </nav>
          </div>
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm">
              サインアウト
            </Button>
          </form>
        </div>
      </header>

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
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((s) => {
                    const empty = !s.clockIn && !s.clockOut;
                    return (
                      <tr
                        key={s.jstDateKey}
                        className={`border-b last:border-b-0 ${
                          empty ? 'text-muted-foreground' : ''
                        }`}
                      >
                        <td className="px-3 py-2 font-mono">{s.jstDateKey}</td>
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
