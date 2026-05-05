'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { countWeekdaysBetween } from '@/lib/calc/weekday-count';
import { submitLeaveAction } from './actions';

interface Props {
  reasonMaxLength: number;
  defaultStart: string;
  defaultEnd: string;
}

const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export function LeaveForm({
  reasonMaxLength,
  defaultStart,
  defaultEnd,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [reason, setReason] = useState('');

  const days = useMemo(() => {
    if (!isValidDate(startDate) || !isValidDate(endDate)) return 0;
    if (endDate < startDate) return 0;
    return countWeekdaysBetween(startDate, endDate);
  }, [startDate, endDate]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      setError('日付を正しく入力してください');
      return;
    }
    if (endDate < startDate) {
      setError('終了日は開始日以降にしてください');
      return;
    }
    if (days <= 0) {
      setError('平日が含まれていないため申請できません');
      return;
    }
    if (reason.trim().length === 0) {
      setError('理由を入力してください');
      return;
    }
    startTransition(async () => {
      const result = await submitLeaveAction({ startDate, endDate, reason });
      if (result.ok) {
        router.push('/applications');
        router.refresh();
      } else if (result.error.code === 'VALIDATION') {
        setError('入力内容に誤りがあります');
      } else {
        setError('申請に失敗しました');
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lr-start">開始日</Label>
          <input
            id="lr-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm font-mono shadow-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lr-end">終了日</Label>
          <input
            id="lr-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm font-mono shadow-sm"
          />
        </div>
      </div>

      <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
        消化日数：<span className="font-mono font-semibold">{days}</span> 日
        <span className="ml-2 text-xs text-muted-foreground">
          （土日を除く平日のみカウント）
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lr-reason">理由</Label>
        <textarea
          id="lr-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={reasonMaxLength}
          rows={3}
          placeholder="申請理由を記載"
          className="rounded-md border bg-background px-3 py-2 text-sm shadow-sm"
        />
        <span className="self-end text-xs text-muted-foreground">
          {reason.length} / {reasonMaxLength}
        </span>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline" type="button">
          <a href="/applications">キャンセル</a>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? '送信中...' : '申請する'}
        </Button>
      </div>
    </form>
  );
}
