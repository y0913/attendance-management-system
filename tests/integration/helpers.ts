// Integration テストの共通 fixture。各テストの先頭で呼んで最低限の親レコードを投入する。

import { prisma } from '@/lib/db';

export const COMPANY_ID = 'co_default';

export async function seedCompany(): Promise<void> {
  await prisma.company.upsert({
    where: { id: COMPANY_ID },
    create: {
      id: COMPANY_ID,
      name: 'テスト株式会社',
      closingDay: 0,
      midMonthRateChangeStrategy: 'month_end',
    },
    update: {},
  });
}

export interface SeedUserInput {
  id?: string;
  email?: string;
  name?: string;
  role?: 'admin' | 'approver' | 'general';
  managerId?: string | null;
  employmentType?: 'monthly' | 'hourly';
  hiredAt?: Date;
  baseSalary?: number | null;
  deactivatedAt?: Date | null;
}

export async function seedUser(input: SeedUserInput = {}) {
  return prisma.user.create({
    data: {
      id: input.id ?? `u_${Math.random().toString(36).slice(2, 10)}`,
      email: input.email ?? `${Math.random().toString(36).slice(2, 10)}@example.com`,
      name: input.name ?? 'テスト ユーザー',
      companyId: COMPANY_ID,
      role: input.role ?? 'general',
      managerId: input.managerId ?? null,
      employmentType: input.employmentType ?? 'monthly',
      hiredAt: input.hiredAt ?? new Date('2023-04-01'),
      baseSalary: input.baseSalary ?? 300000,
      deactivatedAt: input.deactivatedAt ?? null,
    },
  });
}
