// Sentry クライアントサイド (browser) 初期化。Next.js 15.1+ の instrumentation-client 規約。
// global error handler / unhandled rejection / window.onerror を Sentry SDK が自動 hook する。
//
// クライアント向け env は NEXT_PUBLIC_ prefix が必須 (build 時 inlining のため)。
// Sentry DSN は write-only ingestion token なので公開しても安全。

import * as Sentry from '@sentry/nextjs';

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}

// App Router 内のクライアント遷移を Sentry がトレースするための hook (Next 15.1+)。
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
