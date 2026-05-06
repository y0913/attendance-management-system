import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import authConfig from '@/auth.config';

// Middleware は edge runtime 想定なので、Prisma adapter 等を含まない
// edge-safe な auth.config だけで NextAuth を初期化する。
const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ['/login'];

const isPublicPath = (pathname: string): boolean =>
  PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/api/auth');

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthed = !!req.auth?.user?.id;
  const isPublic = isPublicPath(pathname);

  if (!isAuthed && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (isAuthed && pathname === '/login') {
    const url = req.nextUrl.clone();
    url.pathname = '/clock';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
