'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  bulkCloseMonthAction,
  closeMonthAction,
  uncloseAction,
} from './actions';

interface SingleProps {
  userId: string;
  userName: string;
  yearMonth: string;
}

export function SingleCloseButton({
  userId,
  userName,
  yearMonth,
}: SingleProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    if (!confirm(`${userName} の ${yearMonth} を締めます。よろしいですか？`))
      return;
    startTransition(async () => {
      const result = await closeMonthAction({ userId, yearMonth });
      if (result.ok) {
        router.refresh();
        return;
      }
      if (result.error.code === 'CONFLICT') {
        setError(result.error.message ?? '締めに失敗しました');
      } else {
        setError('締めに失敗しました');
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" size="sm" disabled={pending} onClick={submit}>
        {pending ? '処理中...' : '締める'}
      </Button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

interface UncloseProps {
  closingId: string;
  userName: string;
  yearMonth: string;
}

export function UncloseButton({
  closingId,
  userName,
  yearMonth,
}: UncloseProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    if (
      !confirm(
        `${userName} の ${yearMonth} の締めを解除します。snapshot は削除されます。よろしいですか？`,
      )
    )
      return;
    startTransition(async () => {
      const result = await uncloseAction({ closingId });
      if (result.ok) {
        router.refresh();
        return;
      }
      if (result.error.code === 'CONFLICT') {
        setError(result.error.message ?? '解除に失敗しました');
      } else {
        setError('解除に失敗しました');
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={submit}
        className="border-rose-300 text-rose-700 hover:bg-rose-50"
      >
        {pending ? '処理中...' : '解除'}
      </Button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

interface BulkProps {
  yearMonth: string;
  notClosedCount: number;
}

export function BulkCloseButton({ yearMonth, notClosedCount }: BulkProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    setInfo(null);
    if (notClosedCount === 0) return;
    if (
      !confirm(
        `${yearMonth} の未締め ${notClosedCount} 名を一括で締めます。よろしいですか？`,
      )
    )
      return;
    startTransition(async () => {
      const result = await bulkCloseMonthAction({ yearMonth });
      if (result.ok) {
        setInfo(
          `${result.data.closedCount} 名を締めました（スキップ ${result.data.skippedCount} 名）`,
        );
        router.refresh();
        return;
      }
      setError('一括締めに失敗しました');
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="default"
        disabled={pending || notClosedCount === 0}
        onClick={submit}
      >
        {pending
          ? '処理中...'
          : notClosedCount === 0
            ? '全員締め済み'
            : `未締め ${notClosedCount} 名を一括締め`}
      </Button>
      {info && <p className="text-xs text-emerald-700">{info}</p>}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
