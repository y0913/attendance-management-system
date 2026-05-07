import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import authConfig from '@/auth.config';

// Middleware は edge runtime 想定なので、Prisma adapter 等を含まない
// edge-safe な auth.config だけで NextAuth を初期化する。
const { auth } = NextAuth(authConfig);

// セッション認証「以外」で守るパス、または認証不要なパス。middleware は素通しする。
// - /login: ログイン画面（未認証で見せたい）
// - /api/auth/*: NextAuth 自身のフロー
// - /api/public/*: 公開 API（将来）
// - /api/webhooks/*: 署名検証で守る webhook 受信（将来）
// - /api/cron/*: シークレットヘッダで守る cron 起動（将来）
const PUBLIC_EXACT_PATHS = ['/login'];
const PUBLIC_PATH_PREFIXES = [
  '/api/auth/',
  '/api/public/',
  '/api/webhooks/',
  '/api/cron/',
];

const isPublicPath = (pathname: string): boolean =>
  PUBLIC_EXACT_PATHS.includes(pathname) ||
  PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));

const isApiPath = (pathname: string): boolean => pathname.startsWith('/api/');

// ロールベースのパスガード。JWT の role は古い可能性があるが、
// 「権限が下がる方向の変更」しか起きないので「general が admin パスを見れない」の
// 検知としては十分。最終的な認可は page / route handler / server action 側で行う (深い防御)。
const requiresAdmin = (pathname: string): boolean =>
  pathname.startsWith('/admin') || pathname.startsWith('/api/admin');

const requiresApprover = (pathname: string): boolean =>
  pathname.startsWith('/team') || pathname.startsWith('/api/team');

const denyOrRedirect = (
  req: Parameters<Parameters<typeof auth>[0]>[0],
  reason: 'unauth' | 'forbidden',
): Response => {
  const { pathname } = req.nextUrl;
  if (isApiPath(pathname)) {
    return new NextResponse(reason === 'unauth' ? 'Unauthorized' : 'Forbidden', {
      status: reason === 'unauth' ? 401 : 403,
    });
  }
  const url = req.nextUrl.clone();
  url.pathname = reason === 'unauth' ? '/login' : '/clock';
  return NextResponse.redirect(url);
};

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthed = !!req.auth?.user?.id;
  const role = req.auth?.user?.role;
  const isPublic = isPublicPath(pathname);

  if (!isAuthed && !isPublic) {
    return denyOrRedirect(req, 'unauth');
  }

  if (isAuthed && pathname === '/login') {
    const url = req.nextUrl.clone();
    url.pathname = '/clock';
    return NextResponse.redirect(url);
  }

  if (isAuthed) {
    if (requiresAdmin(pathname) && role !== 'admin') {
      return denyOrRedirect(req, 'forbidden');
    }
    if (
      requiresApprover(pathname) &&
      role !== 'approver' &&
      role !== 'admin'
    ) {
      return denyOrRedirect(req, 'forbidden');
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
