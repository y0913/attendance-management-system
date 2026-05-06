'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateCompanySettingsAction } from './actions';

type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

interface Props {
  initial: {
    name: string;
    closingDay: number;
    midMonthRateChangeStrategy: 'daily' | 'month_end';
    monthlyStandardHours: number;
    legalHolidayWeekday: Weekday;
  };
}

const WEEKDAY_OPTIONS: { value: Weekday; label: string }[] = [
  { value: 0, label: '日' },
  { value: 1, label: '月' },
  { value: 2, label: '火' },
  { value: 3, label: '水' },
  { value: 4, label: '木' },
  { value: 5, label: '金' },
  { value: 6, label: '土' },
];

export function SettingsForm({ initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [name, setName] = useState(initial.name);
  const [closingDay, setClosingDay] = useState<number>(initial.closingDay);
  const [strategy, setStrategy] = useState<'daily' | 'month_end'>(
    initial.midMonthRateChangeStrategy,
  );
  const [monthlyHours, setMonthlyHours] = useState<number>(
    initial.monthlyStandardHours,
  );
  const [legalHolidayWeekday, setLegalHolidayWeekday] = useState<Weekday>(
    initial.legalHolidayWeekday,
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (name.trim().length === 0) {
      setError('会社名を入力してください');
      return;
    }
    if (!Number.isFinite(monthlyHours) || monthlyHours <= 0) {
      setError('月所定労働時間は 1 以上の数値を入力してください');
      return;
    }
    startTransition(async () => {
      const result = await updateCompanySettingsAction({
        name: name.trim(),
        closingDay,
        midMonthRateChangeStrategy: strategy,
        monthlyStandardHours: monthlyHours,
        legalHolidayWeekday,
      });
      if (result.ok) {
        setInfo('保存しました');
        router.refresh();
        return;
      }
      if (result.error.code === 'VALIDATION') {
        setError('入力内容に誤りがあります');
      } else if (result.error.code === 'FORBIDDEN') {
        setError('権限がありません');
      } else {
        setError('保存に失敗しました');
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="co-name">会社名</Label>
        <Input
          id="co-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="co-closing-day">締日</Label>
        <select
          id="co-closing-day"
          value={closingDay}
          onChange={(e) => setClosingDay(Number(e.target.value))}
          className="rounded-md border bg-background px-3 py-2 text-sm shadow-sm"
        >
          <option value={0}>月末</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              毎月 {d} 日
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          月末以外を選んだ場合、締日翌日からが翌月の集計期間になります
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label>月途中ルール変更戦略</Label>
        <p className="text-xs text-muted-foreground">
          労働ルールが月の途中で切り替わったとき、どの時点のルールで計算するか
        </p>
        <div className="flex flex-col gap-2">
          <label className="flex items-start gap-2 rounded-md border bg-background p-3 text-sm">
            <input
              type="radio"
              name="strategy"
              value="month_end"
              checked={strategy === 'month_end'}
              onChange={() => setStrategy('month_end')}
              className="mt-1"
            />
            <div>
              <p className="font-medium">月末戦略</p>
              <p className="text-xs text-muted-foreground">
                月末日のルールで月全体を計算（実務多数派・推奨）
              </p>
            </div>
          </label>
          <label className="flex items-start gap-2 rounded-md border bg-background p-3 text-sm">
            <input
              type="radio"
              name="strategy"
              value="daily"
              checked={strategy === 'daily'}
              onChange={() => setStrategy('daily')}
              className="mt-1"
            />
            <div>
              <p className="font-medium">日次戦略</p>
              <p className="text-xs text-muted-foreground">
                各日その日のルールを参照（実装シンプル・月60h超の閾値またぎで挙動に差）
              </p>
            </div>
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="co-monthly-hours">
          月所定労働時間
          <span className="ml-1 text-xs text-muted-foreground">
            （時給単価計算の分母）
          </span>
        </Label>
        <Input
          id="co-monthly-hours"
          type="number"
          step={1}
          min={1}
          max={744}
          value={monthlyHours}
          onChange={(e) => setMonthlyHours(Number(e.target.value))}
        />
        <p className="text-xs text-muted-foreground">
          一般的には 22 営業日 × 8h = 176 時間 程度。
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="co-legal-holiday">法定休日の曜日</Label>
        <select
          id="co-legal-holiday"
          value={legalHolidayWeekday}
          onChange={(e) =>
            setLegalHolidayWeekday(Number(e.target.value) as Weekday)
          }
          className="rounded-md border bg-background px-3 py-2 text-sm shadow-sm"
        >
          {WEEKDAY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}曜日
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          一般的には日曜日。法定休日に勤務した場合は割増率が適用されます。
        </p>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {info && <p className="text-sm text-emerald-700">{info}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? '保存中...' : '保存'}
        </Button>
      </div>
    </form>
  );
}
