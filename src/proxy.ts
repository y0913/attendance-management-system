import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import authConfig from '@/auth.config';

// Middleware は edge runtime 想定なので、Prisma adapter 等を含まない
// edge-safe な auth.config だけで NextAuth を初期化する。
const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ['/login'];

const isPublicPath = (pathname: string): boolean =>
  PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/api/auth');

// ロールベースのパスガード。JWT の role は古い可能性があるが、
// 「権限が下がる方向の変更」しか起きないので「general が admin パスを見れない」の
// 検知としては十分。最終的な認可は page と server action 側で行う (深い防御)。
const requiresAdmin = (pathname: string): boolean =>
  pathname.startsWith('/admin');

const requiresApprover = (pathname: string): boolean =>
  pathname.startsWith('/team');

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthed = !!req.auth?.user?.id;
  const role = req.auth?.user?.role;
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

  if (isAuthed) {
    if (requiresAdmin(pathname) && role !== 'admin') {
      const url = req.nextUrl.clone();
      url.pathname = '/clock';
      return NextResponse.redirect(url);
    }
    if (
      requiresApprover(pathname) &&
      role !== 'approver' &&
      role !== 'admin'
    ) {
      const url = req.nextUrl.clone();
      url.pathname = '/clock';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
