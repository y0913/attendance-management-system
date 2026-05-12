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
  listCorrectionRequests,
  STATUS_BADGE_CLASS as CORRECTION_BADGE,
  STATUS_LABEL as CORRECTION_LABEL,
  type ClockSnapshot,
  type MockClockCorrectionRequest,
} from '@/lib/data/clock-corrections';
import {
  LEAVE_STATUS_BADGE_CLASS,
  LEAVE_STATUS_LABEL,
  LEAVE_TYPE_LABEL,
  listLeaveRequests,
  type MockLeaveRequest,
} from '@/lib/data/leave-requests';
import { countPendingForApprover } from '@/lib/data/pending-approvals';
import { getMockSession } from '@/lib/data/session';
import { listAllUsers } from '@/lib/data/users';
import { WithdrawButton } from './withdraw-button';

const fmtDateTime = (d: Date) =>
  formatInTimeZone(d, JST_TIMEZONE, 'yyyy年MM月dd日 HH:mm');

const dash = (s: string | null) => s ?? '-';

interface UnifiedRow {
  id: string;
  kind: 'correction' | 'leave';
  status: string;
  badge: { label: string; class: string };
  typeLabel: string;
  targetLabel: React.ReactNode;
  contentNode: React.ReactNode;
  reason: string;
  submittedAt: Date;
  approverName: string;
}

const renderCorrectionDiff = (
  before: ClockSnapshot,
  after: ClockSnapshot,
): React.ReactNode => {
  const items: string[] = [];
  if (before.clockIn !== after.clockIn)
    items.push(`出勤 ${dash(before.clockIn)} → ${dash(after.clockIn)}`);
  if (before.clockOut !== after.clockOut)
    items.push(`退勤 ${dash(before.clockOut)} → ${dash(after.clockOut)}`);
  if (before.breakStart !== after.breakStart)
    items.push(`休憩開始 ${dash(before.breakStart)} → ${dash(after.breakStart)}`);
  if (before.breakEnd !== after.breakEnd)
    items.push(`休憩終了 ${dash(before.breakEnd)} → ${dash(after.breakEnd)}`);
  if (items.length === 0) {
    return <span className="text-muted-foreground">変更なし</span>;
  }
  return (
    <div className="flex flex-col gap-0.5 font-mono text-xs">
      {items.map((it, i) => (
        <div key={i}>{it}</div>
      ))}
    </div>
  );
};

const correctionToRow = (
  r: MockClockCorrectionRequest,
  userNameById: Map<string, string>,
): UnifiedRow => ({
  id: r.id,
  kind: 'correction',
  status: r.status,
  badge: {
    label: CORRECTION_LABEL[r.status],
    class: CORRECTION_BADGE[r.status],
  },
  typeLabel: '打刻修正',
  targetLabel: (
    <Link
      href={`/attendance/${r.targetDate}?ym=${r.targetDate.slice(0, 7)}`}
      className="font-mono text-primary underline-offset-4 hover:underline"
    >
      {r.targetDate}
    </Link>
  ),
  contentNode: renderCorrectionDiff(r.beforePayload, r.afterPayload),
  reason: r.reason,
  submittedAt: r.submittedAt,
  approverName: r.currentApproverId
    ? userNameById.get(r.currentApproverId) ?? '-'
    : '-',
});

const leaveToRow = (
  r: MockLeaveRequest,
  userNameById: Map<string, string>,
): UnifiedRow => ({
  id: r.id,
  kind: 'leave',
  status: r.status,
  badge: {
    label: LEAVE_STATUS_LABEL[r.status],
    class: LEAVE_STATUS_BADGE_CLASS[r.status],
  },
  typeLabel: LEAVE_TYPE_LABEL[r.leaveType],
  targetLabel: (
    <span className="font-mono text-xs">
      {r.startDate === r.endDate ? r.startDate : `${r.startDate} 〜 ${r.endDate}`}
    </span>
  ),
  contentNode: (
    <span className="flex items-center gap-1 text-xs">
      {r.dayUnit === 'half' && (
        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
          半日
        </span>
      )}
      <span>
        <span className="font-mono font-semibold">{r.days}</span> 日消化
      </span>
    </span>
  ),
  reason: r.reason,
  submittedAt: r.submittedAt,
  approverName: r.currentApproverId
    ? userNameById.get(r.currentApproverId) ?? '-'
    : '-',
});

export default async function ApplicationsPage() {
  const session = await getMockSession();
  if (!session) redirect('/login');

  const allUsers = await listAllUsers(session.companyId);
  const userNameById = new Map(allUsers.map((u) => [u.id, u.name]));
  const corrections = (await listCorrectionRequests(session.id)).map((r) =>
    correctionToRow(r, userNameById),
  );
  const leaves = (await listLeaveRequests(session.id)).map((r) =>
    leaveToRow(r, userNameById),
  );

  const rows: UnifiedRow[] = [...corrections, ...leaves].sort(
    (a, b) => b.submittedAt.getTime() - a.submittedAt.getTime(),
  );

  const pendingCount = await countPendingForApprover(session.id);

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader
        user={session}
        active="applications"
        pendingApprovalCount={pendingCount}
      />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl">自分の申請履歴</CardTitle>
              <p className="text-sm text-muted-foreground">
                打刻修正申請は勤怠詳細ページから、有給申請は右のボタンから
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/applications/new/leave">+ 有給を申請</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                申請履歴はまだありません
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">状態</th>
                      <th className="px-3 py-2 font-medium">種別</th>
                      <th className="px-3 py-2 font-medium">対象日</th>
                      <th className="px-3 py-2 font-medium">内容</th>
                      <th className="px-3 py-2 font-medium">理由</th>
                      <th className="px-3 py-2 font-medium">申請日時</th>
                      <th className="px-3 py-2 font-medium">承認者</th>
                      <th className="px-3 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={r.id}
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
                        <td className="px-3 py-3">{r.targetLabel}</td>
                        <td className="px-3 py-3">{r.contentNode}</td>
                        <td
                          className="max-w-[260px] truncate px-3 py-3"
                          title={r.reason}
                        >
                          {r.reason}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                          {fmtDateTime(r.submittedAt)}
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">
                          {r.approverName}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {r.status === 'submitted' ? (
                            <WithdrawButton type={r.kind} id={r.id} />
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
