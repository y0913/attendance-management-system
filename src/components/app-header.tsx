import Link from 'next/link';
import type { Role } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { signOutAction } from '@/app/login/actions';
import { NavDropdown, type DropdownItem } from '@/components/nav-dropdown';

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

// admin 用のヘッダー直下に出す高頻度項目。承認系は 承認 ▾ にまとめる。
const ADMIN_PRIMARY_NAV: NavItem[] = [
  { key: 'admin-dashboard', href: '/admin/dashboard', label: 'ダッシュボード' },
  { key: 'admin-attendance', href: '/admin/attendance', label: '勤怠一覧' },
];

// 「運用」グループ（月次業務系）。
const ADMIN_OPS_ITEMS: DropdownItem[] = [
  { key: 'admin-employees', href: '/admin/employees', label: '従業員' },
  { key: 'admin-closings', href: '/admin/closings', label: '月次締め' },
  { key: 'admin-overtime-alerts', href: '/admin/overtime-alerts', label: '36協定' },
  { key: 'admin-reports', href: '/admin/reports', label: 'レポート' },
];

// 「設定」グループ（低頻度、システム設定系）。
const ADMIN_SETTINGS_ITEMS: DropdownItem[] = [
  { key: 'admin-work-rules', href: '/admin/work-rules', label: '労働ルール' },
  { key: 'admin-company-settings', href: '/admin/company-settings', label: '会社設定' },
  { key: 'admin-audit-logs', href: '/admin/audit-logs', label: '監査ログ' },
];

interface AppHeaderProps {
  user: { name: string; role: Role };
  active: NavKey;
  pendingApprovalCount?: number;
}

const renderNavLink = (item: NavItem, isActive: boolean) => (
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

export function AppHeader({
  user,
  active,
  pendingApprovalCount,
}: AppHeaderProps) {
  const isAdmin = user.role === 'admin';
  const showTeamNav = user.role === 'approver' || isAdmin;

  // 承認系は admin の場合「承認 ▾」dropdown にまとめる。
  // approver の場合は項目数が少ない（1 件）のでインラインのままにする。
  const teamNav: NavItem[] = showTeamNav
    ? isAdmin
      ? [
          { key: 'team-attendance', href: '/team/attendance', label: '部下の勤怠' },
        ]
      : [
          { key: 'team-attendance', href: '/team/attendance', label: '部下の勤怠' },
          {
            key: 'team-approvals',
            href: '/team/approvals',
            label: '承認',
            badge: pendingApprovalCount,
          },
        ]
    : [];

  const adminApprovalsItems: DropdownItem[] = [
    {
      key: 'team-approvals',
      href: '/team/approvals',
      label: '部下の承認',
      badge: pendingApprovalCount,
    },
    { key: 'admin-approvals', href: '/admin/approvals', label: '全社の承認' },
  ];

  const homeHref = isAdmin ? '/admin/dashboard' : '/clock';

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <Link
          href={homeHref}
          className="text-base font-bold tracking-tight whitespace-nowrap hover:opacity-80"
        >
          勤怠管理システム
        </Link>

        <nav className="flex flex-1 flex-wrap items-center gap-1 text-sm">
          {PERSONAL_NAV.map((item) => renderNavLink(item, item.key === active))}
          {teamNav.map((item) => renderNavLink(item, item.key === active))}
          {isAdmin && (
            <>
              {ADMIN_PRIMARY_NAV.map((item) =>
                renderNavLink(item, item.key === active),
              )}
              <NavDropdown
                label="承認"
                items={adminApprovalsItems}
                activeKey={active}
                badge={pendingApprovalCount}
              />
              <NavDropdown
                label="運用"
                items={ADMIN_OPS_ITEMS}
                activeKey={active}
              />
              <NavDropdown
                label="設定"
                items={ADMIN_SETTINGS_ITEMS}
                activeKey={active}
              />
            </>
          )}
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
