'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { submitCorrectionAction } from './actions';
import type { ClockSnapshot } from '@/lib/data/clock-corrections';

interface Props {
  jstDate: string;
  current: ClockSnapshot;
  reasonMaxLength: number;
}

const dash = (s: string | null) => s ?? '-';

export function CorrectionForm({ jstDate, current, reasonMaxLength }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [clockIn, setClockIn] = useState(current.clockIn ?? '');
  const [clockOut, setClockOut] = useState(current.clockOut ?? '');
  const [breakStart, setBreakStart] = useState(current.breakStart ?? '');
  const [breakEnd, setBreakEnd] = useState(current.breakEnd ?? '');
  const [reason, setReason] = useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (reason.trim().length === 0) {
      setError('理由を入力してください');
      return;
    }
    startTransition(async () => {
      const result = await submitCorrectionAction({
        jstDate,
        reason,
        clockIn,
        clockOut,
        breakStart,
        breakEnd,
      });
      if (result.ok) {
        router.refresh();
      } else if (result.error.code === 'CONFLICT') {
        setError(result.error.message ?? '同じ日付で審査中の申請があります');
      } else if (result.error.code === 'VALIDATION') {
        setError('入力内容に誤りがあります（時刻はHH:mm形式）');
      } else {
        setError('申請に失敗しました');
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="rounded-md border bg-muted/40 p-3 text-sm">
        <p className="mb-1 font-medium">現在の打刻</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-muted-foreground">
          <span>出勤: {dash(current.clockIn)}</span>
          <span>退勤: {dash(current.clockOut)}</span>
          <span>休憩開始: {dash(current.breakStart)}</span>
          <span>休憩終了: {dash(current.breakEnd)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ccr-clock-in">出勤</Label>
          <input
            id="ccr-clock-in"
            type="time"
            value={clockIn}
            onChange={(e) => setClockIn(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm font-mono shadow-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ccr-clock-out">退勤</Label>
          <input
            id="ccr-clock-out"
            type="time"
            value={clockOut}
            onChange={(e) => setClockOut(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm font-mono shadow-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ccr-break-start">休憩開始</Label>
          <input
            id="ccr-break-start"
            type="time"
            value={breakStart}
            onChange={(e) => setBreakStart(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm font-mono shadow-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ccr-break-end">休憩終了</Label>
          <input
            id="ccr-break-end"
            type="time"
            value={breakEnd}
            onChange={(e) => setBreakEnd(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm font-mono shadow-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ccr-reason">理由</Label>
        <textarea
          id="ccr-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={reasonMaxLength}
          rows={3}
          placeholder="修正の理由を記載"
          className="rounded-md border bg-background px-3 py-2 text-sm shadow-sm"
        />
        <span className="self-end text-xs text-muted-foreground">
          {reason.length} / {reasonMaxLength}
        </span>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? '送信中...' : '申請する'}
        </Button>
      </div>
    </form>
  );
}
