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
import {
  listCorrectionRequestsForUserDate,
  STATUS_BADGE_CLASS as CORRECTION_BADGE,
  STATUS_LABEL as CORRECTION_LABEL,
} from '@/lib/mock/clock-corrections';
import { getDailyNote } from '@/lib/mock/daily-notes';
import { countPendingForApprover } from '@/lib/mock/pending-approvals';
import { getMockSession } from '@/lib/mock/session';
import { listClocksForDate } from '@/lib/mock/time-clocks';
import { findMockUserById, isManagerOf } from '@/lib/mock/users';

const TYPE_LABEL: Record<string, string> = {
  clock_in: '出勤',
  clock_out: '退勤',
  break_start: '休憩開始',
  break_end: '休憩終了',
};

const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isValidYm = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

const fmtTime = (d: Date) => formatInTimeZone(d, JST_TIMEZONE, 'HH:mm');
const fmtDateTime = (d: Date) =>
  formatInTimeZone(d, JST_TIMEZONE, 'yyyy-MM-dd HH:mm');

const fmtDateHeading = (jstDate: string): string => {
  const [y, m, d] = jstDate.split('-');
  const wd = formatInTimeZone(
    new Date(`${jstDate}T00:00:00+09:00`),
    JST_TIMEZONE,
    'EEE',
  );
  return `${y}年${Number(m)}月${Number(d)}日（${wd}）`;
};

export default async function TeamAttendanceDayPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string; date: string }>;
  searchParams: Promise<{ ym?: string }>;
}) {
  const session = await getMockSession();
  if (!session) redirect('/login');
  if (session.role !== 'approver' && session.role !== 'admin') {
    redirect('/clock');
  }

  const { userId, date: jstDate } = await params;
  if (!isValidDate(jstDate)) notFound();

  const target = await findMockUserById(userId);
  if (!target) notFound();

  if (session.role !== 'admin' && !(await isManagerOf(session.id, userId))) {
    redirect('/team/attendance');
  }

  const sp = await searchParams;
  const backYm =
    sp.ym && isValidYm(sp.ym) ? sp.ym : jstDate.slice(0, 7);
  const backHref = `/team/attendance/${userId}?ym=${backYm}`;

  const shiftDate = (s: string, delta: number): string => {
    const base = new Date(`${s}T00:00:00+09:00`);
    base.setUTCDate(base.getUTCDate() + delta);
    return formatInTimeZone(base, JST_TIMEZONE, 'yyyy-MM-dd');
  };
  const prevDate = shiftDate(jstDate, -1);
  const nextDate = shiftDate(jstDate, 1);
  const prevHref = `/team/attendance/${userId}/${prevDate}?ym=${prevDate.slice(0, 7)}`;
  const nextHref = `/team/attendance/${userId}/${nextDate}?ym=${nextDate.slice(0, 7)}`;

  const dayDate = new Date(`${jstDate}T00:00:00+09:00`);
  const clocks = await listClocksForDate(target.id, dayDate);
  const note = await getDailyNote(target.id, jstDate);
  const corrections = listCorrectionRequestsForUserDate(target.id, jstDate);
  const myPending = countPendingForApprover(session.id);

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader
        user={session}
        active="team-attendance"
        pendingApprovalCount={myPending}
      />

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
        <div>
          <Link
            href={backHref}
            className="text-xs text-muted-foreground hover:underline"
          >
            ← {target.name} の月次勤怠へ
          </Link>
          <div className="mt-1 flex flex-row items-center justify-between gap-3">
            <h1 className="text-xl font-semibold">
              {target.name} ・ {fmtDateHeading(jstDate)}
            </h1>
            <div className="flex items-center gap-3 text-sm">
              <Link
                href={prevHref}
                className="text-muted-foreground hover:underline"
              >
                ← 前日
              </Link>
              <Link
                href={nextHref}
                className="text-muted-foreground hover:underline"
              >
                翌日 →
              </Link>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            閲覧専用。打刻の編集や業務内容の更新は本人画面からのみ可能。
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">打刻履歴</CardTitle>
          </CardHeader>
          <CardContent>
            {clocks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                打刻記録がありません
              </p>
            ) : (
              <ul className="divide-y rounded-md border bg-background">
                {clocks.map((c) => (
                  <li
                    key={c.id}
                    className="flex justify-between px-4 py-2 text-sm"
                  >
                    <span>
                      {TYPE_LABEL[c.type]}
                      {c.source === 'manual_correction' && (
                        <span className="ml-2 text-xs text-amber-700">
                          （修正反映）
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {fmtTime(c.occurredAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">業務内容</CardTitle>
            {note && (
              <p className="text-xs text-muted-foreground">
                最終更新: {fmtDateTime(note.updatedAt)}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {note ? (
              <p className="whitespace-pre-wrap text-sm">{note.content}</p>
            ) : (
              <p className="text-sm text-muted-foreground">未入力</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">打刻修正申請</CardTitle>
            <p className="text-xs text-muted-foreground">
              この日付に対する {target.name} の打刻修正申請（過去・現在）
            </p>
          </CardHeader>
          <CardContent>
            {corrections.length === 0 ? (
              <p className="text-sm text-muted-foreground">申請はありません</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {corrections.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 rounded-md border bg-background p-3 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CORRECTION_BADGE[r.status]}`}
                      >
                        {CORRECTION_LABEL[r.status]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {fmtDateTime(r.submittedAt)} 申請
                      </span>
                    </div>
                    <Link
                      href={`/team/approvals/correction/${r.id}`}
                      className="text-xs text-primary underline-offset-4 hover:underline"
                    >
                      詳細を承認画面で開く →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
