import { redirect } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AppHeader } from '@/components/app-header';
import { getCompany } from '@/lib/data/companies';
import { countPendingForApprover } from '@/lib/data/pending-approvals';
import { getMockSession } from '@/lib/data/session';
import { SettingsForm } from './settings-form';

export default async function CompanySettingsPage() {
  const session = await getMockSession();
  if (!session) redirect('/login');
  if (session.role !== 'admin') redirect('/clock');

  const company = await getCompany(session.companyId);
  const myPending = await countPendingForApprover(session.id);

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader
        user={session}
        active="admin-company-settings"
        pendingApprovalCount={myPending}
      />

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">会社設定</h1>
          <p className="text-sm text-muted-foreground">
            会社全体に関わる基本設定。労働ルール（法定下限チェック含む）はバージョン単位で管理されるため、
            <span className="ml-1 underline-offset-4">労働ルール設定</span>
            画面で行います。
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">基本情報</CardTitle>
          </CardHeader>
          <CardContent>
            <SettingsForm
              initial={{
                name: company.name,
                closingDay: company.closingDay,
                midMonthRateChangeStrategy: company.midMonthRateChangeStrategy,
                monthlyStandardHours: company.monthlyStandardHours,
                legalHolidayWeekday: company.legalHolidayWeekday,
              }}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
