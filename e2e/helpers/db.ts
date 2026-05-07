// E2E 用 DB ヘルパ。test DB に対して seed/truncate する。
// テストごとに固有 prefix の email/id を使えば並列実行で衝突しない。

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

export const COMPANY_ID = 'co_default';

export async function ensureCompany(): Promise<void> {
  await prisma.company.upsert({
    where: { id: COMPANY_ID },
    create: {
      id: COMPANY_ID,
      name: 'E2E テスト株式会社',
      closingDay: 0,
      midMonthRateChangeStrategy: 'month_end',
    },
    update: {},
  });
}

export interface SeedUserInput {
  id?: string;
  email: string;
  name?: string;
  role?: 'admin' | 'approver' | 'general';
  managerId?: string | null;
}

export async function seedUser(input: SeedUserInput) {
  return prisma.user.create({
    data: {
      id: input.id ?? `u_${Math.random().toString(36).slice(2, 10)}`,
      email: input.email,
      name: input.name ?? 'E2E ユーザー',
      companyId: COMPANY_ID,
      role: input.role ?? 'general',
      managerId: input.managerId ?? null,
      employmentType: 'monthly',
      hiredAt: new Date('2023-04-01'),
      baseSalary: 300000,
    },
  });
}

// E2E は test DB を使うので、テスト前に user-data 系テーブルを全部 TRUNCATE。
// companies は seed として残す。
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
  'work_rule_versions',
  'users',
];

export async function resetTestDb(): Promise<void> {
  const list = TRUNCATE_TABLES.map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`,
  );
}

export { prisma };
