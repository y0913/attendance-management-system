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
import { signOutAction } from '@/app/login/actions';
import {
  captureCurrentSnapshot,
  findActiveCorrection,
  REASON_MAX_LENGTH,
  STATUS_BADGE_CLASS,
  STATUS_LABEL,
} from '@/lib/mock/clock-corrections';
import {
  DAILY_NOTE_MAX_LENGTH,
  getDailyNote,
} from '@/lib/mock/daily-notes';
import { getMockSession } from '@/lib/mock/session';
import { listClocksForDate } from '@/lib/mock/time-clocks';
import { CorrectionForm } from './correction-form';
import { NoteForm } from './note-form';

const ROLE_LABEL: Record<string, string> = {
  admin: '管理者',
  approver: '承認者',
  general: '一般',
};

const TYPE_LABEL: Record<string, string> = {
  clock_in: '出勤',
  clock_out: '退勤',
  break_start: '休憩開始',
  break_end: '休憩終了',
};

const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isValidYm = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

const fmtTime = (d: Date) => formatInTimeZone(d, JST_TIMEZONE, 'HH:mm');

const fmtDateHeading = (jstDate: string): string => {
  const [y, m, d] = jstDate.split('-');
  const wd = formatInTimeZone(
    new Date(`${jstDate}T00:00:00+09:00`),
    JST_TIMEZONE,
    'EEE',
  );
  return `${y}年${Number(m)}月${Number(d)}日（${wd}）`;
};

export default async function AttendanceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ ym?: string }>;
}) {
  const session = await getMockSession();
  if (!session) redirect('/login');

  const { date: jstDate } = await params;
  if (!isValidDate(jstDate)) notFound();

  const { ym } = await searchParams;
  const backYm = ym && isValidYm(ym) ? ym : jstDate.slice(0, 7);
  const backHref = `/attendance?ym=${backYm}`;

  const dayDate = new Date(`${jstDate}T00:00:00+09:00`);
  const clocks = listClocksForDate(session.id, dayDate);
  const note = getDailyNote(session.id, jstDate);
  const activeCorrection = findActiveCorrection(session.id, jstDate);
  const currentSnapshot = captureCurrentSnapshot(session.id, jstDate);

  return (
    <div className="min-h-screen bg-muted">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-sm text-muted-foreground">勤怠管理システム</p>
              <p className="text-base font-semibold">
                {session.name}{' '}
                <span className="ml-2 text-xs text-muted-foreground">
                  {ROLE_LABEL[session.role]}
                </span>
              </p>
            </div>
            <nav className="flex gap-2 text-sm">
              <Link
                href="/clock"
                className="rounded-md px-3 py-1.5 hover:bg-muted"
              >
                打刻
              </Link>
              <Link
                href="/attendance"
                className="rounded-md bg-muted px-3 py-1.5 font-medium"
              >
                勤怠
              </Link>
              <Link
                href="/applications"
                className="rounded-md px-3 py-1.5 hover:bg-muted"
              >
                申請
              </Link>
              <Link
                href="/leave-balance"
                className="rounded-md px-3 py-1.5 hover:bg-muted"
              >
                有給
              </Link>
            </nav>
          </div>
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm">
              サインアウト
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">{fmtDateHeading(jstDate)}</h1>
          <Link
            href={backHref}
            className="text-sm text-muted-foreground hover:underline"
          >
            ← 一覧に戻る
          </Link>
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
                    <span>{TYPE_LABEL[c.type]}</span>
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
            <CardTitle className="text-base">打刻修正申請</CardTitle>
            <p className="text-xs text-muted-foreground">
              打刻の修正は申請 → 上長承認のフローが必須です
            </p>
          </CardHeader>
          <CardContent>
            {activeCorrection ? (
              <div className="flex flex-col gap-2 rounded-md border bg-muted/40 p-4 text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[activeCorrection.status]}`}
                  >
                    {STATUS_LABEL[activeCorrection.status]}
                  </span>
                  <span className="text-muted-foreground">
                    {formatInTimeZone(
                      activeCorrection.submittedAt,
                      JST_TIMEZONE,
                      'yyyy-MM-dd HH:mm',
                    )}{' '}
                    に申請
                  </span>
                </div>
                <p className="text-muted-foreground">
                  この日付には審査中の申請があります。承認または却下されるまで再申請できません。
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-xs">
                  <span>出勤: {activeCorrection.afterPayload.clockIn ?? '-'}</span>
                  <span>退勤: {activeCorrection.afterPayload.clockOut ?? '-'}</span>
                  <span>
                    休憩開始: {activeCorrection.afterPayload.breakStart ?? '-'}
                  </span>
                  <span>
                    休憩終了: {activeCorrection.afterPayload.breakEnd ?? '-'}
                  </span>
                </div>
              </div>
            ) : (
              <CorrectionForm
                jstDate={jstDate}
                current={currentSnapshot}
                reasonMaxLength={REASON_MAX_LENGTH}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">業務内容</CardTitle>
            {note && (
              <p className="text-xs text-muted-foreground">
                最終更新:{' '}
                {formatInTimeZone(
                  note.updatedAt,
                  JST_TIMEZONE,
                  'yyyy-MM-dd HH:mm',
                )}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <NoteForm
              jstDate={jstDate}
              initialContent={note?.content ?? ''}
              maxLength={DAILY_NOTE_MAX_LENGTH}
              backHref={backHref}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
