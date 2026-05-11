'use server';

import { Role } from '@prisma/client';
import { z } from 'zod';
import { signIn } from '@/auth';
import type { ActionResult } from '@/lib/action-result';
import { createMockUser, findMockUserByEmail } from '@/lib/data/users';

const SignUpSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(50),
  role: z.nativeEnum(Role),
});

export async function signUpAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const parsed = SignUpSchema.safeParse({
    email: formData.get('email'),
    name: formData.get('name'),
    role: formData.get('role'),
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

  await createMockUser({
    email: parsed.data.email,
    name: parsed.data.name,
    role: parsed.data.role,
    managerId: null,
    employmentType: 'monthly',
    hiredAt: new Date(),
    baseSalary: null,
  });

  await signIn('nodemailer', {
    email: parsed.data.email,
    redirectTo: '/clock',
  });

  return { ok: false, error: { code: 'INTERNAL' } };
}
