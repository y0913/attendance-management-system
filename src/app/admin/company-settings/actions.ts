'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionResult } from '@/lib/action-result';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/data/audit-logs';
import { getCompany, updateCompany } from '@/lib/data/companies';
import { getMockSession } from '@/lib/data/session';

const StrategyEnum = z.enum(['daily', 'month_end']);
const WeekdayEnum = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

const UpdateSchema = z.object({
  name: z.string().min(1).max(100),
  closingDay: z.number().int().min(0).max(31),
  midMonthRateChangeStrategy: StrategyEnum,
  monthlyStandardHours: z.number().min(1).max(744), // 1h 〜 31日×24h
  legalHolidayWeekday: WeekdayEnum,
});

export async function updateCompanySettingsAction(input: {
  name: string;
  closingDay: number;
  midMonthRateChangeStrategy: 'daily' | 'month_end';
  monthlyStandardHours: number;
  legalHolidayWeekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
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

  const before = await getCompany();
  await prisma.$transaction(async (tx) => {
    const after = await updateCompany(
      {
        name: parsed.data.name.trim(),
        closingDay: parsed.data.closingDay,
        midMonthRateChangeStrategy: parsed.data.midMonthRateChangeStrategy,
        monthlyStandardHours: parsed.data.monthlyStandardHours,
        legalHolidayWeekday: parsed.data.legalHolidayWeekday,
      },
      tx,
    );
    await recordAuditLog(
      {
        entityType: 'company',
        entityId: after.id,
        action: 'update',
        actorId: session.id,
        before,
        after,
      },
      tx,
    );
  });

  revalidatePath('/admin/company-settings');
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/audit-logs');

  return { ok: true, data: undefined };
}
