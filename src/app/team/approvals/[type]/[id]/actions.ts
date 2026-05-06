'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionResult } from '@/lib/action-result';
import {
  APPROVAL_COMMENT_MAX_LENGTH,
  recordApprovalAction,
  type ApprovalActionType,
} from '@/lib/mock/approval-actions';
import { decideCorrection } from '@/lib/mock/clock-corrections';
import { decideLeave } from '@/lib/mock/leave-requests';
import { getMockSession } from '@/lib/mock/session';

const DecideSchema = z.object({
  type: z.enum(['correction', 'leave']),
  id: z.string().min(1),
  decision: z.enum(['approve', 'reject', 'return']),
  comment: z.string().max(APPROVAL_COMMENT_MAX_LENGTH),
});

const DECISION_TO_ACTION: Record<
  'approve' | 'reject' | 'return',
  ApprovalActionType
> = {
  approve: 'approve',
  reject: 'reject',
  return: 'return',
};

export async function decideRequestAction(input: {
  type: 'correction' | 'leave';
  id: string;
  decision: 'approve' | 'reject' | 'return';
  comment: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await getMockSession();
  if (!session) {
    return { ok: false, error: { code: 'UNAUTHORIZED' } };
  }
  if (session.role !== 'approver' && session.role !== 'admin') {
    return { ok: false, error: { code: 'FORBIDDEN' } };
  }

  const parsed = DecideSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION', details: parsed.error.flatten() },
    };
  }

  const isAdmin = session.role === 'admin';
  const result =
    parsed.data.type === 'correction'
      ? await decideCorrection({
          id: parsed.data.id,
          deciderId: session.id,
          decision: parsed.data.decision,
          isAdmin,
        })
      : await decideLeave({
          id: parsed.data.id,
          deciderId: session.id,
          decision: parsed.data.decision,
          isAdmin,
        });

  if (!result.ok) {
    if (result.reason === 'NOT_FOUND') {
      return { ok: false, error: { code: 'NOT_FOUND' } };
    }
    if (result.reason === 'FORBIDDEN') {
      return { ok: false, error: { code: 'FORBIDDEN' } };
    }
    return {
      ok: false,
      error: {
        code: 'CONFLICT',
        message: 'この申請は既に処理済みです',
      },
    };
  }

  const trimmed = parsed.data.comment.trim();
  recordApprovalAction({
    requestType: parsed.data.type,
    requestId: parsed.data.id,
    actorId: session.id,
    action: DECISION_TO_ACTION[parsed.data.decision],
    comment: trimmed.length > 0 ? trimmed : null,
  });

  revalidatePath('/team/approvals');
  revalidatePath(`/team/approvals/${parsed.data.type}/${parsed.data.id}`);
  revalidatePath('/applications');
  if (parsed.data.type === 'correction' && 'targetDate' in result.request) {
    revalidatePath(`/attendance/${result.request.targetDate}`);
    revalidatePath('/attendance');
    revalidatePath(`/team/attendance/${result.request.requesterId}`);
  }

  return { ok: true, data: { id: parsed.data.id } };
}
