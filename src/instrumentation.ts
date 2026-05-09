// Next.js の instrumentation hook。
// - register(): runtime に応じて Sentry の server/edge config を import する
// - onRequestError: nested route (server component / route handler) で
//   throw された例外を Sentry が自動 capture する hook

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  } else if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export { captureRequestError as onRequestError } from '@sentry/nextjs';
