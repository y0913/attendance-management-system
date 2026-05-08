// 指数バックオフで一時的な競合エラーを再試行するヘルパ。
// 対象: Prisma P2034 (deadlock detected) と
// Postgres SQLSTATE 40001 (serialization failure) / 40P01 (deadlock detected)。
// それ以外は即時 throw する。

// db.ts から re-export しているので、利用側は `import { withRetry } from '@/lib/db'`
// で参照できる。本ファイルは Prisma client を初期化しないため、テストから
// DATABASE_URL なしで読み込めるよう分離している。

import { Prisma } from '@prisma/client';

export type RetryableErrorClassifier = (e: unknown) => boolean;

export const isRetryableDbError: RetryableErrorClassifier = (e) => {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2034') return true;
  }
  // pg ドライバから上がってくる SQLSTATE。Prisma 経由でも meta に乗ることがある。
  const code = (e as { code?: unknown } | null)?.code;
  if (code === '40001' || code === '40P01') return true;
  return false;
};

export interface WithRetryOptions {
  max?: number;
  baseMs?: number;
  isRetryable?: RetryableErrorClassifier;
  onRetry?: (e: unknown, attempt: number) => void;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: WithRetryOptions = {},
): Promise<T> {
  const max = opts.max ?? 3;
  const baseMs = opts.baseMs ?? 50;
  const isRetryable = opts.isRetryable ?? isRetryableDbError;
  const sleep = opts.sleep ?? defaultSleep;

  let lastErr: unknown;
  for (let attempt = 0; attempt < max; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!isRetryable(e) || attempt === max - 1) throw e;
      opts.onRetry?.(e, attempt);
      await sleep(2 ** attempt * baseMs);
    }
  }
  throw lastErr;
}
