import 'dotenv/config';
import path from 'node:path';
import type { PrismaConfig } from 'prisma';

// Prisma 7 では schema.prisma に url を書けないので prisma.config.ts に集約。
// CLI (migrate / db push / generate) は DIRECT_URL を使う。pgBouncer (transaction mode)
// 経由では DDL に必要な advisory lock が取れないため必須。
// runtime の PrismaClient は src/lib/db.ts で driver adapter (@prisma/adapter-pg) 経由で
// DATABASE_URL (pooled) に接続する別経路。
const migrateUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

export default {
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: migrateUrl,
  },
} satisfies PrismaConfig;
