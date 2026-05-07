// Phase 5: 内部を Prisma 経由に書き換え。すべて async。
//
// Prisma の Decimal 型 ↔ number は Number() で変換。
// classifyVersionStatus は pure 関数のままで OK（既に取得済みの versions を渡す）。

import type { WorkRuleVersion } from '@prisma/client';
import { prisma, type DbClient } from '@/lib/db';

export interface MockWorkRuleVersion {
  id: string;
  validFrom: Date;
  dailyOtThresholdMin: number;
  weeklyOtThresholdMin: number;
  otRate: number;
  nightStartTime: string; // HH:mm
  nightEndTime: string; // HH:mm
  nightRateAddition: number;
  legalHolidayRate: number;
  monthly60hOtRate: number;
  monthly60hThresholdMin: number;
  complianceMode: boolean;
  createdAt: Date;
  createdById: string;
}

export const LEGAL_MINIMUMS = {
  otRate: 1.25,
  nightRateAddition: 0.25,
  legalHolidayRate: 1.35,
  monthly60hOtRate: 1.5,
  dailyOtThresholdMaxMin: 480, // 1日8時間まで
  weeklyOtThresholdMaxMin: 2400, // 週40時間
  monthly60hThresholdMaxMin: 3600, // 60時間
} as const;

const DEFAULT_COMPANY_ID = 'co_default';

const toMockWorkRuleVersion = (v: WorkRuleVersion): MockWorkRuleVersion => ({
  id: v.id,
  validFrom: v.validFrom,
  dailyOtThresholdMin: v.dailyOtThresholdMin,
  weeklyOtThresholdMin: v.weeklyOtThresholdMin,
  otRate: Number(v.otRate),
  nightStartTime: v.nightStartTime,
  nightEndTime: v.nightEndTime,
  nightRateAddition: Number(v.nightRateAddition),
  legalHolidayRate: Number(v.legalHolidayRate),
  monthly60hOtRate: Number(v.monthly60hOtRate),
  monthly60hThresholdMin: v.monthly60hThresholdMin,
  complianceMode: v.complianceMode,
  createdAt: v.createdAt,
  createdById: v.createdById,
});

export async function listWorkRuleVersions(): Promise<MockWorkRuleVersion[]> {
  const list = await prisma.workRuleVersion.findMany({
    where: { companyId: DEFAULT_COMPANY_ID },
    orderBy: { validFrom: 'asc' },
  });
  return list.map(toMockWorkRuleVersion);
}

export async function findWorkRuleVersionById(
  id: string,
): Promise<MockWorkRuleVersion | null> {
  const v = await prisma.workRuleVersion.findUnique({ where: { id } });
  return v ? toMockWorkRuleVersion(v) : null;
}

export async function getCurrentWorkRuleVersion(
  asOf: Date = new Date(),
): Promise<MockWorkRuleVersion | null> {
  const v = await prisma.workRuleVersion.findFirst({
    where: {
      companyId: DEFAULT_COMPANY_ID,
      validFrom: { lte: asOf },
    },
    orderBy: { validFrom: 'desc' },
  });
  return v ? toMockWorkRuleVersion(v) : null;
}

export function isFutureVersion(
  version: MockWorkRuleVersion,
  asOf: Date = new Date(),
): boolean {
  return version.validFrom.getTime() > asOf.getTime();
}

export type VersionStatus = 'past' | 'current' | 'future';

export function classifyVersionStatus(
  version: MockWorkRuleVersion,
  allVersions: MockWorkRuleVersion[],
  asOf: Date = new Date(),
): VersionStatus {
  if (version.validFrom.getTime() > asOf.getTime()) return 'future';
  const candidates = allVersions.filter(
    (v) => v.validFrom.getTime() <= asOf.getTime(),
  );
  if (candidates.length === 0) return 'past';
  const current = candidates.reduce((latest, v) =>
    v.validFrom.getTime() > latest.validFrom.getTime() ? v : latest,
  );
  return current.id === version.id ? 'current' : 'past';
}

export interface RuleInput {
  validFrom: Date;
  dailyOtThresholdMin: number;
  weeklyOtThresholdMin: number;
  otRate: number;
  nightStartTime: string;
  nightEndTime: string;
  nightRateAddition: number;
  legalHolidayRate: number;
  monthly60hOtRate: number;
  monthly60hThresholdMin: number;
  complianceMode: boolean;
}

export interface ComplianceViolation {
  field: keyof RuleInput;
  message: string;
}

export function checkComplianceViolations(
  input: RuleInput,
): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];
  if (input.otRate < LEGAL_MINIMUMS.otRate) {
    violations.push({
      field: 'otRate',
      message: `法定外残業率は ${LEGAL_MINIMUMS.otRate} 以上が必要です`,
    });
  }
  if (input.nightRateAddition < LEGAL_MINIMUMS.nightRateAddition) {
    violations.push({
      field: 'nightRateAddition',
      message: `深夜割増は +${LEGAL_MINIMUMS.nightRateAddition} 以上が必要です`,
    });
  }
  if (input.legalHolidayRate < LEGAL_MINIMUMS.legalHolidayRate) {
    violations.push({
      field: 'legalHolidayRate',
      message: `法定休日割増は ${LEGAL_MINIMUMS.legalHolidayRate} 以上が必要です`,
    });
  }
  if (input.monthly60hOtRate < LEGAL_MINIMUMS.monthly60hOtRate) {
    violations.push({
      field: 'monthly60hOtRate',
      message: `月60h超の割増は ${LEGAL_MINIMUMS.monthly60hOtRate} 以上が必要です`,
    });
  }
  if (input.dailyOtThresholdMin > LEGAL_MINIMUMS.dailyOtThresholdMaxMin) {
    violations.push({
      field: 'dailyOtThresholdMin',
      message: `日次残業閾値は ${LEGAL_MINIMUMS.dailyOtThresholdMaxMin} 分以下が必要です`,
    });
  }
  if (input.weeklyOtThresholdMin > LEGAL_MINIMUMS.weeklyOtThresholdMaxMin) {
    violations.push({
      field: 'weeklyOtThresholdMin',
      message: `週次残業閾値は ${LEGAL_MINIMUMS.weeklyOtThresholdMaxMin} 分以下が必要です`,
    });
  }
  if (
    input.monthly60hThresholdMin > LEGAL_MINIMUMS.monthly60hThresholdMaxMin
  ) {
    violations.push({
      field: 'monthly60hThresholdMin',
      message: `月60h超の閾値は ${LEGAL_MINIMUMS.monthly60hThresholdMaxMin} 分以下が必要です`,
    });
  }
  return violations;
}

export async function createWorkRuleVersion(
  input: RuleInput,
  createdById: string,
  db: DbClient = prisma,
): Promise<MockWorkRuleVersion> {
  const created = await db.workRuleVersion.create({
    data: {
      companyId: DEFAULT_COMPANY_ID,
      validFrom: input.validFrom,
      dailyOtThresholdMin: input.dailyOtThresholdMin,
      weeklyOtThresholdMin: input.weeklyOtThresholdMin,
      otRate: input.otRate,
      nightStartTime: input.nightStartTime,
      nightEndTime: input.nightEndTime,
      nightRateAddition: input.nightRateAddition,
      legalHolidayRate: input.legalHolidayRate,
      monthly60hOtRate: input.monthly60hOtRate,
      monthly60hThresholdMin: input.monthly60hThresholdMin,
      complianceMode: input.complianceMode,
      createdById,
    },
  });
  return toMockWorkRuleVersion(created);
}

export async function updateWorkRuleVersion(
  id: string,
  input: RuleInput,
  db: DbClient = prisma,
): Promise<MockWorkRuleVersion | null> {
  try {
    const updated = await db.workRuleVersion.update({
      where: { id },
      data: {
        validFrom: input.validFrom,
        dailyOtThresholdMin: input.dailyOtThresholdMin,
        weeklyOtThresholdMin: input.weeklyOtThresholdMin,
        otRate: input.otRate,
        nightStartTime: input.nightStartTime,
        nightEndTime: input.nightEndTime,
        nightRateAddition: input.nightRateAddition,
        legalHolidayRate: input.legalHolidayRate,
        monthly60hOtRate: input.monthly60hOtRate,
        monthly60hThresholdMin: input.monthly60hThresholdMin,
        complianceMode: input.complianceMode,
      },
    });
    return toMockWorkRuleVersion(updated);
  } catch {
    return null;
  }
}

export async function deleteWorkRuleVersion(
  id: string,
  db: DbClient = prisma,
): Promise<boolean> {
  try {
    await db.workRuleVersion.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

export async function isValidFromTaken(
  validFrom: Date,
  exceptId?: string,
  db: DbClient = prisma,
): Promise<boolean> {
  const v = await db.workRuleVersion.findFirst({
    where: {
      companyId: DEFAULT_COMPANY_ID,
      validFrom,
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
  });
  return v !== null;
}
