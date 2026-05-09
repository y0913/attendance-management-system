// Sentry サーバーサイド (Node runtime) 初期化。
// instrumentation.ts の register() から runtime=nodejs のときだけ import される。
// SENTRY_DSN 未設定なら init を呼ばないので、SDK は完全に no-op となる。

import * as Sentry from '@sentry/nextjs';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}
