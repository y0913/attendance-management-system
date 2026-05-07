// Phase 4: 内部を Prisma 経由に書き換え。すべて async。
//
// 型差異: mock の requestType は 'correction'/'leave'、Prisma は
// 'clock_correction'/'leave_request'。マッパーで変換。

import type {
  ApprovalAction,
  ApprovalActionType,
  ApprovalRequestType,
} from '@prisma/client';
import { prisma, type DbClient } from '@/lib/db';

export type { ApprovalActionType };

export type AppRequestType = 'correction' | 'leave';

export interface MockApprovalAction {
  id: string;
  requestType: AppRequestType;
  requestId: string;
  actorId: string;
  action: ApprovalActionType;
  comment: string | null;
  createdAt: Date;
}

export const APPROVAL_COMMENT_MAX_LENGTH = 500;

const toPrismaRequestType = (t: AppRequestType): ApprovalRequestType =>
  t === 'correction' ? 'clock_correction' : 'leave_request';

const toAppRequestType = (t: ApprovalRequestType): AppRequestType =>
  t === 'clock_correction' ? 'correction' : 'leave';

const toMockApprovalAction = (a: ApprovalAction): MockApprovalAction => ({
  id: a.id,
  requestType: toAppRequestType(a.requestType),
  requestId: a.requestId,
  actorId: a.actorId,
  action: a.action,
  comment: a.comment,
  createdAt: a.createdAt,
});

interface RecordInput {
  requestType: AppRequestType;
  requestId: string;
  actorId: string;
  action: ApprovalActionType;
  comment?: string | null;
  createdAt?: Date;
}

export async function recordApprovalAction(
  input: RecordInput,
  db: DbClient = prisma,
): Promise<MockApprovalAction> {
  const created = await db.approvalAction.create({
    data: {
      requestType: toPrismaRequestType(input.requestType),
      requestId: input.requestId,
      actorId: input.actorId,
      action: input.action,
      comment: input.comment ?? null,
      createdAt: input.createdAt,
    },
  });
  return toMockApprovalAction(created);
}

export async function listApprovalActions(
  requestType: AppRequestType,
  requestId: string,
): Promise<MockApprovalAction[]> {
  const list = await prisma.approvalAction.findMany({
    where: {
      requestType: toPrismaRequestType(requestType),
      requestId,
    },
    orderBy: { createdAt: 'asc' },
  });
  return list.map(toMockApprovalAction);
}

export const APPROVAL_ACTION_LABEL: Record<ApprovalActionType, string> = {
  submit: '申請',
  approve: '承認',
  reject: '却下',
  withdraw: '取下げ',
  return: '差戻し',
};
