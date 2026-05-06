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
import { countPendingForApprover } from '@/lib/mock/pending-approvals';
import { getMockSession } from '@/lib/mock/session';
import { getCurrentWorkRuleVersion } from '@/lib/mock/work-rule-versions';
import { WorkRuleForm } from '../work-rule-form';

const addDays = (d: Date, n: number): Date => {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
};

export default async function NewWorkRulePage() {
  const session = await getMockSession();
  if (!session) redirect('/login');
  if (session.role !== 'admin') redirect('/clock');

  const myPending = await countPendingForApprover(session.id);
  const tomorrow = formatInTimeZone(
    addDays(new Date(), 1),
    JST_TIMEZONE,
    'yyyy-MM-dd',
  );

  // 現行ルールを初期値に（同じ値で日付だけ未来に変えれば最小編集で済む）
  const current = getCurrentWorkRuleVersion();
  const initial = current
    ? {
        validFrom: tomorrow,
        dailyOtThresholdMin: current.dailyOtThresholdMin,
        weeklyOtThresholdMin: current.weeklyOtThresholdMin,
        otRate: current.otRate,
        nightStartTime: current.nightStartTime,
        nightEndTime: current.nightEndTime,
        nightRateAddition: current.nightRateAddition,
        legalHolidayRate: current.legalHolidayRate,
        monthly60hOtRate: current.monthly60hOtRate,
        monthly60hThresholdMin: current.monthly60hThresholdMin,
        complianceMode: current.complianceMode,
      }
    : {
        validFrom: tomorrow,
        dailyOtThresholdMin: 480,
        weeklyOtThresholdMin: 2400,
        otRate: 1.25,
        nightStartTime: '22:00',
        nightEndTime: '05:00',
        nightRateAddition: 0.25,
        legalHolidayRate: 1.35,
        monthly60hOtRate: 1.5,
        monthly60hThresholdMin: 3600,
        complianceMode: true,
      };

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader
        user={session}
        active="admin-work-rules"
        pendingApprovalCount={myPending}
      />

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">労働ルール 新規予約</h1>
          <Link
            href="/admin/work-rules"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← タイムラインに戻る
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">バージョン情報</CardTitle>
            <p className="text-xs text-muted-foreground">
              現行ルールの値を初期値にしています。変更したい項目だけ編集してください。
            </p>
          </CardHeader>
          <CardContent>
            <WorkRuleForm initial={initial} isCreate />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
