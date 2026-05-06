'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { deleteWorkRuleAction } from '../actions';

interface Props {
  id: string;
}

export function DeleteForm({ id }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    if (!confirm('この未来予約を削除します。よろしいですか？')) return;
    startTransition(async () => {
      const result = await deleteWorkRuleAction({ id });
      if (result.ok) {
        router.push('/admin/work-rules');
        router.refresh();
        return;
      }
      if (result.error.code === 'CONFLICT') {
        setError(result.error.message ?? '削除に失敗しました');
      } else {
        setError('削除に失敗しました');
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={submit}
          className="border-rose-300 text-rose-700 hover:bg-rose-50"
        >
          {pending ? '削除中...' : '削除'}
        </Button>
      </div>
    </div>
  );
}
