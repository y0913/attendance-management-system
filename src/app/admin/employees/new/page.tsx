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
import { listAllUsers } from '@/lib/mock/users';
import { EmployeeForm } from '../employee-form';

const ROLE_LABEL: Record<string, string> = {
  admin: '管理者',
  approver: '承認者',
  general: '一般',
};

export default async function NewEmployeePage() {
  const session = await getMockSession();
  if (!session) redirect('/login');
  if (session.role !== 'admin') redirect('/clock');

  const today = formatInTimeZone(new Date(), JST_TIMEZONE, 'yyyy-MM-dd');
  const myPending = countPendingForApprover(session.id);
  const managerCandidates = listAllUsers()
    .filter((u) => u.deactivatedAt === null)
    .filter((u) => u.role === 'admin' || u.role === 'approver')
    .map((u) => ({ id: u.id, name: u.name, role: ROLE_LABEL[u.role] }));

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader
        user={session}
        active="admin-employees"
        pendingApprovalCount={myPending}
      />

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">従業員 新規追加</h1>
          <Link
            href="/admin/employees"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← 一覧に戻る
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">基本情報</CardTitle>
          </CardHeader>
          <CardContent>
            <EmployeeForm
              initial={{
                name: '',
                email: '',
                role: 'general',
                managerId: null,
                employmentType: 'monthly',
                hiredAt: today,
                baseSalary: null,
              }}
              managerCandidates={managerCandidates}
              isCreate
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
