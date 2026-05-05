import { formatInTimeZone } from 'date-fns-tz';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { JST_TIMEZONE } from '@/lib/calc/constants';
import { getMockSession } from '@/lib/mock/session';
import {
  getClockState,
  getLatestClockIn,
  listClocksForDate,
  type ClockState,
} from '@/lib/mock/time-clocks';
import { signOutAction } from '@/app/login/actions';
import { Button } from '@/components/ui/button';
import { ClockButtons } from './clock-buttons';

const STATE_LABEL: Record<ClockState, string> = {
  not_clocked_in: '未出勤',
  working: '勤務中',
  on_break: '休憩中',
  clocked_out: '退勤済み',
};

const STATE_COLOR: Record<ClockState, string> = {
  not_clocked_in: 'bg-zinc-200 text-zinc-800',
  working: 'bg-emerald-100 text-emerald-900',
  on_break: 'bg-amber-100 text-amber-900',
  clocked_out: 'bg-zinc-200 text-zinc-800',
};

const ROLE_LABEL: Record<string, string> = {
  admin: '管理者',
  approver: '承認者',
  general: '一般',
};

const fmt = (d: Date) => formatInTimeZone(d, JST_TIMEZONE, 'HH:mm');
const fmtFull = (d: Date) =>
  formatInTimeZone(d, JST_TIMEZONE, 'yyyy/MM/dd (EEE) HH:mm');

export default async function ClockPage() {
  const session = await getMockSession();
  if (!session) redirect('/login');

  const state = getClockState(session.id);
  const clocks = listClocksForDate(session.id);
  const latestIn = getLatestClockIn(session.id);

  return (
    <div className="min-h-screen bg-muted">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
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
                className="rounded-md bg-muted px-3 py-1.5 font-medium"
              >
                打刻
              </Link>
              <Link
                href="/attendance"
                className="rounded-md px-3 py-1.5 hover:bg-muted"
              >
                勤怠
              </Link>
              <Link
                href="/applications"
                className="rounded-md px-3 py-1.5 hover:bg-muted"
              >
                申請
              </Link>
              <Link
                href="/leave-balance"
                className="rounded-md px-3 py-1.5 hover:bg-muted"
              >
                有給
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

      <main className="mx-auto max-w-3xl px-6 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">打刻</CardTitle>
            <p className="text-sm text-muted-foreground">{fmtFull(new Date())}</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-8">
            <div className="flex items-center gap-4">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${STATE_COLOR[state]}`}
              >
                {STATE_LABEL[state]}
              </span>
              {latestIn && state !== 'not_clocked_in' && (
                <span className="text-sm text-muted-foreground">
                  出勤: {fmt(latestIn.occurredAt)}
                </span>
              )}
            </div>

            <ClockButtons state={state} />

            {clocks.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">本日の打刻履歴</p>
                <ul className="divide-y rounded-md border bg-background">
                  {clocks.map((c) => (
                    <li
                      key={c.id}
                      className="flex justify-between px-4 py-2 text-sm"
                    >
                      <span>{TYPE_LABEL[c.type]}</span>
                      <span className="font-mono text-muted-foreground">
                        {fmt(c.occurredAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

const TYPE_LABEL: Record<string, string> = {
  clock_in: '出勤',
  clock_out: '退勤',
  break_start: '休憩開始',
  break_end: '休憩終了',
};
