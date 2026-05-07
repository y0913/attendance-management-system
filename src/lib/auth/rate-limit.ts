// magic link 送信のレート制限。
//
// 注意: in-memory 実装。マルチインスタンス / serverless 環境では各インスタンスで
// 独立にカウントされるため緩くなる。本番で厳密に制限したい場合は Redis (upstash 等)
// または DB (Postgres の sliding window) ベースに置き換える。

const buckets = new Map<string, { count: number; resetAt: number }>();

const PER_EMAIL_MAX = 5; // 15 分あたり最大 5 通
const WINDOW_MS = 15 * 60 * 1000;

// 古いバケットの掃除（メモリリーク防止）。リクエストごとに amortized で実行。
const sweep = (now: number): void => {
  if (buckets.size < 1000) return;
  for (const [k, v] of buckets) {
    if (v.resetAt < now) buckets.delete(k);
  }
};

export function checkMagicLinkRateLimit(email: string): boolean {
  const now = Date.now();
  sweep(now);
  const key = `email:${email.toLowerCase()}`;
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= PER_EMAIL_MAX) return false;
  bucket.count += 1;
  return true;
}

// テスト用。本番コードからは呼ばない。
export function _resetMagicLinkRateLimitForTesting(): void {
  buckets.clear();
}
