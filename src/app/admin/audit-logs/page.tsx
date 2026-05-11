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
import {
  AUDIT_ACTION_BADGE,
  AUDIT_ACTION_LABEL,
  AUDIT_ENTITY_LABEL,
  countAuditLogs,
  listAuditLogs,
  type AuditAction,
  type AuditEntityType,
  type MockAuditLog,
} from '@/lib/data/audit-logs';
import { Pagination } from '@/components/pagination';
import { countPendingForApprover } from '@/lib/data/pending-approvals';
import { getMockSession } from '@/lib/data/session';
import { listAllUsers } from '@/lib/data/users';

const fmtDateTime = (d: Date) =>
  formatInTimeZone(d, JST_TIMEZONE, 'yyyy-MM-dd HH:mm:ss');

const isEntityType = (s: string): s is AuditEntityType =>
  s === 'work_rule_version' || s === 'company' || s === 'user';

const renderJsonPreview = (value: unknown): string => {
  if (value === null || value === undefined) return '-';
  try {
    return JSON.stringify(value, jsonReplacer, 2);
  } catch {
    return String(value);
  }
};

const jsonReplacer = (_key: string, value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();
  return value;
};

const PAGE_SIZE = 20;

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; actor?: string; page?: string }>;
}) {
  const session = await getMockSession();
  if (!session) redirect('/login');
  if (session.role !== 'admin') redirect('/clock');

  const sp = await searchParams;
  const entityFilter =
    sp.entity && isEntityType(sp.entity) ? sp.entity : null;
  const actorFilter = sp.actor ?? null;
  const pageNum = Math.max(1, Number.isFinite(Number(sp.page)) ? Number(sp.page) : 1);

  const totalCount = await countAuditLogs(session.companyId, {
    entityType: entityFilter ?? undefined,
    actorId: actorFilter ?? undefined,
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(pageNum, totalPages);

  const logs = await listAuditLogs(session.companyId, {
    entityType: entityFilter ?? undefined,
    actorId: actorFilter ?? undefined,
    limit: PAGE_SIZE,
    offset: (currentPage - 1) * PAGE_SIZE,
  });
  const myPending = await countPendingForApprover(session.id);
  const allUsers = await listAllUsers(session.companyId);
  const userNameById = new Map(allUsers.map((u) => [u.id, u.name]));

  const buildHref = (overrides: {
    entity?: AuditEntityType | null;
    actor?: string | null;
    page?: number;
  }): string => {
    const params = new URLSearchParams();
    const e = overrides.entity !== undefined ? overrides.entity : entityFilter;
    if (e) params.set('entity', e);
    const a = overrides.actor !== undefined ? overrides.actor : actorFilter;
    if (a) params.set('actor', a);
    const p = overrides.page !== undefined ? overrides.page : currentPage;
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return qs ? `/admin/audit-logs?${qs}` : '/admin/audit-logs';
  };

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader
        user={session}
        active="admin-audit-logs"
        pendingApprovalCount={myPending}
      />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <Card>
          <CardHeader className="flex flex-col gap-3">
            <div>
              <CardTitle className="text-xl">監査ログ</CardTitle>
              <p className="text-sm text-muted-foreground">
                会社設定・労働ルール・従業員 への変更を時系列で記録（新しい順、
                {PAGE_SIZE} 件/ページ）
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">
                  エンティティ:
                </span>
                {(
                  [
                    ['all', '全て'],
                    ['work_rule_version', AUDIT_ENTITY_LABEL.work_rule_version],
                    ['company', AUDIT_ENTITY_LABEL.company],
                    ['user', AUDIT_ENTITY_LABEL.user],
                  ] as const
                ).map(([key, label]) => {
                  const active =
                    key === 'all'
                      ? entityFilter === null
                      : entityFilter === key;
                  const href = buildHref({
                    entity: key === 'all' ? null : (key as AuditEntityType),
                  });
                  return (
                    <Link
                      key={key}
                      href={href}
                      className={`rounded-md px-2 py-1 text-xs ${active ? 'bg-muted font-medium' : 'hover:bg-muted'}`}
                    >
                      {label}
                    </Link>
                  );
                })}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">アクター:</span>
                <Link
                  href={buildHref({ actor: null })}
                  className={`rounded-md px-2 py-1 text-xs ${actorFilter === null ? 'bg-muted font-medium' : 'hover:bg-muted'}`}
                >
                  全て
                </Link>
                {allUsers.map((u) => {
                  const active = actorFilter === u.id;
                  return (
                    <Link
                      key={u.id}
                      href={buildHref({ actor: u.id })}
                      className={`rounded-md px-2 py-1 text-xs ${active ? 'bg-muted font-medium' : 'hover:bg-muted'}`}
                    >
                      {u.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                条件に該当するログはありません。
                {entityFilter || actorFilter
                  ? ''
                  : ' 会社設定・労働ルール・従業員に対する変更操作を行うとここに記録されます。'}
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {logs.map((l) => (
                  <AuditLogRow
                    key={l.id}
                    log={l}
                    userNameById={userNameById}
                  />
                ))}
              </ul>
            )}
            {totalCount > 0 && (
              <div className="mt-4 border-t pt-3">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalLabel={`全 ${totalCount} 件`}
                  buildHref={(p) => buildHref({ page: p })}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function AuditLogRow({
  log,
  userNameById,
}: {
  log: MockAuditLog;
  userNameById: Map<string, string>;
}) {
  const actorName = userNameById.get(log.actorId) ?? log.actorId;
  const actionAsKey = log.action as AuditAction;
  return (
    <li className="rounded-md border bg-background p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${AUDIT_ACTION_BADGE[actionAsKey]}`}
        >
          {AUDIT_ACTION_LABEL[actionAsKey]}
        </span>
        <span className="text-xs text-muted-foreground">
          {AUDIT_ENTITY_LABEL[log.entityType]}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {log.entityId}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {actorName} ・ {fmtDateTime(log.createdAt)}
        </span>
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:underline">
          before/after を表示
        </summary>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">before</p>
            <pre className="overflow-x-auto rounded-md bg-muted/50 p-2 text-[11px] leading-snug">
              {renderJsonPreview(log.before)}
            </pre>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">after</p>
            <pre className="overflow-x-auto rounded-md bg-muted/50 p-2 text-[11px] leading-snug">
              {renderJsonPreview(log.after)}
            </pre>
          </div>
        </div>
      </details>
    </li>
  );
}
