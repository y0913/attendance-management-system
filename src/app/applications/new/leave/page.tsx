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
import { LEAVE_REASON_MAX_LENGTH } from '@/lib/mock/leave-requests';
import { countPendingForApprover } from '@/lib/mock/pending-approvals';
import { getMockSession } from '@/lib/mock/session';
import { LeaveForm } from './leave-form';

const addDays = (d: Date, n: number): Date => {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
};

export default async function NewLeaveRequestPage() {
  const session = await getMockSession();
  if (!session) redirect('/login');

  const today = new Date();
  const defaultStart = formatInTimeZone(
    addDays(today, 7),
    JST_TIMEZONE,
    'yyyy-MM-dd',
  );
  const defaultEnd = defaultStart;
  const pendingCount = await countPendingForApprover(session.id);

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader
        user={session}
        active="applications"
        pendingApprovalCount={pendingCount}
      />

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">有給休暇 新規申請</h1>
          <Link
            href="/applications"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← 申請一覧に戻る
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">申請内容</CardTitle>
            <p className="text-xs text-muted-foreground">
              連続休暇の場合は開始日と終了日を指定してください。土日は消化日数に含まれません。
            </p>
          </CardHeader>
          <CardContent>
            <LeaveForm
              reasonMaxLength={LEAVE_REASON_MAX_LENGTH}
              defaultStart={defaultStart}
              defaultEnd={defaultEnd}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
