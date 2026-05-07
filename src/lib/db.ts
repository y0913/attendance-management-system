import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';

// Prisma 7 は driver adapter 必須。
// node-postgres (pg) を経由して PostgreSQL に接続する。

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const buildClient = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
};

export const prisma = globalForPrisma.prisma ?? buildClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// 合成可能なトランザクション型。
// データ層関数は `db: DbClient = prisma` を受け取り、
// 呼び出し側が `prisma.$transaction(async tx => ...)` で囲める。
export type Tx = Prisma.TransactionClient;
export type DbClient = PrismaClient | Tx;

// 既にトランザクション内なら fn(tx) を実行、外なら新規 tx を開く。
// 多段呼び出しでも savepoint 入れ子にならない。
export async function withTx<T>(
  db: DbClient,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  if ('$transaction' in db && typeof db.$transaction === 'function') {
    return db.$transaction(fn);
  }
  return fn(db as Tx);
}
