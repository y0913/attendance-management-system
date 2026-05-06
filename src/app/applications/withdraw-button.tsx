'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { withdrawRequestAction } from './actions';

interface Props {
  type: 'correction' | 'leave';
  id: string;
}

export function WithdrawButton({ type, id }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    if (!confirm('この申請を取下げます。よろしいですか？')) return;
    startTransition(async () => {
      const result = await withdrawRequestAction({ type, id });
      if (result.ok) {
        router.refresh();
        return;
      }
      if (result.error.code === 'CONFLICT') {
        setError(result.error.message ?? '取下げに失敗しました');
      } else if (result.error.code === 'FORBIDDEN') {
        setError('この申請を取下げる権限がありません');
      } else {
        setError('取下げに失敗しました');
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
      >
        {pending ? '処理中...' : '取下げ'}
      </Button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
