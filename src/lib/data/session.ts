// NextAuth v5 への移行に合わせて、`getMockSession` を `auth()` のラッパーに変更。
// 既存ページが期待する `MockUser` 形式を維持するため、JWT に乗っている最小情報から
// DB の最新ユーザー情報をフェッチして返す。

import { cache } from 'react';
import { auth } from '@/auth';
import { findMockUserById, type MockUser } from './users';

// React.cache でリクエスト内 memoize。同一 request の Server Component 木で
// 何度呼んでも auth() + DB fetch は 1 回しか走らない (Next.js の React は
// リクエスト境界で新しい cache インスタンスを作るので、リクエスト間では共有されない)。
export const getMockSession = cache(async (): Promise<MockUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await findMockUserById(session.user.id);
  if (!user) return null;
  if (user.deactivatedAt !== null) return null;
  return user;
});

export const MOCK_SESSION_COOKIE = 'authjs.session-token';
