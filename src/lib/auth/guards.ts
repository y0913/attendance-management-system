// Server Action 用の認証・粗いロール認可ヘルパ。
// 各 action 冒頭で必ず呼び、!ok なら即 return。
// リソース所有権（自部下チェック等）の細かい認可はここではなく policies / data 層側で行う。

import type { Role } from '@prisma/client';
import type { ActionResult } from '@/lib/action-result';
import type { MockUser } from '@/lib/data/users';
import { getMockSession } from '@/lib/data/session';

type SessionWithRole<R extends Role> = MockUser & { role: R };

export type Guard<R extends Role = Role> =
  | { ok: true; session: SessionWithRole<R> }
  | { ok: false; result: ActionResult<never> };

const unauthorized: ActionResult<never> = {
  ok: false,
  error: { code: 'UNAUTHORIZED' },
};

const forbidden: ActionResult<never> = {
  ok: false,
  error: { code: 'FORBIDDEN' },
};

export async function requireSession(): Promise<Guard> {
  const session = await getMockSession();
  if (!session) return { ok: false, result: unauthorized };
  return { ok: true, session };
}

export async function requireAdmin(): Promise<Guard<'admin'>> {
  const session = await getMockSession();
  if (!session) return { ok: false, result: unauthorized };
  if (session.role !== 'admin') return { ok: false, result: forbidden };
  return { ok: true, session: session as SessionWithRole<'admin'> };
}

export async function requireApprover(): Promise<Guard<'approver' | 'admin'>> {
  const session = await getMockSession();
  if (!session) return { ok: false, result: unauthorized };
  if (session.role !== 'approver' && session.role !== 'admin') {
    return { ok: false, result: forbidden };
  }
  return {
    ok: true,
    session: session as SessionWithRole<'approver' | 'admin'>,
  };
}
