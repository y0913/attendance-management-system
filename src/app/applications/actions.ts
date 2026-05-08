'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionResult } from '@/lib/action-result';
import { requireSession } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { logActionError } from '@/lib/logger';
import { recordApprovalAction } from '@/lib/data/approval-actions';
import { withdrawCorrection } from '@/lib/data/clock-corrections';
import { withdrawLeave } from '@/lib/data/leave-requests';

const WithdrawSchema = z.object({
  type: z.enum(['correction', 'leave']),
  id: z.string().min(1),
});

export async function withdrawRequestAction(input: {
  type: 'correction' | 'leave';
  id: string;
}): Promise<ActionResult<{ id: string }>> {
  const guard = await requireSession();
  if (!guard.ok) return guard.result;
  const session = guard.session;

  const parsed = WithdrawSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION', details: parsed.error.flatten() },
    };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const withdrew =
        parsed.data.type === 'correction'
          ? await withdrawCorrection(
              { id: parsed.data.id, requesterId: session.id },
              tx,
            )
          : await withdrawLeave(
              { id: parsed.data.id, requesterId: session.id },
              tx,
            );
      if (!withdrew.ok) return withdrew;
      await recordApprovalAction(
        {
          requestType: parsed.data.type,
          requestId: parsed.data.id,
          actorId: session.id,
          action: 'withdraw',
          comment: null,
        },
        tx,
      );
      return withdrew;
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
          message: 'この申請は既に処理済みのため取下げできません',
        },
      };
    }

    revalidatePath('/applications');
    revalidatePath('/team/approvals');
    revalidatePath('/admin/approvals');
    revalidatePath(`/team/approvals/${parsed.data.type}/${parsed.data.id}`);
    if (parsed.data.type === 'correction' && 'targetDate' in result.request) {
      revalidatePath(`/attendance/${result.request.targetDate}`);
    }

    return { ok: true, data: { id: parsed.data.id } };
  } catch (e) {
    logActionError({
      action: 'withdrawRequestAction',
      userId: session.id,
      err: e,
      extra: { type: parsed.data.type, id: parsed.data.id },
    });
    return { ok: false, error: { code: 'INTERNAL' } };
  }
}
