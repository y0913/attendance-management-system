// Sentry capture 用の薄いラッパ。
//
// - 初期化は src/instrumentation.ts (server/edge) と src/instrumentation-client.ts (browser)
//   が担当。SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN 未設定なら Sentry SDK は no-op。
// - logActionError / route handler から captureException を呼ぶことで、本番のサーバ側エラーが
//   Vercel Logs だけでなく Sentry にも集約される (検索 / 通知 / グルーピング)。
// - @sentry/nextjs は server / edge / browser の各 runtime に応じて自動的に正しい SDK を解決する。

import * as Sentry from '@sentry/nextjs';

export function captureException(
  err: unknown,
  context?: { action?: string; userId?: string; extra?: Record<string, unknown> },
): void {
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
