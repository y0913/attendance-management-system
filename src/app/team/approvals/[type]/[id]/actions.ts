'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionResult } from '@/lib/action-result';
import { requireApprover } from '@/lib/auth/guards';
import { isAdmin } from '@/lib/auth/policies';
import { prisma } from '@/lib/db';
import { logActionError } from '@/lib/logger';
import {
  APPROVAL_COMMENT_MAX_LENGTH,
  recordApprovalAction,
  type ApprovalActionType,
} from '@/lib/data/approval-actions';
import { decideCorrection } from '@/lib/data/clock-corrections';
import { decideLeave } from '@/lib/data/leave-requests';

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
  const guard = await requireApprover();
  if (!guard.ok) return guard.result;
  const session = guard.session;

  const parsed = DecideSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION', details: parsed.error.flatten() },
    };
  }

  try {
    const isAdminActor = isAdmin(session);
    const trimmed = parsed.data.comment.trim();
    const result = await prisma.$transaction(async (tx) => {
      const decided =
        parsed.data.type === 'correction'
          ? await decideCorrection(
              {
                companyId: session.companyId,
                id: parsed.data.id,
                deciderId: session.id,
                decision: parsed.data.decision,
                isAdmin: isAdminActor,
              },
              tx,
            )
          : await decideLeave(
              {
                companyId: session.companyId,
                id: parsed.data.id,
                deciderId: session.id,
                decision: parsed.data.decision,
                isAdmin: isAdminActor,
              },
              tx,
            );
      if (!decided.ok) return decided;
      await recordApprovalAction(
        {
          requestType: parsed.data.type,
          requestId: parsed.data.id,
          actorId: session.id,
          action: DECISION_TO_ACTION[parsed.data.decision],
          comment: trimmed.length > 0 ? trimmed : null,
        },
        tx,
      );
      return decided;
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

    revalidatePath('/team/approvals');
    revalidatePath(`/team/approvals/${parsed.data.type}/${parsed.data.id}`);
    revalidatePath('/applications');
    if (parsed.data.type === 'correction' && 'targetDate' in result.request) {
      revalidatePath(`/attendance/${result.request.targetDate}`);
      revalidatePath('/attendance');
      revalidatePath(`/team/attendance/${result.request.requesterId}`);
    }

    return { ok: true, data: { id: parsed.data.id } };
  } catch (e) {
    logActionError({
      action: 'decideRequestAction',
      userId: session.id,
      err: e,
      extra: {
        type: parsed.data.type,
        requestId: parsed.data.id,
        decision: parsed.data.decision,
      },
    });
    return { ok: false, error: { code: 'INTERNAL' } };
  }
}
