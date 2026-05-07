'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionResult } from '@/lib/action-result';
import { requireSession } from '@/lib/auth/guards';
import { isBusinessDay } from '@/lib/calc/holidays';
import {
  countBusinessDaysBetween,
  LEAVE_REASON_MAX_LENGTH,
  submitLeave,
} from '@/lib/data/leave-requests';

const Schema = z
  .object({
    dayUnit: z.enum(['full', 'half']),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: z.string().min(1).max(LEAVE_REASON_MAX_LENGTH),
  })
  .refine((v) => v.startDate <= v.endDate, {
    message: '終了日は開始日以降にしてください',
    path: ['endDate'],
  })
  .refine((v) => v.dayUnit === 'full' || v.startDate === v.endDate, {
    message: '半日有給は単一日のみ指定可能です',
    path: ['endDate'],
  });

export async function submitLeaveAction(input: {
  dayUnit: 'full' | 'half';
  startDate: string;
  endDate: string;
  reason: string;
}): Promise<ActionResult<{ id: string }>> {
  const guard = await requireSession();
  if (!guard.ok) return guard.result;
  const session = guard.session;

  const parsed = Schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION', details: parsed.error.flatten() },
    };
  }

  if (parsed.data.dayUnit === 'half') {
    if (!isBusinessDay(parsed.data.startDate)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION',
          details: { formErrors: ['半日有給は土日祝以外を指定してください'] },
        },
      };
    }
  } else {
    const days = countBusinessDaysBetween(
      parsed.data.startDate,
      parsed.data.endDate,
    );
    if (days <= 0) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION',
          details: { formErrors: ['営業日が含まれていません'] },
        },
      };
    }
  }

  const result = await submitLeave({
    requesterId: session.id,
    leaveType: 'paid',
    dayUnit: parsed.data.dayUnit,
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
    reason: parsed.data.reason,
  });

  if (!result.ok) {
    return {
      ok: false,
      error: { code: 'CONFLICT', message: '半日有給は単一日のみ指定可能です' },
    };
  }

  revalidatePath('/applications');

  return { ok: true, data: { id: result.request.id } };
}
