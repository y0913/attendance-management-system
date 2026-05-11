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
import { countPendingForApprover } from '@/lib/data/pending-approvals';
import { getMockSession } from '@/lib/data/session';
import { listAllUsers } from '@/lib/data/users';

const ROLE_LABEL: Record<string, string> = {
  admin: '管理者',
  approver: '承認者',
  general: '一般',
};

const EMPLOYMENT_LABEL: Record<string, string> = {
  monthly: '月給',
  hourly: '時給',
};

const fmtDate = (d: Date) => formatInTimeZone(d, JST_TIMEZONE, 'yyyy-MM-dd');

const fmtSalary = (n: number | null): string => {
  if (n == null) return '-';
  return `¥${n.toLocaleString()}`;
};

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const session = await getMockSession();
  if (!session) redirect('/login');
  if (session.role !== 'admin') redirect('/clock');

  const sp = await searchParams;
  const showInactive = sp.show === 'all';
  const allUsers = await listAllUsers(session.companyId);
  const userById = new Map(allUsers.map((u) => [u.id, u]));
  const visible = showInactive
    ? allUsers
    : allUsers.filter((u) => u.deactivatedAt === null);
  const myPending = await countPendingForApprover(session.id);

  const activeCount = allUsers.filter((u) => u.deactivatedAt === null).length;
  const inactiveCount = allUsers.length - activeCount;

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader
        user={session}
        active="admin-employees"
        pendingApprovalCount={myPending}
      />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl">従業員管理</CardTitle>
              <p className="text-sm text-muted-foreground">
                有効 {activeCount} 名 ・ 無効 {inactiveCount} 名
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link
                  href={
                    showInactive
                      ? '/admin/employees'
                      : '/admin/employees?show=all'
                  }
                >
                  {showInactive ? '有効のみ表示' : '無効も表示'}
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/admin/employees/new">+ 新規追加</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">名前</th>
                    <th className="px-3 py-2 font-medium">メール</th>
                    <th className="px-3 py-2 font-medium">ロール</th>
                    <th className="px-3 py-2 font-medium">承認者</th>
                    <th className="px-3 py-2 font-medium">雇用形態</th>
                    <th className="px-3 py-2 font-medium">基本給</th>
                    <th className="px-3 py-2 font-medium">入社日</th>
                    <th className="px-3 py-2 font-medium">状態</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((u) => {
                    const inactive = u.deactivatedAt !== null;
                    const manager = u.managerId
                      ? userById.get(u.managerId) ?? null
                      : null;
                    return (
                      <tr
                        key={u.id}
                        className={`border-b align-middle last:border-b-0 ${inactive ? 'text-muted-foreground' : ''}`}
                      >
                        <td className="px-3 py-3 font-medium">
                          <Link
                            href={`/admin/employees/${u.id}`}
                            className="text-primary underline-offset-4 hover:underline"
                          >
                            {u.name}
                          </Link>
                        </td>
                        <td className="px-3 py-3 font-mono text-xs">
                          {u.email}
                        </td>
                        <td className="px-3 py-3 text-xs">
                          {ROLE_LABEL[u.role]}
                        </td>
                        <td className="px-3 py-3 text-xs">
                          {manager?.name ?? '-'}
                        </td>
                        <td className="px-3 py-3 text-xs">
                          {EMPLOYMENT_LABEL[u.employmentType]}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs">
                          {fmtSalary(u.baseSalary)}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs">
                          {fmtDate(u.hiredAt)}
                        </td>
                        <td className="px-3 py-3">
                          {inactive ? (
                            <span className="inline-flex items-center rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700">
                              無効
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
                              有効
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Link
                            href={`/admin/employees/${u.id}`}
                            className="text-xs text-muted-foreground hover:underline"
                          >
                            編集 →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
