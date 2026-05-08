'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionResult } from '@/lib/action-result';
import { requireAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { logActionError } from '@/lib/logger';
import { recordAuditLog } from '@/lib/data/audit-logs';
import {
  checkComplianceViolations,
  createWorkRuleVersion,
  deleteWorkRuleVersion,
  findWorkRuleVersionById,
  isFutureVersion,
  isValidFromTaken,
  updateWorkRuleVersion,
  type RuleInput,
} from '@/lib/data/work-rule-versions';

const TimeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const RuleSchema = z.object({
  id: z.string().optional(),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dailyOtThresholdMin: z.number().int().nonnegative(),
  weeklyOtThresholdMin: z.number().int().nonnegative(),
  otRate: z.number().nonnegative(),
  nightStartTime: z.string().regex(TimeRegex),
  nightEndTime: z.string().regex(TimeRegex),
  nightRateAddition: z.number().nonnegative(),
  legalHolidayRate: z.number().nonnegative(),
  monthly60hOtRate: z.number().nonnegative(),
  monthly60hThresholdMin: z.number().int().nonnegative(),
  complianceMode: z.boolean(),
});

interface UpsertRuleInput {
  id?: string;
  validFrom: string;
  dailyOtThresholdMin: number;
  weeklyOtThresholdMin: number;
  otRate: number;
  nightStartTime: string;
  nightEndTime: string;
  nightRateAddition: number;
  legalHolidayRate: number;
  monthly60hOtRate: number;
  monthly60hThresholdMin: number;
  complianceMode: boolean;
}

const toJstStartOfDay = (jstDate: string): Date =>
  new Date(`${jstDate}T00:00:00+09:00`);

const ensureFuture = (validFrom: Date): boolean =>
  validFrom.getTime() > Date.now();

export async function upsertWorkRuleAction(
  input: UpsertRuleInput,
): Promise<ActionResult<{ id: string }>> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.result;
  const session = guard.session;

  const parsed = RuleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION', details: parsed.error.flatten() },
    };
  }

  const data = parsed.data;
  const validFrom = toJstStartOfDay(data.validFrom);

  if (!ensureFuture(validFrom)) {
    return {
      ok: false,
      error: {
        code: 'CONFLICT',
        message: '適用開始日は明日以降を指定してください（過去・本日への登録不可）',
      },
    };
  }

  const ruleInput: RuleInput = {
    validFrom,
    dailyOtThresholdMin: data.dailyOtThresholdMin,
    weeklyOtThresholdMin: data.weeklyOtThresholdMin,
    otRate: data.otRate,
    nightStartTime: data.nightStartTime,
    nightEndTime: data.nightEndTime,
    nightRateAddition: data.nightRateAddition,
    legalHolidayRate: data.legalHolidayRate,
    monthly60hOtRate: data.monthly60hOtRate,
    monthly60hThresholdMin: data.monthly60hThresholdMin,
    complianceMode: data.complianceMode,
  };

  if (ruleInput.complianceMode) {
    const violations = checkComplianceViolations(ruleInput);
    if (violations.length > 0) {
      return {
        ok: false,
        error: {
          code: 'CONFLICT',
          message: `compliance_mode 有効時の法定下限違反: ${violations.map((v) => v.message).join(' / ')}`,
        },
      };
    }
  }

  type Result =
    | { ok: true; id: string }
    | { ok: false; code: 'NOT_FOUND' | 'CONFLICT'; message?: string };

  try {
    const result = await prisma.$transaction(async (tx): Promise<Result> => {
      if (await isValidFromTaken(validFrom, data.id, tx)) {
        return {
          ok: false,
          code: 'CONFLICT',
          message: 'その適用開始日に既に別バージョンが存在します',
        };
      }
      if (data.id) {
        const target = await findWorkRuleVersionById(data.id);
        if (!target) return { ok: false, code: 'NOT_FOUND' };
        if (!isFutureVersion(target)) {
          return {
            ok: false,
            code: 'CONFLICT',
            message: '現行・過去バージョンは編集できません',
          };
        }
        const beforeSnap = { ...target };
        const updated = await updateWorkRuleVersion(data.id, ruleInput, tx);
        await recordAuditLog(
          {
            entityType: 'work_rule_version',
            entityId: data.id,
            action: 'update',
            actorId: session.id,
            before: beforeSnap,
            after: updated,
          },
          tx,
        );
        return { ok: true, id: data.id };
      }
      const created = await createWorkRuleVersion(ruleInput, session.id, tx);
      await recordAuditLog(
        {
          entityType: 'work_rule_version',
          entityId: created.id,
          action: 'create',
          actorId: session.id,
          before: null,
          after: created,
        },
        tx,
      );
      return { ok: true, id: created.id };
    });

    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: result.code,
          ...(result.message ? { message: result.message } : {}),
        },
      };
    }

    revalidatePath('/admin/work-rules');
    if (data.id) revalidatePath(`/admin/work-rules/${data.id}`);
    revalidatePath('/admin/audit-logs');
    return { ok: true, data: { id: result.id } };
  } catch (e) {
    logActionError({
      action: 'upsertWorkRuleAction',
      userId: session.id,
      err: e,
      extra: { ruleId: data.id ?? null, validFrom: data.validFrom },
    });
    return { ok: false, error: { code: 'INTERNAL' } };
  }
}

export async function deleteWorkRuleAction(input: {
  id: string;
}): Promise<ActionResult<void>> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.result;
  const session = guard.session;

  try {
    const target = await findWorkRuleVersionById(input.id);
    if (!target) return { ok: false, error: { code: 'NOT_FOUND' } };
    if (!isFutureVersion(target)) {
      return {
        ok: false,
        error: {
          code: 'CONFLICT',
          message: '現行・過去バージョンは削除できません',
        },
      };
    }

    const beforeSnap = { ...target };
    await prisma.$transaction(async (tx) => {
      await deleteWorkRuleVersion(input.id, tx);
      await recordAuditLog(
        {
          entityType: 'work_rule_version',
          entityId: input.id,
          action: 'delete',
          actorId: session.id,
          before: beforeSnap,
          after: null,
        },
        tx,
      );
    });
    revalidatePath('/admin/work-rules');
    revalidatePath('/admin/audit-logs');
    return { ok: true, data: undefined };
  } catch (e) {
    logActionError({
      action: 'deleteWorkRuleAction',
      userId: session.id,
      err: e,
      extra: { ruleId: input.id },
    });
    return { ok: false, error: { code: 'INTERNAL' } };
  }
}
