'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { TimeClockType } from '@prisma/client';
import type { ActionResult } from '@/lib/action-result';
import { getMockSession } from '@/lib/data/session';
import {
  appendClock,
  getClockState,
  type ClockState,
} from '@/lib/data/time-clocks';

const PunchSchema = z.object({
  type: z.enum(['clock_in', 'clock_out', 'break_start', 'break_end']),
});

const ALLOWED: Record<ClockState, TimeClockType[]> = {
  not_clocked_in: ['clock_in'],
  working: ['clock_out', 'break_start'],
  on_break: ['break_end'],
  clocked_out: [],
};

export async function punchClockAction(
  input: { type: TimeClockType },
): Promise<ActionResult<{ type: TimeClockType }>> {
  const session = await getMockSession();
  if (!session) {
    return { ok: false, error: { code: 'UNAUTHORIZED' } };
  }

  const parsed = PunchSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION', details: parsed.error.flatten() },
    };
  }

  const state = await getClockState(session.id);
  if (!ALLOWED[state].includes(parsed.data.type)) {
    return {
      ok: false,
      error: { code: 'CONFLICT', message: `現在の状態(${state})では実行できません` },
    };
  }

  await appendClock(session.id, parsed.data.type);
  revalidatePath('/clock');

  return { ok: true, data: { type: parsed.data.type } };
}
