import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

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
