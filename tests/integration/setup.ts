// Integration テストのグローバル setup。
//   - .env.test を読み込む (DATABASE_URL を test DB に向ける)
//   - 各テスト前に user-data 系テーブルを TRUNCATE して隔離
//   - schema 系テーブル (companies, work_rule_versions の seed 行) は保持

import { config as loadEnv } from 'dotenv';
import { afterAll, beforeEach } from 'vitest';
import path from 'node:path';

loadEnv({ path: path.resolve(__dirname, '../../.env.test'), override: true });

// 動的 import: dotenv で DATABASE_URL を上書きしてから lib/db を読む必要がある。
const { prisma } = await import('@/lib/db');

// TRUNCATE 対象テーブル。companies / work_rule_versions / users は seed で
// 入れる前提なので、ここでは「テスト中に作る関連データ」を消すリストにする。
// テスト本体で seed を呼ぶ設計に統一。
const TRUNCATE_TABLES = [
  'audit_logs',
  'approval_actions',
  'leave_requests',
  'clock_correction_requests',
  'leave_grants',
  'attendance_closings',
  'daily_attendances',
  'time_clocks',
  'daily_notes',
  'sessions',
  'accounts',
  'verification_tokens',
  // 順序: 子テーブル → 親テーブル の順 (CASCADE で吸収するため厳密でなくて OK)
  'work_rule_versions',
  'users',
  'companies',
];

beforeEach(async () => {
  // RESTART IDENTITY でシーケンスもリセット、CASCADE で FK 連鎖を許容
  const list = TRUNCATE_TABLES.map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`,
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});
