'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateCompanySettingsAction } from './actions';

interface Props {
  initial: {
    name: string;
    closingDay: number;
    midMonthRateChangeStrategy: 'daily' | 'month_end';
  };
}

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

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (name.trim().length === 0) {
      setError('会社名を入力してください');
      return;
    }
    startTransition(async () => {
      const result = await updateCompanySettingsAction({
        name: name.trim(),
        closingDay,
        midMonthRateChangeStrategy: strategy,
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
