// 構造化ロガー (pino)。
// - prod: JSON 1 行 / line (ログ集約サービス向け)
// - dev: pino-pretty で人間可読 (色付き / タイムスタンプ短縮)
// - test: silent (LOG_LEVEL=silent または NODE_ENV=test で抑止)
//
// 直接 logger.error(...) を呼んでもよいが、Server Action から共通的に投げる
// 「想定外例外を INTERNAL fallback と一緒にログする」ケースは logActionError を使う。

import pino from 'pino';

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test' || process.env.LOG_LEVEL === 'silent';

const level = process.env.LOG_LEVEL ?? (isTest ? 'silent' : isProd ? 'info' : 'debug');

export const logger = pino({
  level,
  // prod は JSON / dev は pino-pretty。pino-pretty は require 解決を遅延するので
  // dev でしか transport を立ち上げない (prod に余計な依存を持ち込まない)。
  ...(isProd || isTest
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss.l' },
        },
      }),
});

export interface ActionErrorContext {
  action: string;
  userId?: string | null;
  err: unknown;
  // 任意の追加コンテキスト (input id 等)。
  extra?: Record<string, unknown>;
}

// Server Action の catch 句から呼ぶ標準ロガー。
// 出力例: {"level":50,"time":...,"action":"closeMonthAction","userId":"u_admin","err":{"type":"Error",...},"msg":"closeMonthAction failed"}
export function logActionError({
  action,
  userId,
  err,
  extra,
}: ActionErrorContext): void {
  logger.error(
    {
      action,
      userId: userId ?? undefined,
      err,
      ...extra,
    },
    `${action} failed`,
  );
}
