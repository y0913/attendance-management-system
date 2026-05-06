'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionResult } from '@/lib/action-result';
import { recordAuditLog } from '@/lib/mock/audit-logs';
import { getCompany, updateCompany } from '@/lib/mock/companies';
import { getMockSession } from '@/lib/mock/session';

const StrategyEnum = z.enum(['daily', 'month_end']);

const UpdateSchema = z.object({
  name: z.string().min(1).max(100),
  closingDay: z.number().int().min(0).max(31),
  midMonthRateChangeStrategy: StrategyEnum,
});

export async function updateCompanySettingsAction(input: {
  name: string;
  closingDay: number;
  midMonthRateChangeStrategy: 'daily' | 'month_end';
}): Promise<ActionResult<void>> {
  const session = await getMockSession();
  if (!session) return { ok: false, error: { code: 'UNAUTHORIZED' } };
  if (session.role !== 'admin') {
    return { ok: false, error: { code: 'FORBIDDEN' } };
  }

  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION', details: parsed.error.flatten() },
    };
  }

  const before = getCompany();
  const after = updateCompany({
    name: parsed.data.name.trim(),
    closingDay: parsed.data.closingDay,
    midMonthRateChangeStrategy: parsed.data.midMonthRateChangeStrategy,
  });

  recordAuditLog({
    entityType: 'company',
    entityId: after.id,
    action: 'update',
    actorId: session.id,
    before,
    after,
  });

  revalidatePath('/admin/company-settings');
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/audit-logs');

  return { ok: true, data: undefined };
}
