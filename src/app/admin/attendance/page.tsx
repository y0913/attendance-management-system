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
  currentYearMonthJst,
  shiftYearMonth,
  summarizeMonth,
  totalWorkMinutes,
} from '@/lib/mock/attendance-summary';
import { countPendingForApprover } from '@/lib/mock/pending-approvals';
import { getMockSession } from '@/lib/mock/session';
import {
  findMockUserById,
  listActiveUsers,
  type MockUser,
} from '@/lib/mock/users';

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

const isRole = (s: string): s is 'admin' | 'approver' | 'general' =>
  s === 'admin' || s === 'approver' || s === 'general';

const fmtMonthTitle = (ym: string) => {
  const [y, m] = ym.split('-');
  return `${y}年${Number(m)}月`;
};

const fmtMinutes = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
};

interface RowData {
  user: MockUser;
  workedDays: number;
  totalWorkMin: number;
  totalBreakMin: number;
  missingClockOutDays: number;
}

const summarizeUser = (user: MockUser, ym: string): RowData => {
  const summaries = summarizeMonth(user.id, ym);
  return {
    user,
    workedDays: summaries.filter((s) => s.workMinutes != null).length,
    totalWorkMin: totalWorkMinutes(summaries),
    totalBreakMin: summaries.reduce((sum, s) => sum + s.breakMinutes, 0),
    missingClockOutDays: summaries.filter((s) => s.clockIn && !s.clockOut)
      .length,
  };
};

export default async function AdminAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string; role?: string; manager?: string }>;
}) {
  const session = await getMockSession();
  if (!session) redirect('/login');
  if (session.role !== 'admin') redirect('/clock');

  const sp = await searchParams;
  const ym = sp.ym && isValidYm(sp.ym) ? sp.ym : currentYearMonthJst();
  const roleFilter = sp.role && isRole(sp.role) ? sp.role : null;
  const managerFilter = sp.manager ?? null;

  const users = listActiveUsers();
  const filtered = users
    .filter((u) => (roleFilter ? u.role === roleFilter : true))
    .filter((u) => {
      if (!managerFilter) return true;
      if (managerFilter === 'none') return u.managerId === null;
      return u.managerId === managerFilter;
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  const rows = filtered.map((u) => summarizeUser(u, ym));

  const totalWorkAll = rows.reduce((sum, r) => sum + r.totalWorkMin, 0);
  const missingTotal = rows.reduce(
    (sum, r) => sum + r.missingClockOutDays,
    0,
  );
  const myPending = countPendingForApprover(session.id);

  const prevYm = shiftYearMonth(ym, -1);
  const nextYm = shiftYearMonth(ym, 1);

  // 承認者フィルタ候補: approver/admin の active ユーザー
  const managerCandidates = users.filter(
    (u) => u.role === 'admin' || u.role === 'approver',
  );

  const buildHref = (overrides: {
    ym?: string;
    role?: string | null;
    manager?: string | null;
  }): string => {
    const params = new URLSearchParams();
    const targetYm = overrides.ym ?? ym;
    if (targetYm) params.set('ym', targetYm);
    const targetRole =
      overrides.role !== undefined ? overrides.role : roleFilter;
    if (targetRole) params.set('role', targetRole);
    const targetManager =
      overrides.manager !== undefined ? overrides.manager : managerFilter;
    if (targetManager) params.set('manager', targetManager);
    const qs = params.toString();
    return qs ? `/admin/attendance?${qs}` : '/admin/attendance';
  };

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader
        user={session}
        active="admin-attendance"
        pendingApprovalCount={myPending}
      />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <Card>
          <CardHeader className="flex flex-col gap-3">
            <div className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl">勤怠一覧（全社）</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {fmtMonthTitle(ym)} ・ {filtered.length} 名 ・ 合計勤務時間{' '}
                  {fmtMinutes(totalWorkAll)}
                  {missingTotal > 0 && (
                    <span className="ml-2 text-rose-600">
                      （退勤打刻なし {missingTotal} 件）
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={buildHref({ ym: prevYm })}>← 前月</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={buildHref({ ym: currentYearMonthJst() })}>
                    今月
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={buildHref({ ym: nextYm })}>次月 →</Link>
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">ロール:</span>
                {(['all', 'admin', 'approver', 'general'] as const).map((r) => {
                  const active =
                    r === 'all' ? roleFilter === null : roleFilter === r;
                  const href = buildHref({
                    role: r === 'all' ? null : r,
                  });
                  return (
                    <Link
                      key={r}
                      href={href}
                      className={`rounded-md px-2 py-1 text-xs ${active ? 'bg-muted font-medium' : 'hover:bg-muted'}`}
                    >
                      {r === 'all' ? '全て' : ROLE_LABEL[r]}
                    </Link>
                  );
                })}
              </div>

              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">承認者:</span>
                {(() => {
                  const allActive = managerFilter === null;
                  const noneActive = managerFilter === 'none';
                  return (
                    <>
                      <Link
                        href={buildHref({ manager: null })}
                        className={`rounded-md px-2 py-1 text-xs ${allActive ? 'bg-muted font-medium' : 'hover:bg-muted'}`}
                      >
                        全て
                      </Link>
                      <Link
                        href={buildHref({ manager: 'none' })}
                        className={`rounded-md px-2 py-1 text-xs ${noneActive ? 'bg-muted font-medium' : 'hover:bg-muted'}`}
                      >
                        承認者なし
                      </Link>
                      {managerCandidates.map((m) => {
                        const active = managerFilter === m.id;
                        return (
                          <Link
                            key={m.id}
                            href={buildHref({ manager: m.id })}
                            className={`rounded-md px-2 py-1 text-xs ${active ? 'bg-muted font-medium' : 'hover:bg-muted'}`}
                          >
                            {m.name}
                          </Link>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                条件に該当する従業員がいません
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">名前</th>
                      <th className="px-3 py-2 font-medium">ロール</th>
                      <th className="px-3 py-2 font-medium">雇用形態</th>
                      <th className="px-3 py-2 font-medium">承認者</th>
                      <th className="px-3 py-2 font-medium">勤務日数</th>
                      <th className="px-3 py-2 font-medium">合計勤務</th>
                      <th className="px-3 py-2 font-medium">合計休憩</th>
                      <th className="px-3 py-2 font-medium">アラート</th>
                      <th className="px-3 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const manager = r.user.managerId
                        ? findMockUserById(r.user.managerId)
                        : null;
                      return (
                        <tr
                          key={r.user.id}
                          className="border-b align-middle last:border-b-0"
                        >
                          <td className="px-3 py-3 font-medium">
                            <Link
                              href={`/team/attendance/${r.user.id}?ym=${ym}`}
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              {r.user.name}
                            </Link>
                          </td>
                          <td className="px-3 py-3 text-xs">
                            {ROLE_LABEL[r.user.role]}
                          </td>
                          <td className="px-3 py-3 text-xs">
                            {EMPLOYMENT_LABEL[r.user.employmentType]}
                          </td>
                          <td className="px-3 py-3 text-xs text-muted-foreground">
                            {manager?.name ?? '-'}
                          </td>
                          <td className="px-3 py-3 font-mono">
                            {r.workedDays}
                          </td>
                          <td className="px-3 py-3 font-mono">
                            {fmtMinutes(r.totalWorkMin)}
                          </td>
                          <td className="px-3 py-3 font-mono">
                            {fmtMinutes(r.totalBreakMin)}
                          </td>
                          <td className="px-3 py-3 text-xs">
                            {r.missingClockOutDays > 0 ? (
                              <span className="rounded-full bg-rose-100 px-2 py-0.5 font-medium text-rose-900">
                                退勤未打刻 {r.missingClockOutDays} 日
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <Link
                              href={`/team/attendance/${r.user.id}?ym=${ym}`}
                              className="text-xs text-muted-foreground hover:underline"
                            >
                              詳細 →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-muted/60 font-medium">
                    <tr className="border-t-2">
                      <td className="px-3 py-3" colSpan={4}>
                        合計
                      </td>
                      <td className="px-3 py-3 font-mono">
                        {rows.reduce((s, r) => s + r.workedDays, 0)}
                      </td>
                      <td className="px-3 py-3 font-mono">
                        {fmtMinutes(totalWorkAll)}
                      </td>
                      <td
                        className="px-3 py-3 font-mono"
                        colSpan={3}
                      >
                        {fmtMinutes(
                          rows.reduce((s, r) => s + r.totalBreakMin, 0),
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
