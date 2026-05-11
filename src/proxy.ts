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
const PUBLIC_EXACT_PATHS = ['/login', '/signup'];
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

// リクエスト毎に nonce を発行し、Next.js が inline runtime script に
// 自動適用できるよう `x-nonce` リクエストヘッダ経由で伝搬する。
// Edge runtime 想定のため Web Crypto / btoa を使用。
const generateNonce = (): string => btoa(crypto.randomUUID());

const isDev = process.env.NODE_ENV === 'development';

const buildCsp = (nonce: string): string =>
  [
    `default-src 'self'`,
    // 本番は nonce ベースで厳格化。dev は Turbopack HMR が動的 inline script を
    // 注入する関係で 'unsafe-inline' も許可しないと HMR が壊れて全リロード loop に陥る。
    // 'unsafe-eval' も Turbopack 内部で必要。
    isDev
      ? `script-src 'self' 'unsafe-inline' 'unsafe-eval'`
      : `script-src 'self' 'nonce-${nonce}'`,
    // Tailwind は SSR で inline style を出すため、style に nonce 適用が難しく
    // 'unsafe-inline' を許容する。inline style は XSS のリスクが script より低い。
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self' data:`,
    // dev の HMR は WebSocket 経由。
    `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
  ].join('; ');

// クリックジャッキング/MIME sniffing/XSS 対策のセキュリティヘッダ。
// すべてのレスポンス経路（next / redirect / 401 / 403）で付与する。
const applySecurityHeaders = (res: Response, nonce: string): Response => {
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Content-Security-Policy', buildCsp(nonce));
  return res;
};

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthed = !!req.auth?.user?.id;
  const role = req.auth?.user?.role;
  const isPublic = isPublicPath(pathname);

  const nonce = generateNonce();

  if (!isAuthed && !isPublic) {
    return applySecurityHeaders(denyOrRedirect(req, 'unauth'), nonce);
  }

  if (isAuthed && (pathname === '/login' || pathname === '/signup')) {
    const url = req.nextUrl.clone();
    url.pathname = '/clock';
    return applySecurityHeaders(NextResponse.redirect(url), nonce);
  }

  if (isAuthed) {
    if (requiresAdmin(pathname) && role !== 'admin') {
      return applySecurityHeaders(denyOrRedirect(req, 'forbidden'), nonce);
    }
    if (
      requiresApprover(pathname) &&
      role !== 'approver' &&
      role !== 'admin'
    ) {
      return applySecurityHeaders(denyOrRedirect(req, 'forbidden'), nonce);
    }
  }

  // Next.js が自動で nonce を inline script に適用するため、
  // request header に焼いて renderer に渡す。
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);

  return applySecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    nonce,
  );
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon).*)'],
};
