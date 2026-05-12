import { formatInTimeZone } from 'date-fns-tz';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { JST_TIMEZONE } from '@/lib/calc/constants';
import { AppHeader } from '@/components/app-header';
import { getUserLeaveBalance } from '@/lib/data/leave-grants';
import { countPendingForApprover } from '@/lib/data/pending-approvals';
import { getMockSession } from '@/lib/data/session';

const fmtDate = (d: Date) => formatInTimeZone(d, JST_TIMEZONE, 'yyyy年MM月dd日');

const daysUntil = (target: Date, asOf: Date): number =>
  Math.ceil((target.getTime() - asOf.getTime()) / (1000 * 60 * 60 * 24));

export default async function LeaveBalancePage() {
  const session = await getMockSession();
  if (!session) redirect('/login');

  const asOf = new Date();
  const balance = await getUserLeaveBalance(session.id, asOf);
  if (!balance) redirect('/login');

  const tenure = balance.hiredAt
    ? (() => {
        const months = Math.floor(
          (asOf.getTime() - balance.hiredAt.getTime()) /
            (1000 * 60 * 60 * 24 * 30.44),
        );
        return { years: Math.floor(months / 12), remMonths: months % 12 };
      })()
    : null;
  const pendingCount = await countPendingForApprover(session.id);

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader
        user={session}
        active="leave-balance"
        pendingApprovalCount={pendingCount}
      />

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold">有給</h1>
          <Button asChild size="sm">
            <Link href="/applications/new/leave">+ 有給を申請</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <p className="text-xs text-muted-foreground">現在の残日数</p>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">
                {balance.summary.totalRemaining}
                <span className="ml-1 text-base font-normal text-muted-foreground">
                  日
                </span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <p className="text-xs text-muted-foreground">90日以内に失効</p>
            </CardHeader>
            <CardContent>
              <p
                className={`text-3xl font-semibold ${balance.summary.expiringSoonDays > 0 ? 'text-amber-700' : ''}`}
              >
                {balance.summary.expiringSoonDays}
                <span className="ml-1 text-base font-normal text-muted-foreground">
                  日
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {fmtDate(balance.summary.expiringSoonThreshold)} まで
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <p className="text-xs text-muted-foreground">次回付与予定</p>
            </CardHeader>
            <CardContent>
              {balance.nextGrant ? (
                <>
                  <p className="text-base font-semibold font-mono">
                    {fmtDate(balance.nextGrant.grantedAt)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {balance.nextGrant.grantedDays} 日付与（あと
                    {daysUntil(balance.nextGrant.grantedAt, asOf)}日）
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">-</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">付与履歴</CardTitle>
            <p className="mt-2 text-lg font-semibold">
              入社日:{' '}
              {balance.hiredAt ? fmtDate(balance.hiredAt) : '未設定'}
            </p>
            <p className="text-xs text-muted-foreground">
              {tenure ? `勤続 ${tenure.years}年${tenure.remMonths}ヶ月 ・ ` : ''}
              承認済申請による消化 {balance.totalApprovedDays}{' '}
              日（古い付与から先に消化）
            </p>
          </CardHeader>
          <CardContent>
            {balance.grants.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                まだ付与されていません
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">付与日</th>
                      <th className="px-3 py-2 font-medium">付与日数</th>
                      <th className="px-3 py-2 font-medium">消化</th>
                      <th className="px-3 py-2 font-medium">残</th>
                      <th className="px-3 py-2 font-medium">有効期限</th>
                      <th className="px-3 py-2 font-medium">状態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balance.grants.map((g, i) => {
                      const daysToExpire = daysUntil(g.expiresAt, asOf);
                      const expiringSoon =
                        !g.expired && daysToExpire <= 90;
                      const stateLabel = g.expired
                        ? '失効'
                        : expiringSoon
                        ? '失効間近'
                        : '有効';
                      const stateClass = g.expired
                        ? 'bg-zinc-200 text-zinc-700'
                        : expiringSoon
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-emerald-100 text-emerald-900';
                      return (
                        <tr
                          key={i}
                          className={`border-b last:border-b-0 ${g.expired ? 'text-muted-foreground' : ''}`}
                        >
                          <td className="px-3 py-2 font-mono">
                            {fmtDate(g.grantedAt)}
                          </td>
                          <td className="px-3 py-2 font-mono">
                            {g.grantedDays}
                          </td>
                          <td className="px-3 py-2 font-mono">{g.usedDays}</td>
                          <td className="px-3 py-2 font-mono font-semibold">
                            {g.remainingDays}
                          </td>
                          <td className="px-3 py-2 font-mono">
                            {fmtDate(g.expiresAt)}
                            {!g.expired && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                （あと{daysToExpire}日）
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${stateClass}`}
                            >
                              {stateLabel}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
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
