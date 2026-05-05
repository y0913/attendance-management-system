import { cookies } from 'next/headers';
import { findMockUserById, type MockUser } from './users';

const COOKIE_NAME = 'mock_user_id';
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 7;

export async function getMockSession(): Promise<MockUser | null> {
  const store = await cookies();
  const id = store.get(COOKIE_NAME)?.value;
  if (!id) return null;
  return findMockUserById(id);
}

export async function setMockSession(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, userId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SEC,
  });
}

export async function clearMockSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export const MOCK_SESSION_COOKIE = COOKIE_NAME;
