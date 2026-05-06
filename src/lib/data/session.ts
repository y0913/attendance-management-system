// NextAuth v5 への移行に合わせて、`getMockSession` を `auth()` のラッパーに変更。
// 既存ページが期待する `MockUser` 形式を維持するため、JWT に乗っている最小情報から
// DB の最新ユーザー情報をフェッチして返す。

import { auth } from '@/auth';
import { findMockUserById, type MockUser } from './users';

export async function getMockSession(): Promise<MockUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await findMockUserById(session.user.id);
  if (!user) return null;
  if (user.deactivatedAt !== null) return null;
  return user;
}

export const MOCK_SESSION_COOKIE = 'authjs.session-token';
