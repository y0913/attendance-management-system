'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { setEmployeeDeactivationAction } from '../actions';

interface Props {
  id: string;
  isDeactivated: boolean;
  isSelf: boolean;
}

export function DeactivationForm({ id, isDeactivated, isSelf }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    const action = isDeactivated ? '再有効化' : '無効化';
    if (!confirm(`このユーザーを${action}します。よろしいですか？`)) return;
    startTransition(async () => {
      const result = await setEmployeeDeactivationAction({
        id,
        deactivate: !isDeactivated,
      });
      if (result.ok) {
        router.refresh();
        return;
      }
      if (result.error.code === 'CONFLICT') {
        setError(result.error.message ?? '失敗しました');
      } else {
        setError('失敗しました');
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {isDeactivated
          ? 'このユーザーは現在無効化されています。再有効化するとログイン・打刻が可能になります。'
          : '無効化するとログイン・打刻ができなくなります。過去の勤怠データは残ります。'}
      </p>
      {isSelf && !isDeactivated && (
        <p className="text-xs text-rose-600">
          自分自身は無効化できません
        </p>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex justify-end">
        <Button
          type="button"
          variant={isDeactivated ? 'default' : 'outline'}
          disabled={pending || (isSelf && !isDeactivated)}
          onClick={submit}
          className={
            isDeactivated
              ? ''
              : 'border-rose-300 text-rose-700 hover:bg-rose-50'
          }
        >
          {pending ? '処理中...' : isDeactivated ? '再有効化' : '無効化'}
        </Button>
      </div>
    </div>
  );
}
