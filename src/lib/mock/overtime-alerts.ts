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

export function listOvertimeAlerts(yearMonth: string): OvertimeAlertItem[] {
  const users = listActiveUsers();
  return users
    .map((user) => {
      const summary = getEffectiveMonthlySummary(user.id, yearMonth);
      const estimate = estimateMonthlyOvertime(yearMonth, summary.daily);
      return { user, estimate, isClosed: summary.isClosed };
    })
    .filter((item) => item.estimate.exceedsThreshold)
    .sort((a, b) => b.estimate.estimatedOtMinutes - a.estimate.estimatedOtMinutes);
}

export function countOvertimeAlerts(yearMonth: string): number {
  return listOvertimeAlerts(yearMonth).length;
}
