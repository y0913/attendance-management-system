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
  type ClockSnapshot,
} from '@/lib/data/clock-corrections';
import {
  LEAVE_STATUS_BADGE_CLASS,
  LEAVE_STATUS_LABEL,
  LEAVE_TYPE_LABEL,
} from '@/lib/data/leave-requests';
import {
  countAllPending,
  countPendingForApprover,
  listAllPending,
  type PendingItem,
} from '@/lib/data/pending-approvals';
import { getMockSession } from '@/lib/data/session';
import { listAllUsers } from '@/lib/data/users';

const fmtDateTime = (d: Date) =>
  formatInTimeZone(d, JST_TIMEZONE, 'yyyy-MM-dd HH:mm');

const dash = (s: string | null) => s ?? '-';

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
    items.push(
      `休憩開始 ${dash(before.breakStart)} → ${dash(after.breakStart)}`,
    );
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

interface InboxRow {
  key: string;
  detailHref: string;
  badge: { label: string; class: string };
  typeLabel: string;
  requesterName: string;
  approverName: string;
  targetLabel: React.ReactNode;
  contentNode: React.ReactNode;
  reason: string;
  submittedAt: Date;
}

const itemToRow = (
  item: PendingItem,
  userNameById: Map<string, string>,
): InboxRow => {
  const requesterName = userNameById.get(item.request.requesterId) ?? '-';
  const approverName = item.request.currentApproverId
    ? userNameById.get(item.request.currentApproverId) ?? '-'
    : '-';

  if (item.kind === 'correction') {
    const r = item.request;
    return {
      key: `correction:${r.id}`,
      detailHref: `/team/approvals/correction/${r.id}`,
      badge: {
        label: CORRECTION_LABEL[r.status],
        class: CORRECTION_BADGE[r.status],
      },
      typeLabel: '打刻修正',
      requesterName,
      approverName,
      targetLabel: <span className="font-mono text-xs">{r.targetDate}</span>,
      contentNode: renderCorrectionDiff(r.beforePayload, r.afterPayload),
      reason: r.reason,
      submittedAt: r.submittedAt,
    };
  }

  const r = item.request;
  return {
    key: `leave:${r.id}`,
    detailHref: `/team/approvals/leave/${r.id}`,
    badge: {
      label: LEAVE_STATUS_LABEL[r.status],
      class: LEAVE_STATUS_BADGE_CLASS[r.status],
    },
    typeLabel: LEAVE_TYPE_LABEL[r.leaveType],
    requesterName,
    approverName,
    targetLabel: (
      <span className="font-mono text-xs">
        {r.startDate === r.endDate
          ? r.startDate
          : `${r.startDate} 〜 ${r.endDate}`}
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
  };
};

export default async function AdminApprovalsPage() {
  const session = await getMockSession();
  if (!session) redirect('/login');
  if (session.role !== 'admin') redirect('/clock');

  const items = await listAllPending(session.companyId);
  const allUsers = await listAllUsers(session.companyId);
  const userNameById = new Map(allUsers.map((u) => [u.id, u.name]));
  const rows = items.map((item) => itemToRow(item, userNameById));
  const totalPending = await countAllPending(session.companyId);
  const myPending = await countPendingForApprover(session.id);

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader
        user={session}
        active="admin-approvals"
        pendingApprovalCount={myPending}
      />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              全社の承認待ち
              {totalPending > 0 && (
                <span className="ml-2 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white">
                  {totalPending}
                </span>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              承認者の割り当てに関わらず、社内すべての未対応申請を表示します。admin
              として直接承認・却下することも可能です。
            </p>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                未対応の申請はありません
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">状態</th>
                      <th className="px-3 py-2 font-medium">種別</th>
                      <th className="px-3 py-2 font-medium">申請者</th>
                      <th className="px-3 py-2 font-medium">承認者</th>
                      <th className="px-3 py-2 font-medium">対象日</th>
                      <th className="px-3 py-2 font-medium">内容</th>
                      <th className="px-3 py-2 font-medium">理由</th>
                      <th className="px-3 py-2 font-medium">申請日時</th>
                      <th className="px-3 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
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
                        <td className="px-3 py-3 text-xs text-muted-foreground">
                          {r.approverName}
                        </td>
                        <td className="px-3 py-3">{r.targetLabel}</td>
                        <td className="px-3 py-3">{r.contentNode}</td>
                        <td
                          className="max-w-[220px] truncate px-3 py-3"
                          title={r.reason}
                        >
                          {r.reason}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                          {fmtDateTime(r.submittedAt)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Link
                            href={r.detailHref}
                            className="text-xs text-primary underline-offset-4 hover:underline"
                          >
                            詳細 →
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
