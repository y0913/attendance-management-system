'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { upsertWorkRuleAction } from './actions';

export interface WorkRuleFormInitial {
  id?: string;
  validFrom: string; // yyyy-MM-dd
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

interface Props {
  initial: WorkRuleFormInitial;
  isCreate: boolean;
}

const numField = (
  id: string,
  label: string,
  value: number,
  setter: (n: number) => void,
  step = 0.01,
) => (
  <div key={id} className="flex flex-col gap-1.5">
    <Label htmlFor={id}>{label}</Label>
    <Input
      id={id}
      type="number"
      step={step}
      min={0}
      value={value}
      onChange={(e) => setter(Number(e.target.value))}
    />
  </div>
);

export function WorkRuleForm({ initial, isCreate }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [validFrom, setValidFrom] = useState(initial.validFrom);
  const [dailyOt, setDailyOt] = useState(initial.dailyOtThresholdMin);
  const [weeklyOt, setWeeklyOt] = useState(initial.weeklyOtThresholdMin);
  const [otRate, setOtRate] = useState(initial.otRate);
  const [nightStart, setNightStart] = useState(initial.nightStartTime);
  const [nightEnd, setNightEnd] = useState(initial.nightEndTime);
  const [nightAdd, setNightAdd] = useState(initial.nightRateAddition);
  const [holidayRate, setHolidayRate] = useState(initial.legalHolidayRate);
  const [monthly60Rate, setMonthly60Rate] = useState(initial.monthly60hOtRate);
  const [monthly60Threshold, setMonthly60Threshold] = useState(
    initial.monthly60hThresholdMin,
  );
  const [complianceMode, setComplianceMode] = useState(initial.complianceMode);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await upsertWorkRuleAction({
        id: initial.id,
        validFrom,
        dailyOtThresholdMin: dailyOt,
        weeklyOtThresholdMin: weeklyOt,
        otRate,
        nightStartTime: nightStart,
        nightEndTime: nightEnd,
        nightRateAddition: nightAdd,
        legalHolidayRate: holidayRate,
        monthly60hOtRate: monthly60Rate,
        monthly60hThresholdMin: monthly60Threshold,
        complianceMode,
      });
      if (result.ok) {
        router.push('/admin/work-rules');
        router.refresh();
        return;
      }
      if (result.error.code === 'CONFLICT') {
        setError(result.error.message ?? '保存に失敗しました');
      } else if (result.error.code === 'VALIDATION') {
        setError('入力内容に誤りがあります');
      } else if (result.error.code === 'FORBIDDEN') {
        setError('権限がありません');
      } else {
        setError('保存に失敗しました');
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="wr-valid-from">適用開始日</Label>
        <Input
          id="wr-valid-from"
          type="date"
          value={validFrom}
          onChange={(e) => setValidFrom(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          明日以降を指定してください。過去・本日への登録は不可。
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <input
            id="wr-compliance"
            type="checkbox"
            checked={complianceMode}
            onChange={(e) => setComplianceMode(e.target.checked)}
          />
          <Label htmlFor="wr-compliance" className="cursor-pointer">
            compliance_mode（法定下限チェックを有効化）
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          ON: 法定下限を下回る値を保存しようとするとエラー。OFF:
          自己責任モードで法定下限以下の値も保存可（推奨は ON）。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {numField('wr-ot-rate', '法定外残業率（×）', otRate, setOtRate)}
        {numField(
          'wr-holiday',
          '法定休日割増率（×）',
          holidayRate,
          setHolidayRate,
        )}
        {numField(
          'wr-night-add',
          '深夜割増（+）',
          nightAdd,
          setNightAdd,
        )}
        {numField(
          'wr-monthly60-rate',
          '月60h超 残業率（×）',
          monthly60Rate,
          setMonthly60Rate,
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wr-night-start">深夜開始時刻</Label>
          <Input
            id="wr-night-start"
            type="time"
            value={nightStart}
            onChange={(e) => setNightStart(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wr-night-end">深夜終了時刻</Label>
          <Input
            id="wr-night-end"
            type="time"
            value={nightEnd}
            onChange={(e) => setNightEnd(e.target.value)}
          />
        </div>
        {numField(
          'wr-daily-ot',
          '日次残業閾値（分）',
          dailyOt,
          setDailyOt,
          1,
        )}
        {numField(
          'wr-weekly-ot',
          '週次残業閾値（分）',
          weeklyOt,
          setWeeklyOt,
          1,
        )}
        {numField(
          'wr-monthly60-min',
          '月60h超 閾値（分）',
          monthly60Threshold,
          setMonthly60Threshold,
          1,
        )}
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/work-rules')}
          disabled={pending}
        >
          キャンセル
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? '保存中...' : isCreate ? '予約する' : '保存'}
        </Button>
      </div>
    </form>
  );
}
