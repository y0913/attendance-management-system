import { formatInTimeZone } from 'date-fns-tz';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
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
  findCorrectionById,
  STATUS_BADGE_CLASS as CORRECTION_BADGE,
  STATUS_LABEL as CORRECTION_LABEL,
  type ClockSnapshot,
} from '@/lib/mock/clock-corrections';
import {
  findLeaveRequestById,
  LEAVE_STATUS_BADGE_CLASS,
  LEAVE_STATUS_LABEL,
  LEAVE_TYPE_LABEL,
} from '@/lib/mock/leave-requests';
import { countPendingForApprover } from '@/lib/mock/pending-approvals';
import { getMockSession } from '@/lib/mock/session';
import { findMockUserById } from '@/lib/mock/users';

const fmtDateTime = (d: Date) =>
  formatInTimeZone(d, JST_TIMEZONE, 'yyyy-MM-dd HH:mm');

const dash = (s: string | null) => s ?? '-';

const isValidType = (s: string): s is 'correction' | 'leave' =>
  s === 'correction' || s === 'leave';

const SnapshotTable = ({
  before,
  after,
}: {
  before: ClockSnapshot;
  after: ClockSnapshot;
}) => (
  <table className="w-full text-sm">
    <thead>
      <tr className="border-b text-left text-muted-foreground">
        <th className="px-3 py-2 font-medium">項目</th>
        <th className="px-3 py-2 font-medium">変更前</th>
        <th className="px-3 py-2 font-medium">変更後</th>
      </tr>
    </thead>
    <tbody className="font-mono text-xs">
      {[
        ['出勤', before.clockIn, after.clockIn],
        ['退勤', before.clockOut, after.clockOut],
        ['休憩開始', before.breakStart, after.breakStart],
        ['休憩終了', before.breakEnd, after.breakEnd],
      ].map(([label, b, a]) => {
        const changed = b !== a;
        return (
          <tr
            key={label as string}
            className={`border-b last:border-b-0 ${changed ? 'bg-amber-50' : ''}`}
          >
            <td className="px-3 py-2 font-sans">{label}</td>
            <td className="px-3 py-2">{dash(b as string | null)}</td>
            <td className="px-3 py-2">{dash(a as string | null)}</td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

const ActionPlaceholder = () => (
  <div className="flex flex-col gap-3 rounded-md border border-dashed bg-muted/40 p-4">
    <p className="text-xs text-muted-foreground">
      承認アクションは次イテレーションで実装予定です（現在は骨組み）。
    </p>
    <div className="flex flex-wrap gap-2">
      <Button type="button" disabled>
        承認
      </Button>
      <Button type="button" variant="outline" disabled>
        差戻し
      </Button>
      <Button type="button" variant="outline" disabled>
        却下
      </Button>
    </div>
  </div>
);

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const session = await getMockSession();
  if (!session) redirect('/login');
  if (session.role !== 'approver' && session.role !== 'admin') {
    redirect('/clock');
  }

  const { type, id } = await params;
  if (!isValidType(type)) notFound();

  const pendingCount = countPendingForApprover(session.id);

  if (type === 'correction') {
    const r = findCorrectionById(id);
    if (!r) notFound();
    if (session.role !== 'admin' && r.currentApproverId !== session.id) {
      redirect('/team/approvals');
    }
    const requester = findMockUserById(r.requesterId);

    return (
      <div className="min-h-screen bg-muted">
        <AppHeader
          user={session}
          active="team-approvals"
          pendingApprovalCount={pendingCount}
        />

        <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
          <div>
            <Link
              href="/team/approvals"
              className="text-xs text-muted-foreground hover:underline"
            >
              ← 承認待ち一覧へ
            </Link>
            <div className="mt-2 flex items-center gap-3">
              <h1 className="text-xl font-semibold">打刻修正申請</h1>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CORRECTION_BADGE[r.status]}`}
              >
                {CORRECTION_LABEL[r.status]}
              </span>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">申請内容</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              <dl className="grid grid-cols-[8rem_1fr] gap-y-2">
                <dt className="text-muted-foreground">申請者</dt>
                <dd>{requester?.name ?? '-'}</dd>
                <dt className="text-muted-foreground">対象日</dt>
                <dd className="font-mono">{r.targetDate}</dd>
                <dt className="text-muted-foreground">申請日時</dt>
                <dd className="font-mono text-xs">
                  {fmtDateTime(r.submittedAt)}
                </dd>
                <dt className="text-muted-foreground">理由</dt>
                <dd className="whitespace-pre-wrap">{r.reason}</dd>
              </dl>
              <div>
                <p className="mb-2 text-xs text-muted-foreground">変更内容</p>
                <div className="overflow-x-auto rounded-md border">
                  <SnapshotTable
                    before={r.beforePayload}
                    after={r.afterPayload}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">承認操作</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionPlaceholder />
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // leave
  const r = findLeaveRequestById(id);
  if (!r) notFound();
  if (session.role !== 'admin' && r.currentApproverId !== session.id) {
    redirect('/team/approvals');
  }
  const requester = findMockUserById(r.requesterId);

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader
        user={session}
        active="team-approvals"
        pendingApprovalCount={pendingCount}
      />

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
        <div>
          <Link
            href="/team/approvals"
            className="text-xs text-muted-foreground hover:underline"
          >
            ← 承認待ち一覧へ
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-xl font-semibold">
              {LEAVE_TYPE_LABEL[r.leaveType]} 申請
            </h1>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${LEAVE_STATUS_BADGE_CLASS[r.status]}`}
            >
              {LEAVE_STATUS_LABEL[r.status]}
            </span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">申請内容</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <dl className="grid grid-cols-[8rem_1fr] gap-y-2">
              <dt className="text-muted-foreground">申請者</dt>
              <dd>{requester?.name ?? '-'}</dd>
              <dt className="text-muted-foreground">期間</dt>
              <dd className="font-mono">
                {r.startDate === r.endDate
                  ? r.startDate
                  : `${r.startDate} 〜 ${r.endDate}`}
              </dd>
              <dt className="text-muted-foreground">消化日数</dt>
              <dd className="font-mono">{r.days} 日</dd>
              <dt className="text-muted-foreground">申請日時</dt>
              <dd className="font-mono text-xs">
                {fmtDateTime(r.submittedAt)}
              </dd>
              <dt className="text-muted-foreground">理由</dt>
              <dd className="whitespace-pre-wrap">{r.reason}</dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">承認操作</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionPlaceholder />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
