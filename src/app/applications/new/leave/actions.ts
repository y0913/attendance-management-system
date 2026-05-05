'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionResult } from '@/lib/action-result';
import {
  countWeekdaysBetween,
  LEAVE_REASON_MAX_LENGTH,
  submitLeave,
} from '@/lib/mock/leave-requests';
import { getMockSession } from '@/lib/mock/session';

const Schema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: z.string().min(1).max(LEAVE_REASON_MAX_LENGTH),
  })
  .refine((v) => v.startDate <= v.endDate, {
    message: '終了日は開始日以降にしてください',
    path: ['endDate'],
  });

export async function submitLeaveAction(input: {
  startDate: string;
  endDate: string;
  reason: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await getMockSession();
  if (!session) {
    return { ok: false, error: { code: 'UNAUTHORIZED' } };
  }

  const parsed = Schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION', details: parsed.error.flatten() },
    };
  }

  const days = countWeekdaysBetween(
    parsed.data.startDate,
    parsed.data.endDate,
  );
  if (days <= 0) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION',
        details: { formErrors: ['平日が含まれていません'] },
      },
    };
  }

  const req = submitLeave({
    requesterId: session.id,
    leaveType: 'paid',
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
    reason: parsed.data.reason,
  });

  revalidatePath('/applications');

  return { ok: true, data: { id: req.id } };
}
