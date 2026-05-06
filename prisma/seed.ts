// Phase 3 seed: 会社 / ユーザー / 労働ルール / time-clocks / daily-notes
//
// 既存の `src/lib/data/seed-*.ts` と同じ値を使い、Prisma 経由で投入する。
// 冪等のため:
//   - 会社・ユーザー・労働ルールは upsert
//   - time-clocks / daily-notes は対象ユーザー分を deleteMany → 再投入

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { buildSeedRecords } from '../src/lib/data/seed-time-clocks';
import { buildSeedNotes } from '../src/lib/data/seed-daily-notes';
import { buildSeedCorrections } from '../src/lib/data/seed-clock-corrections';
import { buildSeedLeaves } from '../src/lib/data/seed-leave-requests';

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

  // time-clocks: u_general のみ 60 日分（buildSeedRecords が生成）
  const tcRecords = buildSeedRecords();
  await prisma.timeClock.deleteMany({ where: { userId: general.id } });
  if (tcRecords.length > 0) {
    await prisma.timeClock.createMany({
      data: tcRecords.map((r) => ({
        userId: r.userId,
        type: r.type,
        occurredAt: r.occurredAt,
        source: 'web' as const,
      })),
    });
  }
  console.log(`✓ time_clocks: ${tcRecords.length}`);

  // daily-notes: u_general のみ
  const noteRecords = buildSeedNotes();
  await prisma.dailyNote.deleteMany({ where: { userId: general.id } });
  if (noteRecords.length > 0) {
    await prisma.dailyNote.createMany({
      data: noteRecords.map((r) => ({
        userId: r.userId,
        jstDate: r.jstDate,
        content: r.content,
      })),
    });
  }
  console.log(`✓ daily_notes: ${noteRecords.length}`);

  // clock-correction-requests: u_general 3件
  const ccrRecords = buildSeedCorrections();
  await prisma.clockCorrectionRequest.deleteMany({
    where: { requesterId: general.id },
  });
  for (const r of ccrRecords) {
    await prisma.clockCorrectionRequest.create({
      data: {
        requesterId: r.requesterId,
        currentApproverId: r.approverId,
        status: r.status,
        submittedAt: r.submittedAt,
        decidedAt: r.decidedAt,
        reason: r.reason,
        targetDate: new Date(`${r.targetDate}T00:00:00+09:00`),
        beforePayload: r.before as object,
        afterPayload: r.after as object,
      },
    });
  }
  console.log(`✓ clock_correction_requests: ${ccrRecords.length}`);

  // leave-requests: u_general 4件（半日含む）
  const lrRecords = buildSeedLeaves();
  await prisma.leaveRequest.deleteMany({ where: { requesterId: general.id } });
  for (const r of lrRecords) {
    await prisma.leaveRequest.create({
      data: {
        requesterId: r.requesterId,
        currentApproverId: r.approverId,
        status: r.status,
        submittedAt: r.submittedAt,
        decidedAt: r.decidedAt,
        reason: r.reason,
        leaveType: 'annual',
        dayUnit: r.dayUnit,
        startDate: new Date(`${r.startDate}T00:00:00+09:00`),
        endDate: new Date(`${r.endDate}T00:00:00+09:00`),
        days: r.days,
      },
    });
  }
  console.log(`✓ leave_requests: ${lrRecords.length}`);

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
