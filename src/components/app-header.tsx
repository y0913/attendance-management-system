import Link from 'next/link';
import type { Role } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { signOutAction } from '@/app/login/actions';

const ROLE_LABEL: Record<Role, string> = {
  admin: '管理者',
  approver: '承認者',
  general: '一般',
};

export type NavKey =
  | 'clock'
  | 'attendance'
  | 'applications'
  | 'leave-balance'
  | 'team-attendance'
  | 'team-approvals'
  | 'admin-dashboard'
  | 'admin-approvals'
  | 'admin-employees'
  | 'admin-attendance'
  | 'admin-work-rules'
  | 'admin-company-settings'
  | 'admin-closings'
  | 'admin-overtime-alerts'
  | 'admin-reports'
  | 'admin-audit-logs';

interface NavItem {
  key: NavKey;
  href: string;
  label: string;
  badge?: number;
}

const PERSONAL_NAV: NavItem[] = [
  { key: 'clock', href: '/clock', label: '打刻' },
  { key: 'attendance', href: '/attendance', label: '勤怠' },
  { key: 'applications', href: '/applications', label: '申請' },
  { key: 'leave-balance', href: '/leave-balance', label: '有給' },
];

interface AppHeaderProps {
  user: { name: string; role: Role };
  active: NavKey;
  pendingApprovalCount?: number;
}

export function AppHeader({
  user,
  active,
  pendingApprovalCount,
}: AppHeaderProps) {
  const showTeamNav = user.role === 'approver' || user.role === 'admin';
  const teamNav: NavItem[] = showTeamNav
    ? [
        { key: 'team-attendance', href: '/team/attendance', label: '部下の勤怠' },
        {
          key: 'team-approvals',
          href: '/team/approvals',
          label: '承認',
          badge: pendingApprovalCount,
        },
      ]
    : [];
  const adminNav: NavItem[] =
    user.role === 'admin'
      ? [
          {
            key: 'admin-dashboard',
            href: '/admin/dashboard',
            label: 'ダッシュボード',
          },
          {
            key: 'admin-approvals',
            href: '/admin/approvals',
            label: '全社の承認',
          },
          {
            key: 'admin-employees',
            href: '/admin/employees',
            label: '従業員',
          },
          {
            key: 'admin-attendance',
            href: '/admin/attendance',
            label: '勤怠一覧',
          },
          {
            key: 'admin-work-rules',
            href: '/admin/work-rules',
            label: '労働ルール',
          },
          {
            key: 'admin-company-settings',
            href: '/admin/company-settings',
            label: '会社設定',
          },
          {
            key: 'admin-closings',
            href: '/admin/closings',
            label: '月次締め',
          },
          {
            key: 'admin-overtime-alerts',
            href: '/admin/overtime-alerts',
            label: '36協定',
          },
          {
            key: 'admin-reports',
            href: '/admin/reports',
            label: 'レポート',
          },
          {
            key: 'admin-audit-logs',
            href: '/admin/audit-logs',
            label: '監査ログ',
          },
        ]
      : [];
  const items = [...PERSONAL_NAV, ...teamNav, ...adminNav];

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <p className="text-base font-bold tracking-tight whitespace-nowrap">
          勤怠管理システム
        </p>

        <nav className="flex flex-1 flex-wrap items-center gap-1 text-sm">
          {items.map((item) => {
            const isActive = item.key === active;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`rounded-md px-3 py-1.5 ${
                  isActive ? 'bg-muted font-medium' : 'hover:bg-muted'
                }`}
              >
                {item.label}
                {item.badge != null && item.badge > 0 && (
                  <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 whitespace-nowrap">
          <div className="text-right leading-tight">
            <p className="text-sm font-semibold">{user.name}</p>
            <p className="text-xs text-muted-foreground">
              {ROLE_LABEL[user.role]}
            </p>
          </div>
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm">
              サインアウト
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
