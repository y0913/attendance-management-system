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
import {
  buildClosingSnapshot,
  findClosing,
  type ClosingSnapshot,
  type MockAttendanceClosing,
} from '@/lib/mock/attendance-closings';
import {
  currentYearMonthJst,
  shiftYearMonth,
} from '@/lib/mock/attendance-summary';
import { countPendingForApprover } from '@/lib/mock/pending-approvals';
import { getMockSession } from '@/lib/mock/session';
import { listActiveUsers } from '@/lib/mock/users';
import {
  BulkCloseButton,
  SingleCloseButton,
  UncloseButton,
} from './close-buttons';

const ROLE_LABEL: Record<string, string> = {
  admin: '管理者',
  approver: '承認者',
  general: '一般',
};

const fmtMonth = (ym: string) => {
  const [y, m] = ym.split('-');
  return `${y}年${Number(m)}月`;
};

const fmtDateTime = (d: Date) =>
  formatInTimeZone(d, JST_TIMEZONE, 'yyyy-MM-dd HH:mm');

const fmtMinutes = (n: number): string => {
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
};

const isValidYm = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

const previousYearMonth = (): string => {
  const today = new Date();
  return shiftYearMonth(currentYearMonthJst(today), -1);
};

interface UserRow {
  userId: string;
  userName: string;
  role: string;
  closing: MockAttendanceClosing | null;
  preview: ClosingSnapshot;
}

export default async function ClosingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  const session = await getMockSession();
  if (!session) redirect('/login');
  if (session.role !== 'admin') redirect('/clock');

  const sp = await searchParams;
  const ym = sp.ym && isValidYm(sp.ym) ? sp.ym : previousYearMonth();

  const users = (await listActiveUsers()).sort((a, b) =>
    a.name.localeCompare(b.name, 'ja'),
  );
  const userNameById = new Map(users.map((u) => [u.id, u.name]));
  const rows: UserRow[] = await Promise.all(
    users.map(async (u) => ({
      userId: u.id,
      userName: u.name,
      role: ROLE_LABEL[u.role],
      closing: findClosing(u.id, ym),
      preview: await buildClosingSnapshot(u.id, ym),
    })),
  );

  const closedCount = rows.filter((r) => r.closing !== null).length;
  const notClosedCount = rows.length - closedCount;
  const myPending = countPendingForApprover(session.id);

  const prevYm = shiftYearMonth(ym, -1);
  const nextYm = shiftYearMonth(ym, 1);

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader
        user={session}
        active="admin-closings"
        pendingApprovalCount={myPending}
      />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <Card>
          <CardHeader className="flex flex-col gap-3">
            <div className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl">
                  月次締め処理 ・ {fmtMonth(ym)}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  締め済み {closedCount} 名 ・ 未締め {notClosedCount} 名
                  <span className="ml-2 text-xs">
                    （締めると snapshot
                    が凍結され、過去のルール変更で集計が変わらなくなる）
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/closings?ym=${prevYm}`}>← 前月</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/closings?ym=${previousYearMonth()}`}>
                    先月
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/closings?ym=${nextYm}`}>次月 →</Link>
                </Button>
              </div>
            </div>
            <BulkCloseButton yearMonth={ym} notClosedCount={notClosedCount} />
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">名前</th>
                    <th className="px-3 py-2 font-medium">ロール</th>
                    <th className="px-3 py-2 font-medium">勤務日数</th>
                    <th className="px-3 py-2 font-medium">合計勤務</th>
                    <th className="px-3 py-2 font-medium">合計休憩</th>
                    <th className="px-3 py-2 font-medium">有給消化</th>
                    <th className="px-3 py-2 font-medium">退勤未打刻</th>
                    <th className="px-3 py-2 font-medium">状態</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const data = r.closing
                      ? r.closing.snapshot
                      : r.preview;
                    const closedByName = r.closing
                      ? userNameById.get(r.closing.closedById) ?? '-'
                      : null;
                    return (
                      <tr
                        key={r.userId}
                        className="border-b align-middle last:border-b-0"
                      >
                        <td className="px-3 py-3 font-medium">{r.userName}</td>
                        <td className="px-3 py-3 text-xs">{r.role}</td>
                        <td className="px-3 py-3 font-mono">
                          {data.workedDays}
                        </td>
                        <td className="px-3 py-3 font-mono">
                          {fmtMinutes(data.totalWorkMinutes)}
                        </td>
                        <td className="px-3 py-3 font-mono">
                          {fmtMinutes(data.totalBreakMinutes)}
                        </td>
                        <td className="px-3 py-3 font-mono">
                          {data.approvedLeaveDays} 日
                        </td>
                        <td className="px-3 py-3 text-xs">
                          {data.missingClockOutDays > 0 ? (
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 font-medium text-rose-900">
                              {data.missingClockOutDays} 日
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {r.closing ? (
                            <span
                              className="inline-flex flex-col items-start rounded-md bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-900"
                              title={fmtDateTime(r.closing.closedAt)}
                            >
                              <span>締め済み</span>
                              <span className="font-normal text-[10px] text-indigo-700">
                                {closedByName ?? '-'} ・{' '}
                                {fmtDateTime(r.closing.closedAt)}
                              </span>
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                              未締め
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {r.closing ? (
                            <UncloseButton
                              closingId={r.closing.id}
                              userName={r.userName}
                              yearMonth={ym}
                            />
                          ) : (
                            <SingleCloseButton
                              userId={r.userId}
                              userName={r.userName}
                              yearMonth={ym}
                            />
                          )}
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
