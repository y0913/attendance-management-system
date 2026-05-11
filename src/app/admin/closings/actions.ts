'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionResult } from '@/lib/action-result';
import { requireAdmin } from '@/lib/auth/guards';
import { prisma, withRetry } from '@/lib/db';
import { logActionError } from '@/lib/logger';
import { recordAuditLog } from '@/lib/data/audit-logs';
import {
  closeMonth,
  deleteClosing,
  findClosingById,
} from '@/lib/data/attendance-closings';
import { findMockUserById, listActiveUsers } from '@/lib/data/users';

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
  const guard = await requireAdmin();
  if (!guard.ok) return guard.result;
  const session = guard.session;

  const parsed = SingleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION', details: parsed.error.flatten() },
    };
  }

  try {
    const target = await findMockUserById(parsed.data.userId);
    if (!target || target.companyId !== session.companyId) {
      return { ok: false, error: { code: 'NOT_FOUND' } };
    }

    const closing = await withRetry(() =>
      prisma.$transaction(async (tx) => {
        const created = await closeMonth(
          session.companyId,
          parsed.data.userId,
          parsed.data.yearMonth,
          session.id,
          tx,
        );
        if (!created) return null;
        await recordAuditLog(
          {
            entityType: 'attendance_closing',
            entityId: created.id,
            action: 'close',
            actorId: session.id,
            before: null,
            after: {
              userId: created.userId,
              yearMonth: created.yearMonth,
              closedAt: created.closedAt,
              snapshot: created.snapshot,
            },
          },
          tx,
        );
        return created;
      }),
    );

    if (!closing) {
      return {
        ok: false,
        error: { code: 'CONFLICT', message: '既に締め済みです' },
      };
    }

    revalidatePath('/admin/closings');
    revalidatePath('/admin/audit-logs');
    return { ok: true, data: { closingId: closing.id } };
  } catch (e) {
    logActionError({
      action: 'closeMonthAction',
      userId: session.id,
      err: e,
      extra: { targetUserId: parsed.data.userId, yearMonth: parsed.data.yearMonth },
    });
    return { ok: false, error: { code: 'INTERNAL' } };
  }
}

export async function bulkCloseMonthAction(input: {
  yearMonth: string;
}): Promise<ActionResult<{ closedCount: number; skippedCount: number }>> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.result;
  const session = guard.session;

  const parsed = BulkSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION', details: parsed.error.flatten() },
    };
  }

  try {
    const ym = parsed.data.yearMonth;
    let closedCount = 0;
    let skippedCount = 0;
    // ユーザーごとに tx を分けてロック範囲を限定 (全社一括で1 tx にすると
    // attendance_closings/audit_logs が長時間ロックされ、他オペが詰まる)。
    for (const u of await listActiveUsers(session.companyId)) {
      // ユーザー単位の tx を分けてロック範囲を限定。並列 admin の競合 (P2034 / 40001 / 40P01)
      // を吸収する。tx 失敗時は audit_log も roll back されるので冪等。
      const closing = await withRetry(() =>
        prisma.$transaction(async (tx) => {
          const created = await closeMonth(
            session.companyId,
            u.id,
            ym,
            session.id,
            tx,
          );
          if (!created) return null;
          await recordAuditLog(
            {
              entityType: 'attendance_closing',
              entityId: created.id,
              action: 'close',
              actorId: session.id,
              before: null,
              after: {
                userId: created.userId,
                yearMonth: created.yearMonth,
                closedAt: created.closedAt,
                snapshot: created.snapshot,
              },
            },
            tx,
          );
          return created;
        }),
      );
      if (closing) {
        closedCount += 1;
      } else {
        skippedCount += 1;
      }
    }

    revalidatePath('/admin/closings');
    revalidatePath('/admin/audit-logs');
    return { ok: true, data: { closedCount, skippedCount } };
  } catch (e) {
    logActionError({
      action: 'bulkCloseMonthAction',
      userId: session.id,
      err: e,
      extra: { yearMonth: parsed.data.yearMonth },
    });
    return { ok: false, error: { code: 'INTERNAL' } };
  }
}

const UncloseSchema = z.object({
  closingId: z.string().min(1),
});

export async function uncloseAction(input: {
  closingId: string;
}): Promise<ActionResult<void>> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.result;
  const session = guard.session;

  const parsed = UncloseSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION', details: parsed.error.flatten() },
    };
  }

  try {
    const target = await findClosingById(
      session.companyId,
      parsed.data.closingId,
    );
    if (!target) return { ok: false, error: { code: 'NOT_FOUND' } };

    const beforeSnap = {
      id: target.id,
      userId: target.userId,
      yearMonth: target.yearMonth,
      closedAt: target.closedAt,
      closedById: target.closedById,
      snapshot: target.snapshot,
    };

    await withRetry(() =>
      prisma.$transaction(async (tx) => {
        await deleteClosing(session.companyId, parsed.data.closingId, tx);
        await recordAuditLog(
          {
            entityType: 'attendance_closing',
            entityId: parsed.data.closingId,
            action: 'delete',
            actorId: session.id,
            before: beforeSnap,
            after: null,
          },
          tx,
        );
      }),
    );

    revalidatePath('/admin/closings');
    revalidatePath('/admin/audit-logs');
    revalidatePath(`/team/attendance/${target.userId}`);
    revalidatePath('/admin/attendance');
    return { ok: true, data: undefined };
  } catch (e) {
    logActionError({
      action: 'uncloseAction',
      userId: session.id,
      err: e,
      extra: { closingId: parsed.data.closingId },
    });
    return { ok: false, error: { code: 'INTERNAL' } };
  }
}
