export type ApprovalActionType =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'withdraw'
  | 'return';

export type ApprovalRequestType = 'correction' | 'leave';

export interface MockApprovalAction {
  id: string;
  requestType: ApprovalRequestType;
  requestId: string;
  actorId: string;
  action: ApprovalActionType;
  comment: string | null;
  createdAt: Date;
}

export const APPROVAL_COMMENT_MAX_LENGTH = 500;

const store: MockApprovalAction[] = [];

interface RecordInput {
  requestType: ApprovalRequestType;
  requestId: string;
  actorId: string;
  action: ApprovalActionType;
  comment?: string | null;
  createdAt?: Date;
}

export function recordApprovalAction(input: RecordInput): MockApprovalAction {
  const action: MockApprovalAction = {
    id: `apa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    requestType: input.requestType,
    requestId: input.requestId,
    actorId: input.actorId,
    action: input.action,
    comment: input.comment ?? null,
    createdAt: input.createdAt ?? new Date(),
  };
  store.push(action);
  return action;
}

export function listApprovalActions(
  requestType: ApprovalRequestType,
  requestId: string,
): MockApprovalAction[] {
  return store
    .filter((a) => a.requestType === requestType && a.requestId === requestId)
    .slice()
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export const APPROVAL_ACTION_LABEL: Record<ApprovalActionType, string> = {
  submit: '申請',
  approve: '承認',
  reject: '却下',
  withdraw: '取下げ',
  return: '差戻し',
};
