import { formatInTimeZone } from 'date-fns-tz';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
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
import { findMockUserById } from '@/lib/mock/users';
import {
  classifyVersionStatus,
  findWorkRuleVersionById,
  listWorkRuleVersions,
} from '@/lib/mock/work-rule-versions';
import { WorkRuleForm } from '../work-rule-form';
import { DeleteForm } from './delete-form';

const fmtDate = (d: Date) => formatInTimeZone(d, JST_TIMEZONE, 'yyyy-MM-dd');
const fmtDateTime = (d: Date) =>
  formatInTimeZone(d, JST_TIMEZONE, 'yyyy-MM-dd HH:mm');

const fmtMin = (n: number): string =>
  `${Math.floor(n / 60)}h${n % 60 > 0 ? ` ${n % 60}m` : ''}`;

const STATUS_LABEL: Record<string, string> = {
  past: '過去',
  current: '現行',
  future: '予約',
};

const STATUS_BADGE: Record<string, string> = {
  past: 'bg-zinc-200 text-zinc-700',
  current: 'bg-emerald-100 text-emerald-900',
  future: 'bg-sky-100 text-sky-900',
};

export default async function EditWorkRulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getMockSession();
  if (!session) redirect('/login');
  if (session.role !== 'admin') redirect('/clock');

  const { id } = await params;
  const target = await findWorkRuleVersionById(id);
  if (!target) notFound();

  const versions = await listWorkRuleVersions();
  const status = classifyVersionStatus(target, versions);
  const isFuture = status === 'future';
  const myPending = await countPendingForApprover(session.id);
  const creator = await findMockUserById(target.createdById);

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader
        user={session}
        active="admin-work-rules"
        pendingApprovalCount={myPending}
      />

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
        <div>
          <Link
            href="/admin/work-rules"
            className="text-xs text-muted-foreground hover:underline"
          >
            ← タイムラインに戻る
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-xl font-semibold">
              バージョン {fmtDate(target.validFrom)}
            </h1>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}
            >
              {STATUS_LABEL[status]}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            作成: {fmtDateTime(target.createdAt)} by {creator?.name ?? '-'}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isFuture ? '編集' : '内容（閲覧のみ）'}
            </CardTitle>
            {!isFuture && (
              <p className="text-xs text-muted-foreground">
                現行・過去バージョンは編集できません。変更したい場合は新規予約を作成してください。
              </p>
            )}
          </CardHeader>
          <CardContent>
            {isFuture ? (
              <WorkRuleForm
                initial={{
                  id: target.id,
                  validFrom: fmtDate(target.validFrom),
                  dailyOtThresholdMin: target.dailyOtThresholdMin,
                  weeklyOtThresholdMin: target.weeklyOtThresholdMin,
                  otRate: target.otRate,
                  nightStartTime: target.nightStartTime,
                  nightEndTime: target.nightEndTime,
                  nightRateAddition: target.nightRateAddition,
                  legalHolidayRate: target.legalHolidayRate,
                  monthly60hOtRate: target.monthly60hOtRate,
                  monthly60hThresholdMin: target.monthly60hThresholdMin,
                  complianceMode: target.complianceMode,
                }}
                isCreate={false}
              />
            ) : (
              <dl className="grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
                <dt className="text-muted-foreground">適用開始日</dt>
                <dd className="font-mono">{fmtDate(target.validFrom)}</dd>
                <dt className="text-muted-foreground">残業率</dt>
                <dd className="font-mono">×{target.otRate.toFixed(2)}</dd>
                <dt className="text-muted-foreground">深夜割増</dt>
                <dd className="font-mono">
                  +{target.nightRateAddition.toFixed(2)}（
                  {target.nightStartTime}–{target.nightEndTime}）
                </dd>
                <dt className="text-muted-foreground">法定休日</dt>
                <dd className="font-mono">
                  ×{target.legalHolidayRate.toFixed(2)}
                </dd>
                <dt className="text-muted-foreground">月60h超</dt>
                <dd className="font-mono">
                  ×{target.monthly60hOtRate.toFixed(2)}（閾値{' '}
                  {fmtMin(target.monthly60hThresholdMin)}）
                </dd>
                <dt className="text-muted-foreground">日次/週次閾値</dt>
                <dd className="font-mono">
                  {fmtMin(target.dailyOtThresholdMin)} /{' '}
                  {fmtMin(target.weeklyOtThresholdMin)}
                </dd>
                <dt className="text-muted-foreground">compliance_mode</dt>
                <dd>
                  {target.complianceMode ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
                      ON
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                      OFF
                    </span>
                  )}
                </dd>
              </dl>
            )}
          </CardContent>
        </Card>

        {isFuture && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">削除</CardTitle>
              <p className="text-xs text-muted-foreground">
                この未来予約を削除します。実行後は元に戻せません。
              </p>
            </CardHeader>
            <CardContent>
              <DeleteForm id={target.id} />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
