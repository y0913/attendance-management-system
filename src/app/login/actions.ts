'use server';

import { z } from 'zod';
import { signIn, signOut } from '@/auth';
import type { ActionResult } from '@/lib/action-result';
import { findMockUserByEmail } from '@/lib/data/users';

const SignInSchema = z.object({
  email: z.string().email(),
});

export async function signInAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const parsed = SignInSchema.safeParse({
    email: formData.get('email'),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION', details: parsed.error.flatten() },
    };
  }

  // signIn の前に DB に存在するメールかをチェック（NextAuth callback でも検証するが
  // UX 的に存在しないアドレスにメールを送らないように）。
  const user = await findMockUserByEmail(parsed.data.email);
  if (!user || user.deactivatedAt !== null) {
    return { ok: false, error: { code: 'NOT_FOUND' } };
  }

  // Magic link を送信し、verifyRequest ページにリダイレクト。
  await signIn('nodemailer', {
    email: parsed.data.email,
    redirectTo: '/clock',
  });
  // signIn は通常 redirect をスローするためここに到達しない
  return { ok: false, error: { code: 'INTERNAL' } };
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: '/login' });
}
