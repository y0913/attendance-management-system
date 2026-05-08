// Vercel Cron 経由で日 1 回叩かれるヘルスチェック route。
// 役割:
//   1. Supabase Free の自動 pause (7 日アクセスなし) を防ぐ ping
//   2. DB 疎通の死活監視。失敗時は Sentry に自動送信される
//
// 認可: Vercel Cron は `Authorization: Bearer $CRON_SECRET` を付けて自動で呼ぶ。
// CRON_SECRET 未設定 / mismatch のリクエストは 401 で弾く。
//
// `/api/cron/` prefix は middleware の PUBLIC_PATHS 扱いなので、ロール認可は通らない。

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { captureException } from '@/lib/sentry';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

// Vercel Cron は GET で呼ぶ (vercel.json の path のみ指定されたケース)。
// `Authorization: Bearer $CRON_SECRET` を Vercel が自動付与する。
export async function GET(req: Request): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // 本番で CRON_SECRET 未設定なら fail-fast: 認可不能。dev / preview で誤って外部から
    // 叩かれないよう 503 を返す。
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET not configured' },
      { status: 503 },
    );
  }

  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const start = Date.now();
    const companyCount = await prisma.company.count();
    const elapsedMs = Date.now() - start;
    logger.info(
      { event: 'cron.health.ok', companyCount, elapsedMs },
      'cron health check ok',
    );
    return NextResponse.json({
      ok: true,
      companyCount,
      elapsedMs,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ event: 'cron.health.failed', err }, 'cron health check failed');
    captureException(err, { action: 'cronHealth' });
    return NextResponse.json(
      { ok: false, error: 'db ping failed' },
      { status: 500 },
    );
  }
}
