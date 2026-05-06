export type AuditEntityType =
  | 'work_rule_version'
  | 'company'
  | 'user';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'deactivate'
  | 'reactivate';

export interface MockAuditLog {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  actorId: string;
  before: unknown;
  after: unknown;
  createdAt: Date;
}

const store: MockAuditLog[] = [];

interface RecordAuditLogInput {
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  actorId: string;
  before?: unknown;
  after?: unknown;
}

export function recordAuditLog(input: RecordAuditLogInput): MockAuditLog {
  const log: MockAuditLog = {
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    actorId: input.actorId,
    before: input.before ?? null,
    after: input.after ?? null,
    createdAt: new Date(),
  };
  store.push(log);
  return log;
}

export interface ListAuditLogsFilters {
  entityType?: AuditEntityType;
  actorId?: string;
  limit?: number;
}

export function listAuditLogs(
  filters: ListAuditLogsFilters = {},
): MockAuditLog[] {
  let result = store.slice();
  if (filters.entityType) {
    result = result.filter((l) => l.entityType === filters.entityType);
  }
  if (filters.actorId) {
    result = result.filter((l) => l.actorId === filters.actorId);
  }
  result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (filters.limit && filters.limit > 0) {
    result = result.slice(0, filters.limit);
  }
  return result;
}

export const AUDIT_ENTITY_LABEL: Record<AuditEntityType, string> = {
  work_rule_version: '労働ルール',
  company: '会社設定',
  user: '従業員',
};

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  create: '作成',
  update: '更新',
  delete: '削除',
  deactivate: '無効化',
  reactivate: '再有効化',
};

export const AUDIT_ACTION_BADGE: Record<AuditAction, string> = {
  create: 'bg-emerald-100 text-emerald-900',
  update: 'bg-sky-100 text-sky-900',
  delete: 'bg-rose-100 text-rose-900',
  deactivate: 'bg-zinc-200 text-zinc-700',
  reactivate: 'bg-amber-100 text-amber-900',
};
