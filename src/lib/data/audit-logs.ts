// Phase 5: 内部を Prisma 経由に書き換え。すべて async。
//
// AuditLog の entityType / action は Prisma スキーマでは String 型
// （アプリ層で union 制約）。before / after は Json。

import type { AuditLog } from '@prisma/client';
import { prisma, type DbClient } from '@/lib/db';

export type AuditEntityType =
  | 'work_rule_version'
  | 'company'
  | 'user'
  | 'attendance_closing';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'deactivate'
  | 'reactivate'
  | 'close'
  | 'force_logout';

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

const toMockAuditLog = (l: AuditLog): MockAuditLog => ({
  id: l.id,
  entityType: l.entityType as AuditEntityType,
  entityId: l.entityId,
  action: l.action as AuditAction,
  actorId: l.actorId,
  before: l.before,
  after: l.after,
  createdAt: l.createdAt,
});

interface RecordAuditLogInput {
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  actorId: string;
  before?: unknown;
  after?: unknown;
}

// Prisma の Json @nullable は `Prisma.JsonNull` でしか null を表現できない。
// undefined の場合は何もセットしない（DB 上 NULL）、それ以外は object として渡す。
import type { Prisma } from '@prisma/client';

const toJsonInput = (
  v: unknown,
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue | undefined => {
  if (v === null || v === undefined) return null as unknown as Prisma.NullableJsonNullValueInput;
  return v as Prisma.InputJsonValue;
};

export async function recordAuditLog(
  input: RecordAuditLogInput,
  db: DbClient = prisma,
): Promise<MockAuditLog> {
  const created = await db.auditLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorId: input.actorId,
      before: toJsonInput(input.before),
      after: toJsonInput(input.after),
    },
  });
  return toMockAuditLog(created);
}

export interface ListAuditLogsFilters {
  entityType?: AuditEntityType;
  actorId?: string;
  limit?: number;
  offset?: number;
}

export async function listAuditLogs(
  companyId: string,
  filters: ListAuditLogsFilters = {},
): Promise<MockAuditLog[]> {
  const list = await prisma.auditLog.findMany({
    where: {
      actor: { companyId },
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.actorId ? { actorId: filters.actorId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    ...(filters.limit && filters.limit > 0 ? { take: filters.limit } : {}),
    ...(filters.offset && filters.offset > 0 ? { skip: filters.offset } : {}),
  });
  return list.map(toMockAuditLog);
}

export async function countAuditLogs(
  companyId: string,
  filters: Omit<ListAuditLogsFilters, 'limit' | 'offset'> = {},
): Promise<number> {
  return prisma.auditLog.count({
    where: {
      actor: { companyId },
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.actorId ? { actorId: filters.actorId } : {}),
    },
  });
}

export const AUDIT_ENTITY_LABEL: Record<AuditEntityType, string> = {
  work_rule_version: '労働ルール',
  company: '会社設定',
  user: '従業員',
  attendance_closing: '月次締め',
};

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  create: '作成',
  update: '更新',
  delete: '削除',
  deactivate: '無効化',
  reactivate: '再有効化',
  close: '締め',
  force_logout: '強制ログアウト',
};

export const AUDIT_ACTION_BADGE: Record<AuditAction, string> = {
  create: 'bg-emerald-100 text-emerald-900',
  update: 'bg-sky-100 text-sky-900',
  delete: 'bg-rose-100 text-rose-900',
  deactivate: 'bg-zinc-200 text-zinc-700',
  reactivate: 'bg-amber-100 text-amber-900',
  close: 'bg-indigo-100 text-indigo-900',
  force_logout: 'bg-purple-100 text-purple-900',
};
