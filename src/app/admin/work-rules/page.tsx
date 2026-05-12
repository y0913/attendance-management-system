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
import { countPendingForApprover } from '@/lib/data/pending-approvals';
import { getMockSession } from '@/lib/data/session';
import {
  classifyVersionStatus,
  listWorkRuleVersions,
  type VersionStatus,
} from '@/lib/data/work-rule-versions';

const fmtDate = (d: Date) => formatInTimeZone(d, JST_TIMEZONE, 'yyyy年MM月dd日');

const STATUS_LABEL: Record<VersionStatus, string> = {
  past: '過去',
  current: '現行',
  future: '予約',
};

const STATUS_BADGE: Record<VersionStatus, string> = {
  past: 'bg-zinc-200 text-zinc-700',
  current: 'bg-emerald-100 text-emerald-900',
  future: 'bg-sky-100 text-sky-900',
};

const fmtMin = (n: number): string => `${Math.floor(n / 60)}h${n % 60 > 0 ? ` ${n % 60}m` : ''}`;

export default async function WorkRulesTimelinePage() {
  const session = await getMockSession();
  if (!session) redirect('/login');
  if (session.role !== 'admin') redirect('/clock');

  const versions = await listWorkRuleVersions(session.companyId);
  const sorted = versions
    .slice()
    .sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime());
  const myPending = await countPendingForApprover(session.id);

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader
        user={session}
        active="admin-work-rules"
        pendingApprovalCount={myPending}
      />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl">労働ルール</CardTitle>
              <p className="text-sm text-muted-foreground">
                バージョン履歴。過去・現行は閲覧のみ、未来予約のみ編集・削除できます。
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/admin/work-rules/new">+ 新規ルール</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">状態</th>
                    <th className="px-3 py-2 font-medium">適用開始日</th>
                    <th className="px-3 py-2 font-medium">残業率</th>
                    <th className="px-3 py-2 font-medium">深夜割増</th>
                    <th className="px-3 py-2 font-medium">法定休日</th>
                    <th className="px-3 py-2 font-medium">月60h超</th>
                    <th className="px-3 py-2 font-medium">日次/週次閾値</th>
                    <th className="px-3 py-2 font-medium">compliance</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((v) => {
                    const status = classifyVersionStatus(v, versions);
                    const isFuture = status === 'future';
                    return (
                      <tr
                        key={v.id}
                        className="border-b align-middle last:border-b-0"
                      >
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}
                          >
                            {STATUS_LABEL[status]}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-mono">
                          {fmtDate(v.validFrom)}
                        </td>
                        <td className="px-3 py-3 font-mono">
                          ×{v.otRate.toFixed(2)}
                        </td>
                        <td className="px-3 py-3 font-mono">
                          +{v.nightRateAddition.toFixed(2)} (
                          {v.nightStartTime}-{v.nightEndTime})
                        </td>
                        <td className="px-3 py-3 font-mono">
                          ×{v.legalHolidayRate.toFixed(2)}
                        </td>
                        <td className="px-3 py-3 font-mono">
                          ×{v.monthly60hOtRate.toFixed(2)} (
                          {fmtMin(v.monthly60hThresholdMin)})
                        </td>
                        <td className="px-3 py-3 font-mono text-xs">
                          {fmtMin(v.dailyOtThresholdMin)} /{' '}
                          {fmtMin(v.weeklyOtThresholdMin)}
                        </td>
                        <td className="px-3 py-3 text-xs">
                          {v.complianceMode ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-900">
                              ON
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900">
                              OFF
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Link
                            href={`/admin/work-rules/${v.id}`}
                            className="text-xs text-muted-foreground hover:underline"
                          >
                            {isFuture ? '編集 →' : '詳細 →'}
                          </Link>
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
