// Sentry の遅延初期化 + キャプチャ用シン薄ラッパ。
//
// - SENTRY_DSN が未設定なら何もしない (dev / test / portfolio 自宅運用で OK)。
// - 初回 import 時に init() を 1 度だけ呼ぶ。Vercel の serverless では invocation
//   ごとに module 評価される可能性があるが、Sentry SDK 自体は重複 init を吸収する。
// - logActionError から captureException を呼ぶことで、本番のサーバ側エラーが
//   Vercel Logs だけでなく Sentry にも集約される (検索 / 通知 / グルーピング)。

import * as Sentry from '@sentry/node';

let initialized = false;

function ensureInit(): void {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return; // 未設定なら no-op (Sentry.captureException も SDK 側で no-op になる)
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    // 本番だけサンプリング率を絞る。dev / preview は全送信。
    tracesSampleRate: 0,
    // PII (request body 等) は送らない。誤って個人情報を流さないため。
    sendDefaultPii: false,
  });
  initialized = true;
}

export function captureException(
  err: unknown,
  context?: { action?: string; userId?: string; extra?: Record<string, unknown> },
): void {
  if (!process.env.SENTRY_DSN) return;
  ensureInit();
  Sentry.withScope((scope) => {
    if (context?.action) scope.setTag('action', context.action);
    if (context?.userId) scope.setUser({ id: context.userId });
    if (context?.extra) {
      for (const [k, v] of Object.entries(context.extra)) {
        scope.setExtra(k, v);
      }
    }
    Sentry.captureException(err);
  });
}
