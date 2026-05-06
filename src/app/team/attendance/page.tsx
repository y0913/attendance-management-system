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
import { findSubordinates } from '@/lib/mock/users';

const ROLE_LABEL: Record<string, string> = {
  admin: '管理者',
  approver: '承認者',
  general: '一般',
};

const fmtDate = (d: Date) => formatInTimeZone(d, JST_TIMEZONE, 'yyyy-MM-dd');

export default async function TeamAttendancePage() {
  const session = await getMockSession();
  if (!session) redirect('/login');
  if (session.role !== 'approver' && session.role !== 'admin') {
    redirect('/clock');
  }

  const subordinates = findSubordinates(session.id);
  const pendingCount = countPendingForApprover(session.id);

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader
        user={session}
        active="team-attendance"
        pendingApprovalCount={pendingCount}
      />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">部下の勤怠</CardTitle>
            <p className="text-sm text-muted-foreground">
              自分が承認者として割り当てられている部下の一覧。名前をクリックして勤怠を確認できます。
            </p>
          </CardHeader>
          <CardContent>
            {subordinates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                割り当てられている部下はいません
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">名前</th>
                      <th className="px-3 py-2 font-medium">メール</th>
                      <th className="px-3 py-2 font-medium">ロール</th>
                      <th className="px-3 py-2 font-medium">入社日</th>
                      <th className="px-3 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {subordinates.map((u) => (
                      <tr
                        key={u.id}
                        className="border-b align-middle last:border-b-0"
                      >
                        <td className="px-3 py-3 font-medium">
                          <Link
                            href={`/team/attendance/${u.id}`}
                            className="text-primary underline-offset-4 hover:underline"
                          >
                            {u.name}
                          </Link>
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                          {u.email}
                        </td>
                        <td className="px-3 py-3 text-xs">
                          {ROLE_LABEL[u.role]}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs">
                          {fmtDate(u.hiredAt)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Link
                            href={`/team/attendance/${u.id}`}
                            className="text-xs text-muted-foreground hover:underline"
                          >
                            勤怠を見る →
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
