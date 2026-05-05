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
import { signOutAction } from '@/app/login/actions';
import { LEAVE_REASON_MAX_LENGTH } from '@/lib/mock/leave-requests';
import { getMockSession } from '@/lib/mock/session';
import { LeaveForm } from './leave-form';

const ROLE_LABEL: Record<string, string> = {
  admin: '管理者',
  approver: '承認者',
  general: '一般',
};

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

  return (
    <div className="min-h-screen bg-muted">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
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
                className="rounded-md px-3 py-1.5 hover:bg-muted"
              >
                勤怠
              </Link>
              <Link
                href="/applications"
                className="rounded-md bg-muted px-3 py-1.5 font-medium"
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
