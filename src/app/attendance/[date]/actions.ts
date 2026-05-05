'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionResult } from '@/lib/action-result';
import {
  DAILY_NOTE_MAX_LENGTH,
  upsertDailyNote,
} from '@/lib/mock/daily-notes';
import { getMockSession } from '@/lib/mock/session';

const SaveSchema = z.object({
  jstDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  content: z.string().max(DAILY_NOTE_MAX_LENGTH),
});

export async function saveDailyNoteAction(
  input: { jstDate: string; content: string },
): Promise<ActionResult<{ jstDate: string }>> {
  const session = await getMockSession();
  if (!session) {
    return { ok: false, error: { code: 'UNAUTHORIZED' } };
  }

  const parsed = SaveSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION', details: parsed.error.flatten() },
    };
  }

  upsertDailyNote(session.id, parsed.data.jstDate, parsed.data.content);
  revalidatePath('/attendance');
  revalidatePath(`/attendance/${parsed.data.jstDate}`);

  return { ok: true, data: { jstDate: parsed.data.jstDate } };
}
