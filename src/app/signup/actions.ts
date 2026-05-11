'use server';

import { z } from 'zod';
import { signIn } from '@/auth';
import type { ActionResult } from '@/lib/action-result';
import { prisma } from '@/lib/db';
import { findMockUserByEmail } from '@/lib/data/users';

const SignUpSchema = z.object({
  companyName: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(50),
  email: z.string().email(),
});

// 新規 work_rule_version の有効開始日。十分過去にして、その会社の
// 過去日付の打刻も計算できるようにする。
const INITIAL_RULE_VALID_FROM = new Date('2020-01-01T00:00:00+09:00');

export async function signUpAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const parsed = SignUpSchema.safeParse({
    companyName: formData.get('companyName'),
    name: formData.get('name'),
    email: formData.get('email'),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION', details: parsed.error.flatten() },
    };
  }

  const existing = await findMockUserByEmail(parsed.data.email);
  if (existing) {
    return {
      ok: false,
      error: {
        code: 'CONFLICT',
        message: '既に登録されているメールアドレスです',
      },
    };
  }

  // 会社・admin user・初期労働ルールを atomic に作成。
  // 途中失敗で半端な状態が残らないよう transaction で囲む。
  await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: parsed.data.companyName,
        // closingDay / midMonthRateChangeStrategy は schema のデフォルト (0=月末, month_end)
      },
    });

    const admin = await tx.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        companyId: company.id,
        role: 'admin',
        employmentType: 'monthly',
        hiredAt: new Date(),
      },
    });

    await tx.workRuleVersion.create({
      data: {
        companyId: company.id,
        validFrom: INITIAL_RULE_VALID_FROM,
        createdById: admin.id,
        // 他の数値項目は schema のデフォルト (1.25 / 0.25 / 1.35 / 1.5 / 480 / 2400 / 3600)
        // complianceMode は true
      },
    });
  });

  await signIn('nodemailer', {
    email: parsed.data.email,
    redirectTo: '/admin/dashboard',
  });

  return { ok: false, error: { code: 'INTERNAL' } };
}
