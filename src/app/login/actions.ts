'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  clearMockSession,
  setMockSession,
} from '@/lib/mock/session';
import { findMockUserByEmail } from '@/lib/mock/users';
import type { ActionResult } from '@/lib/action-result';

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

  const user = await findMockUserByEmail(parsed.data.email);
  if (!user) {
    return { ok: false, error: { code: 'NOT_FOUND' } };
  }

  await setMockSession(user.id);
  redirect('/clock');
}

export async function signOutAction(): Promise<void> {
  await clearMockSession();
  redirect('/login');
}
