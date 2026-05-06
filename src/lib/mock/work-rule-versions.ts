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
  dailyOtThresholdMaxMin: 480, // 1日8時間まで（これを超えると残業扱い必須）
  weeklyOtThresholdMaxMin: 2400, // 週40時間
  monthly60hThresholdMaxMin: 3600, // 60時間
} as const;

const store: MockWorkRuleVersion[] = [];

let seeded = false;
function ensureSeeded(): void {
  if (seeded) return;
  seeded = true;
  store.push({
    id: 'wrv_seed_0',
    validFrom: new Date('2020-01-01T00:00:00+09:00'),
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
    createdAt: new Date('2020-01-01T00:00:00+09:00'),
    createdById: 'u_admin',
  });
}

export function listWorkRuleVersions(): MockWorkRuleVersion[] {
  ensureSeeded();
  return store
    .slice()
    .sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime());
}

export function findWorkRuleVersionById(
  id: string,
): MockWorkRuleVersion | null {
  ensureSeeded();
  return store.find((v) => v.id === id) ?? null;
}

export function getCurrentWorkRuleVersion(
  asOf: Date = new Date(),
): MockWorkRuleVersion | null {
  ensureSeeded();
  const candidates = store.filter((v) => v.validFrom.getTime() <= asOf.getTime());
  if (candidates.length === 0) return null;
  return candidates.reduce((latest, v) =>
    v.validFrom.getTime() > latest.validFrom.getTime() ? v : latest,
  );
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
  const current = getCurrentWorkRuleVersionFrom(allVersions, asOf);
  return current?.id === version.id ? 'current' : 'past';
}

function getCurrentWorkRuleVersionFrom(
  versions: MockWorkRuleVersion[],
  asOf: Date,
): MockWorkRuleVersion | null {
  const candidates = versions.filter((v) => v.validFrom.getTime() <= asOf.getTime());
  if (candidates.length === 0) return null;
  return candidates.reduce((latest, v) =>
    v.validFrom.getTime() > latest.validFrom.getTime() ? v : latest,
  );
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

export function createWorkRuleVersion(
  input: RuleInput,
  createdById: string,
): MockWorkRuleVersion {
  ensureSeeded();
  const created: MockWorkRuleVersion = {
    id: `wrv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ...input,
    createdAt: new Date(),
    createdById,
  };
  // 同じ valid_from の重複を防止: 同日があれば呼び出し側で弾く
  store.push(created);
  return created;
}

export function updateWorkRuleVersion(
  id: string,
  input: RuleInput,
): MockWorkRuleVersion | null {
  const target = store.find((v) => v.id === id);
  if (!target) return null;
  target.validFrom = input.validFrom;
  target.dailyOtThresholdMin = input.dailyOtThresholdMin;
  target.weeklyOtThresholdMin = input.weeklyOtThresholdMin;
  target.otRate = input.otRate;
  target.nightStartTime = input.nightStartTime;
  target.nightEndTime = input.nightEndTime;
  target.nightRateAddition = input.nightRateAddition;
  target.legalHolidayRate = input.legalHolidayRate;
  target.monthly60hOtRate = input.monthly60hOtRate;
  target.monthly60hThresholdMin = input.monthly60hThresholdMin;
  target.complianceMode = input.complianceMode;
  return target;
}

export function deleteWorkRuleVersion(id: string): boolean {
  const idx = store.findIndex((v) => v.id === id);
  if (idx < 0) return false;
  store.splice(idx, 1);
  return true;
}

export function isValidFromTaken(
  validFrom: Date,
  exceptId?: string,
): boolean {
  return store.some(
    (v) =>
      v.id !== exceptId && v.validFrom.getTime() === validFrom.getTime(),
  );
}
