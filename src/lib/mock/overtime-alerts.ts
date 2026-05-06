import {
  estimateMonthlyOvertime,
  type OvertimeEstimate,
} from '@/lib/calc/overtime-estimate';
import { getEffectiveMonthlySummary } from './attendance-closings';
import { listActiveUsers, type MockUser } from './users';

export interface OvertimeAlertItem {
  user: MockUser;
  estimate: OvertimeEstimate;
  isClosed: boolean;
}

export async function listOvertimeAlerts(
  yearMonth: string,
): Promise<OvertimeAlertItem[]> {
  const users = await listActiveUsers();
  return users
    .map((user) => {
      const summary = getEffectiveMonthlySummary(user.id, yearMonth);
      const estimate = estimateMonthlyOvertime(yearMonth, summary.daily);
      return { user, estimate, isClosed: summary.isClosed };
    })
    .filter((item) => item.estimate.exceedsThreshold)
    .sort(
      (a, b) =>
        b.estimate.estimatedOtMinutes - a.estimate.estimatedOtMinutes,
    );
}

export async function countOvertimeAlerts(yearMonth: string): Promise<number> {
  return (await listOvertimeAlerts(yearMonth)).length;
}
