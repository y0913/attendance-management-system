'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionResult } from '@/lib/action-result';
import { recordApprovalAction } from '@/lib/mock/approval-actions';
import { withdrawCorrection } from '@/lib/mock/clock-corrections';
import { withdrawLeave } from '@/lib/mock/leave-requests';
import { getMockSession } from '@/lib/mock/session';

const WithdrawSchema = z.object({
  type: z.enum(['correction', 'leave']),
  id: z.string().min(1),
});

export async function withdrawRequestAction(input: {
  type: 'correction' | 'leave';
  id: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await getMockSession();
  if (!session) return { ok: false, error: { code: 'UNAUTHORIZED' } };

  const parsed = WithdrawSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION', details: parsed.error.flatten() },
    };
  }

  const result =
    parsed.data.type === 'correction'
      ? await withdrawCorrection({
          id: parsed.data.id,
          requesterId: session.id,
        })
      : await withdrawLeave({
          id: parsed.data.id,
          requesterId: session.id,
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

  recordApprovalAction({
    requestType: parsed.data.type,
    requestId: parsed.data.id,
    actorId: session.id,
    action: 'withdraw',
    comment: null,
  });

  revalidatePath('/applications');
  revalidatePath('/team/approvals');
  revalidatePath('/admin/approvals');
  revalidatePath(`/team/approvals/${parsed.data.type}/${parsed.data.id}`);
  if (parsed.data.type === 'correction' && 'targetDate' in result.request) {
    revalidatePath(`/attendance/${result.request.targetDate}`);
  }

  return { ok: true, data: { id: parsed.data.id } };
}
