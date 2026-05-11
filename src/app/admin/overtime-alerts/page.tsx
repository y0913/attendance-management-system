import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AppHeader } from '@/components/app-header';
import {
  currentYearMonthJst,
  shiftYearMonth,
} from '@/lib/data/attendance-summary';
import { listOvertimeAlerts } from '@/lib/data/overtime-alerts';
import { countPendingForApprover } from '@/lib/data/pending-approvals';
import { getMockSession } from '@/lib/data/session';

const isValidYm = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

const fmtMonth = (ym: string) => {
  const [y, m] = ym.split('-');
  return `${y}年${Number(m)}月`;
};

const fmtMinutes = (n: number): string => {
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
};

const previousYearMonth = (): string =>
  shiftYearMonth(currentYearMonthJst(new Date()), -1);

export default async function OvertimeAlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  const session = await getMockSession();
  if (!session) redirect('/login');
  if (session.role !== 'admin') redirect('/clock');

  const sp = await searchParams;
  const ym = sp.ym && isValidYm(sp.ym) ? sp.ym : previousYearMonth();

  const alerts = await listOvertimeAlerts(session.companyId, ym);
  const myPending = await countPendingForApprover(session.id);
  const prevYm = shiftYearMonth(ym, -1);
  const nextYm = shiftYearMonth(ym, 1);

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader
        user={session}
        active="admin-overtime-alerts"
        pendingApprovalCount={myPending}
      />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl">
                36協定アラート ・ {fmtMonth(ym)}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                月60h 超の法定外残業が発生している（または見込まれる）社員 ・{' '}
                <span className="font-semibold">{alerts.length} 名</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                ※ 概算ロジック: 月の合計勤務時間 − 営業日数（土日除く）×
                8時間。祝日カレンダーは未対応。正式な calc 接続は次イテレーション。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/overtime-alerts?ym=${prevYm}`}>← 前月</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link
                  href={`/admin/overtime-alerts?ym=${previousYearMonth()}`}
                >
                  先月
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/overtime-alerts?ym=${nextYm}`}>次月 →</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                月60h 超の社員はいません
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">名前</th>
                      <th className="px-3 py-2 font-medium">合計勤務</th>
                      <th className="px-3 py-2 font-medium">勤務日数</th>
                      <th className="px-3 py-2 font-medium">営業日数</th>
                      <th className="px-3 py-2 font-medium">残業概算</th>
                      <th className="px-3 py-2 font-medium">締め状態</th>
                      <th className="px-3 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((a) => (
                      <tr
                        key={a.user.id}
                        className="border-b align-middle last:border-b-0"
                      >
                        <td className="px-3 py-3 font-medium">{a.user.name}</td>
                        <td className="px-3 py-3 font-mono">
                          {fmtMinutes(a.estimate.totalWorkMinutes)}
                        </td>
                        <td className="px-3 py-3 font-mono">
                          {a.estimate.workedDays}
                        </td>
                        <td className="px-3 py-3 font-mono">
                          {a.estimate.businessDaysInMonth}
                        </td>
                        <td className="px-3 py-3">
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 font-mono text-xs font-medium text-rose-900">
                            {fmtMinutes(a.estimate.estimatedOtMinutes)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs">
                          {a.isClosed ? (
                            <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-medium text-indigo-900">
                              締め済み
                            </span>
                          ) : (
                            <span className="text-muted-foreground">未締め</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Link
                            href={`/team/attendance/${a.user.id}?ym=${ym}`}
                            className="text-xs text-primary underline-offset-4 hover:underline"
                          >
                            勤怠詳細 →
                          </Link>
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
