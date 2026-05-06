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
import { AppHeader } from '@/components/app-header';
import {
  STATUS_BADGE_CLASS as CORRECTION_BADGE,
  STATUS_LABEL as CORRECTION_LABEL,
} from '@/lib/mock/clock-corrections';
import {
  LEAVE_STATUS_BADGE_CLASS,
  LEAVE_STATUS_LABEL,
  LEAVE_TYPE_LABEL,
} from '@/lib/mock/leave-requests';
import {
  countAllPending,
  countPendingForApprover,
  listAllRecentRequests,
  type PendingItem,
} from '@/lib/mock/pending-approvals';
import { getMockSession } from '@/lib/mock/session';
import { countClockStates } from '@/lib/mock/time-clocks';
import { findMockUserById, listActiveUsers } from '@/lib/mock/users';

const fmtDateTime = (d: Date) =>
  formatInTimeZone(d, JST_TIMEZONE, 'yyyy-MM-dd HH:mm');

const fmtToday = (d: Date) =>
  formatInTimeZone(d, JST_TIMEZONE, 'yyyy/MM/dd (EEE)');

interface RecentRow {
  key: string;
  href: string | null;
  badge: { label: string; class: string };
  typeLabel: string;
  requesterName: string;
  reason: string;
  submittedAt: Date;
}

const itemToRow = (item: PendingItem): RecentRow => {
  const requesterName =
    findMockUserById(item.request.requesterId)?.name ?? '-';

  if (item.kind === 'correction') {
    const r = item.request;
    return {
      key: `correction:${r.id}`,
      href:
        r.status === 'submitted'
          ? `/team/approvals/correction/${r.id}`
          : null,
      badge: {
        label: CORRECTION_LABEL[r.status],
        class: CORRECTION_BADGE[r.status],
      },
      typeLabel: '打刻修正',
      requesterName,
      reason: r.reason,
      submittedAt: r.submittedAt,
    };
  }
  const r = item.request;
  return {
    key: `leave:${r.id}`,
    href:
      r.status === 'submitted' ? `/team/approvals/leave/${r.id}` : null,
    badge: {
      label: LEAVE_STATUS_LABEL[r.status],
      class: LEAVE_STATUS_BADGE_CLASS[r.status],
    },
    typeLabel: LEAVE_TYPE_LABEL[r.leaveType],
    requesterName,
    reason: r.reason,
    submittedAt: r.submittedAt,
  };
};

export default async function AdminDashboardPage() {
  const session = await getMockSession();
  if (!session) redirect('/login');
  if (session.role !== 'admin') redirect('/clock');

  const now = new Date();
  const allUsers = listActiveUsers();
  const userIds = allUsers.map((u) => u.id);
  const clockStates = countClockStates(userIds, now);
  const pendingCompany = countAllPending();
  const myPending = countPendingForApprover(session.id);
  const recentRows = listAllRecentRequests(8).map(itemToRow);

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader
        user={session}
        active="admin-dashboard"
        pendingApprovalCount={myPending}
      />

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        <div>
          <h1 className="text-2xl font-semibold">ダッシュボード</h1>
          <p className="text-sm text-muted-foreground">{fmtToday(now)}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <p className="text-xs text-muted-foreground">全社の承認待ち</p>
            </CardHeader>
            <CardContent>
              <p
                className={`text-3xl font-semibold ${pendingCompany > 0 ? 'text-amber-700' : ''}`}
              >
                {pendingCompany}
                <span className="ml-1 text-base font-normal text-muted-foreground">
                  件
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                <Link
                  href="/team/approvals"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  承認画面で対応 →
                </Link>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <p className="text-xs text-muted-foreground">従業員数</p>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">
                {allUsers.length}
                <span className="ml-1 text-base font-normal text-muted-foreground">
                  名
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                管理 {allUsers.filter((u) => u.role === 'admin').length} ・ 承認者{' '}
                {allUsers.filter((u) => u.role === 'approver').length} ・ 一般{' '}
                {allUsers.filter((u) => u.role === 'general').length}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <p className="text-xs text-muted-foreground">本日の打刻状況</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="text-muted-foreground">勤務中</span>
                <span className="text-right font-mono font-semibold text-emerald-700">
                  {clockStates.working} 名
                </span>
                <span className="text-muted-foreground">休憩中</span>
                <span className="text-right font-mono font-semibold text-amber-700">
                  {clockStates.onBreak} 名
                </span>
                <span className="text-muted-foreground">退勤済み</span>
                <span className="text-right font-mono">
                  {clockStates.clockedOut} 名
                </span>
                <span className="text-muted-foreground">未出勤</span>
                <span className="text-right font-mono">
                  {clockStates.notClockedIn} 名
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-dashed bg-muted/30">
            <CardHeader className="pb-2">
              <p className="text-xs text-muted-foreground">締め未了の月</p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                月次締め処理は未実装
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Phase 2 で `attendance_closings` を実装予定
              </p>
            </CardContent>
          </Card>

          <Card className="border-dashed bg-muted/30">
            <CardHeader className="pb-2">
              <p className="text-xs text-muted-foreground">36協定アラート</p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                月60h超のアラートは未実装
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                月次集計の整備後に追加予定
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">直近の申請（全社）</CardTitle>
              <p className="text-xs text-muted-foreground">
                打刻修正・有給を提出日時の新しい順に最大 8 件表示
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {recentRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                申請はまだありません
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">状態</th>
                      <th className="px-3 py-2 font-medium">種別</th>
                      <th className="px-3 py-2 font-medium">申請者</th>
                      <th className="px-3 py-2 font-medium">理由</th>
                      <th className="px-3 py-2 font-medium">申請日時</th>
                      <th className="px-3 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {recentRows.map((r) => (
                      <tr
                        key={r.key}
                        className="border-b align-top last:border-b-0"
                      >
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${r.badge.class}`}
                          >
                            {r.badge.label}
                          </span>
                        </td>
                        <td className="px-3 py-3">{r.typeLabel}</td>
                        <td className="px-3 py-3 text-xs">
                          {r.requesterName}
                        </td>
                        <td
                          className="max-w-[300px] truncate px-3 py-3"
                          title={r.reason}
                        >
                          {r.reason}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                          {fmtDateTime(r.submittedAt)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {r.href ? (
                            <Link
                              href={r.href}
                              className="text-xs text-primary underline-offset-4 hover:underline"
                            >
                              対応 →
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              -
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
