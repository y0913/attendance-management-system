'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionResult } from '@/lib/action-result';
import {
  captureCurrentSnapshot,
  findActiveCorrection,
  REASON_MAX_LENGTH,
  submitCorrection,
} from '@/lib/mock/clock-corrections';
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

  await upsertDailyNote(session.id, parsed.data.jstDate, parsed.data.content);
  revalidatePath('/attendance');
  revalidatePath(`/attendance/${parsed.data.jstDate}`);

  return { ok: true, data: { jstDate: parsed.data.jstDate } };
}

const TimeOrEmpty = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/u)
  .or(z.literal(''));

const CorrectionSchema = z.object({
  jstDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(1).max(REASON_MAX_LENGTH),
  clockIn: TimeOrEmpty,
  clockOut: TimeOrEmpty,
  breakStart: TimeOrEmpty,
  breakEnd: TimeOrEmpty,
});

const blank = (s: string): string | null => (s === '' ? null : s);

export async function submitCorrectionAction(input: {
  jstDate: string;
  reason: string;
  clockIn: string;
  clockOut: string;
  breakStart: string;
  breakEnd: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await getMockSession();
  if (!session) {
    return { ok: false, error: { code: 'UNAUTHORIZED' } };
  }

  const parsed = CorrectionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION', details: parsed.error.flatten() },
    };
  }

  const existing = findActiveCorrection(session.id, parsed.data.jstDate);
  if (existing) {
    return {
      ok: false,
      error: { code: 'CONFLICT', message: '同じ日付で審査中の申請があります' },
    };
  }

  const before = await captureCurrentSnapshot(session.id, parsed.data.jstDate);
  const after = {
    clockIn: blank(parsed.data.clockIn),
    clockOut: blank(parsed.data.clockOut),
    breakStart: blank(parsed.data.breakStart),
    breakEnd: blank(parsed.data.breakEnd),
  };

  const req = await submitCorrection({
    requesterId: session.id,
    targetDate: parsed.data.jstDate,
    reason: parsed.data.reason,
    before,
    after,
  });

  revalidatePath(`/attendance/${parsed.data.jstDate}`);
  revalidatePath('/applications');

  return { ok: true, data: { id: req.id } };
}
