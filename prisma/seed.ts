// Phase 1 seed: 会社 1 件 / ユーザー 3 名 / 労働ルール 1 件 のみ。
// Phase 2 以降で時刻打刻・申請データなども順次追加する。
//
// 既存の `src/lib/mock/seed-*.ts` と同じ値を使い、Prisma 経由で投入する。
// 冪等にするため upsert を使用（再実行で重複作成しない）。

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const company = await prisma.company.upsert({
    where: { id: 'co_default' },
    create: {
      id: 'co_default',
      name: 'サンプル株式会社',
      closingDay: 0, // 月末
      midMonthRateChangeStrategy: 'month_end',
    },
    update: {},
  });
  console.log(`✓ company: ${company.name}`);

  const adminEmail = 'admin@example.com';
  const approverEmail = 'approver@example.com';
  const generalEmail = 'general@example.com';

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      id: 'u_admin',
      email: adminEmail,
      name: '管理 太郎',
      companyId: company.id,
      role: 'admin',
      managerId: null,
      employmentType: 'monthly',
      hiredAt: new Date('2018-04-01T00:00:00+09:00'),
      baseSalary: 600000,
    },
    update: {},
  });
  console.log(`✓ user: ${admin.name}`);

  const approver = await prisma.user.upsert({
    where: { email: approverEmail },
    create: {
      id: 'u_approver',
      email: approverEmail,
      name: '承認 花子',
      companyId: company.id,
      role: 'approver',
      managerId: admin.id,
      employmentType: 'monthly',
      hiredAt: new Date('2021-04-01T00:00:00+09:00'),
      baseSalary: 450000,
    },
    update: {},
  });
  console.log(`✓ user: ${approver.name}`);

  const general = await prisma.user.upsert({
    where: { email: generalEmail },
    create: {
      id: 'u_general',
      email: generalEmail,
      name: '一般 次郎',
      companyId: company.id,
      role: 'general',
      managerId: approver.id,
      employmentType: 'monthly',
      hiredAt: new Date('2023-10-01T00:00:00+09:00'),
      baseSalary: 300000,
    },
    update: {},
  });
  console.log(`✓ user: ${general.name}`);

  const ruleValidFrom = new Date('2020-01-01T00:00:00+09:00');
  const rule = await prisma.workRuleVersion.upsert({
    where: {
      companyId_validFrom: {
        companyId: company.id,
        validFrom: ruleValidFrom,
      },
    },
    create: {
      companyId: company.id,
      validFrom: ruleValidFrom,
      dailyOtThresholdMin: 480,
      weeklyOtThresholdMin: 2400,
      otRate: 1.25,
      nightStartTime: '22:00',
      nightEndTime: '05:00',
      nightRateAddition: 0.25,
      legalHolidayRate: 1.35,
      monthly60hOtRate: 1.5,
      monthly60hThresholdMin: 3600,
      complianceMode: true,
      createdById: admin.id,
    },
    update: {},
  });
  console.log(`✓ work_rule_version: ${rule.validFrom.toISOString()}`);

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
