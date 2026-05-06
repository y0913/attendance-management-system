'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionResult } from '@/lib/action-result';
import { recordAuditLog } from '@/lib/mock/audit-logs';
import {
  closeMonth,
  deleteClosing,
  findClosing,
  findClosingById,
} from '@/lib/mock/attendance-closings';
import { getMockSession } from '@/lib/mock/session';
import { findMockUserById, listActiveUsers } from '@/lib/mock/users';

const YmRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

const SingleSchema = z.object({
  userId: z.string().min(1),
  yearMonth: z.string().regex(YmRegex),
});

const BulkSchema = z.object({
  yearMonth: z.string().regex(YmRegex),
});

export async function closeMonthAction(input: {
  userId: string;
  yearMonth: string;
}): Promise<ActionResult<{ closingId: string }>> {
  const session = await getMockSession();
  if (!session) return { ok: false, error: { code: 'UNAUTHORIZED' } };
  if (session.role !== 'admin') {
    return { ok: false, error: { code: 'FORBIDDEN' } };
  }

  const parsed = SingleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION', details: parsed.error.flatten() },
    };
  }

  const target = findMockUserById(parsed.data.userId);
  if (!target) return { ok: false, error: { code: 'NOT_FOUND' } };

  if (findClosing(parsed.data.userId, parsed.data.yearMonth)) {
    return {
      ok: false,
      error: { code: 'CONFLICT', message: '既に締め済みです' },
    };
  }

  const closing = closeMonth(
    parsed.data.userId,
    parsed.data.yearMonth,
    session.id,
  );
  if (!closing) {
    return {
      ok: false,
      error: { code: 'CONFLICT', message: '締め処理に失敗しました' },
    };
  }

  recordAuditLog({
    entityType: 'attendance_closing',
    entityId: closing.id,
    action: 'close',
    actorId: session.id,
    before: null,
    after: {
      userId: closing.userId,
      yearMonth: closing.yearMonth,
      closedAt: closing.closedAt,
      snapshot: closing.snapshot,
    },
  });

  revalidatePath('/admin/closings');
  revalidatePath('/admin/audit-logs');
  return { ok: true, data: { closingId: closing.id } };
}

export async function bulkCloseMonthAction(input: {
  yearMonth: string;
}): Promise<ActionResult<{ closedCount: number; skippedCount: number }>> {
  const session = await getMockSession();
  if (!session) return { ok: false, error: { code: 'UNAUTHORIZED' } };
  if (session.role !== 'admin') {
    return { ok: false, error: { code: 'FORBIDDEN' } };
  }

  const parsed = BulkSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION', details: parsed.error.flatten() },
    };
  }

  const ym = parsed.data.yearMonth;
  let closedCount = 0;
  let skippedCount = 0;
  for (const u of listActiveUsers()) {
    if (findClosing(u.id, ym)) {
      skippedCount += 1;
      continue;
    }
    const closing = closeMonth(u.id, ym, session.id);
    if (closing) {
      closedCount += 1;
      recordAuditLog({
        entityType: 'attendance_closing',
        entityId: closing.id,
        action: 'close',
        actorId: session.id,
        before: null,
        after: {
          userId: closing.userId,
          yearMonth: closing.yearMonth,
          closedAt: closing.closedAt,
          snapshot: closing.snapshot,
        },
      });
    }
  }

  revalidatePath('/admin/closings');
  revalidatePath('/admin/audit-logs');
  return { ok: true, data: { closedCount, skippedCount } };
}

const UncloseSchema = z.object({
  closingId: z.string().min(1),
});

export async function uncloseAction(input: {
  closingId: string;
}): Promise<ActionResult<void>> {
  const session = await getMockSession();
  if (!session) return { ok: false, error: { code: 'UNAUTHORIZED' } };
  if (session.role !== 'admin') {
    return { ok: false, error: { code: 'FORBIDDEN' } };
  }

  const parsed = UncloseSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION', details: parsed.error.flatten() },
    };
  }

  const target = findClosingById(parsed.data.closingId);
  if (!target) return { ok: false, error: { code: 'NOT_FOUND' } };

  const beforeSnap = {
    id: target.id,
    userId: target.userId,
    yearMonth: target.yearMonth,
    closedAt: target.closedAt,
    closedById: target.closedById,
    snapshot: target.snapshot,
  };
  deleteClosing(parsed.data.closingId);

  recordAuditLog({
    entityType: 'attendance_closing',
    entityId: parsed.data.closingId,
    action: 'delete',
    actorId: session.id,
    before: beforeSnap,
    after: null,
  });

  revalidatePath('/admin/closings');
  revalidatePath('/admin/audit-logs');
  revalidatePath(`/team/attendance/${target.userId}`);
  revalidatePath('/admin/attendance');
  return { ok: true, data: undefined };
}
