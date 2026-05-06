'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionResult } from '@/lib/action-result';
import { recordAuditLog } from '@/lib/mock/audit-logs';
import { getMockSession } from '@/lib/mock/session';
import {
  checkComplianceViolations,
  createWorkRuleVersion,
  deleteWorkRuleVersion,
  findWorkRuleVersionById,
  isFutureVersion,
  isValidFromTaken,
  updateWorkRuleVersion,
  type RuleInput,
} from '@/lib/mock/work-rule-versions';

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
  const session = await getMockSession();
  if (!session) return { ok: false, error: { code: 'UNAUTHORIZED' } };
  if (session.role !== 'admin') {
    return { ok: false, error: { code: 'FORBIDDEN' } };
  }

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

  if (isValidFromTaken(validFrom, data.id)) {
    return {
      ok: false,
      error: {
        code: 'CONFLICT',
        message: 'その適用開始日に既に別バージョンが存在します',
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

  if (data.id) {
    const target = findWorkRuleVersionById(data.id);
    if (!target) return { ok: false, error: { code: 'NOT_FOUND' } };
    if (!isFutureVersion(target)) {
      return {
        ok: false,
        error: {
          code: 'CONFLICT',
          message: '現行・過去バージョンは編集できません',
        },
      };
    }
    const beforeSnap = { ...target };
    const updated = updateWorkRuleVersion(data.id, ruleInput);
    recordAuditLog({
      entityType: 'work_rule_version',
      entityId: data.id,
      action: 'update',
      actorId: session.id,
      before: beforeSnap,
      after: updated,
    });
    revalidatePath('/admin/work-rules');
    revalidatePath(`/admin/work-rules/${data.id}`);
    revalidatePath('/admin/audit-logs');
    return { ok: true, data: { id: data.id } };
  }

  const created = createWorkRuleVersion(ruleInput, session.id);
  recordAuditLog({
    entityType: 'work_rule_version',
    entityId: created.id,
    action: 'create',
    actorId: session.id,
    before: null,
    after: created,
  });
  revalidatePath('/admin/work-rules');
  revalidatePath('/admin/audit-logs');
  return { ok: true, data: { id: created.id } };
}

export async function deleteWorkRuleAction(input: {
  id: string;
}): Promise<ActionResult<void>> {
  const session = await getMockSession();
  if (!session) return { ok: false, error: { code: 'UNAUTHORIZED' } };
  if (session.role !== 'admin') {
    return { ok: false, error: { code: 'FORBIDDEN' } };
  }

  const target = findWorkRuleVersionById(input.id);
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
  deleteWorkRuleVersion(input.id);
  recordAuditLog({
    entityType: 'work_rule_version',
    entityId: input.id,
    action: 'delete',
    actorId: session.id,
    before: beforeSnap,
    after: null,
  });
  revalidatePath('/admin/work-rules');
  revalidatePath('/admin/audit-logs');
  return { ok: true, data: undefined };
}
