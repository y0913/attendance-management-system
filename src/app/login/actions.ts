'use server';

import { redirect } from 'next/navigation';
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

  // メアド列挙リーク防止: 未登録/無効化ユーザーでも UI は同じ「リンク送信した」を
  // 返す。実際の送信は登録済 + 有効ユーザーのみ。攻撃者はレスポンスから
  // メアドの存在を判別できない。
  const user = await findMockUserByEmail(parsed.data.email);
  if (user && user.deactivatedAt === null) {
    // signIn は内部で verifyRequest ページへ redirect を throw する。
    await signIn('nodemailer', {
      email: parsed.data.email,
      redirectTo: '/clock',
    });
    // 通常ここに到達しない
    return { ok: false, error: { code: 'INTERNAL' } };
  }

  // 未登録 or 無効化ユーザー: メールは送らず、登録済ユーザーと同じ画面に
  // redirect して enumeration を不能にする。
  redirect('/login?verify=1');
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: '/login' });
}
