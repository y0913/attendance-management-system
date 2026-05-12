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
import { countPendingForApprover } from '@/lib/data/pending-approvals';
import { getMockSession } from '@/lib/data/session';
import { findMockUserById, listAllUsers } from '@/lib/data/users';
import { EmployeeForm } from '../employee-form';
import { DeactivationForm } from './deactivation-form';
import { ForceLogoutForm } from './force-logout-form';

const ROLE_LABEL: Record<string, string> = {
  admin: '管理者',
  approver: '承認者',
  general: '一般',
};

const fmtDate = (d: Date) => formatInTimeZone(d, JST_TIMEZONE, 'yyyy-MM-dd');

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getMockSession();
  if (!session) redirect('/login');
  if (session.role !== 'admin') redirect('/clock');

  const { id } = await params;
  const target = await findMockUserById(id);
  if (!target || target.companyId !== session.companyId) notFound();

  const myPending = await countPendingForApprover(session.id);
  const managerCandidates = (await listAllUsers(session.companyId))
    .filter((u) => u.id !== target.id) // 自分自身を承認者候補から除外
    .filter((u) => u.deactivatedAt === null)
    .filter((u) => u.role === 'admin' || u.role === 'approver')
    .map((u) => ({ id: u.id, name: u.name, role: ROLE_LABEL[u.role] }));

  const isSelf = target.id === session.id;
  const isDeactivated = target.deactivatedAt !== null;

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader
        user={session}
        active="admin-employees"
        pendingApprovalCount={myPending}
      />

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
        <div>
          <Link
            href="/admin/employees"
            className="text-xs text-muted-foreground hover:underline"
          >
            ← 一覧に戻る
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-xl font-semibold">{target.name}</h1>
            {isSelf && (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900">
                自分
              </span>
            )}
            {isDeactivated && (
              <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700">
                無効
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            ID: <span className="font-mono">{target.id}</span>
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">基本情報</CardTitle>
            {isSelf && (
              <p className="text-xs text-rose-600">
                自分自身は admin 以外のロールに変更できません
              </p>
            )}
          </CardHeader>
          <CardContent>
            <EmployeeForm
              initial={{
                id: target.id,
                name: target.name,
                email: target.email,
                role: target.role,
                managerId: target.managerId,
                employmentType: target.employmentType,
                hiredAt: target.hiredAt ? fmtDate(target.hiredAt) : '',
                baseSalary: target.baseSalary,
              }}
              managerCandidates={managerCandidates}
              isCreate={false}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isDeactivated ? '再有効化' : '無効化'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DeactivationForm
              id={target.id}
              isDeactivated={isDeactivated}
              isSelf={isSelf}
            />
          </CardContent>
        </Card>

        {!isDeactivated && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">セッション失効</CardTitle>
            </CardHeader>
            <CardContent>
              <ForceLogoutForm id={target.id} isSelf={isSelf} />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
