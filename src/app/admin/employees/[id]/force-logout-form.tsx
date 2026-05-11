'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { forceLogoutUserAction } from '../actions';

interface Props {
  id: string;
  isSelf: boolean;
}

export function ForceLogoutForm({ id, isSelf }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<
    { kind: 'error' | 'success'; text: string } | null
  >(null);

  const submit = () => {
    setMessage(null);
    if (
      !confirm(
        'このユーザーの全端末セッションを失効させます。次回 jwt refresh（最大 1 分後）にログアウトされ、再ログインが必要になります。よろしいですか？',
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await forceLogoutUserAction({ id });
      if (result.ok) {
        setMessage({
          kind: 'success',
          text: '強制ログアウトを記録しました（反映まで最大 1 分）',
        });
        router.refresh();
        return;
      }
      if (result.error.code === 'CONFLICT') {
        setMessage({ kind: 'error', text: result.error.message ?? '失敗しました' });
      } else {
        setMessage({ kind: 'error', text: '失敗しました' });
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        このユーザーが現在ログイン中の全端末セッションを即時失効させます。
        盗難疑い・退職直前などに使用してください。アカウント自体は有効のまま残ります。
      </p>
      {isSelf && (
        <p className="text-xs text-rose-600">
          自分自身は強制ログアウトできません
        </p>
      )}
      {message && (
        <p
          className={
            message.kind === 'error'
              ? 'text-sm text-rose-600'
              : 'text-sm text-emerald-700'
          }
        >
          {message.text}
        </p>
      )}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={pending || isSelf}
          onClick={submit}
          className="border-purple-300 text-purple-700 hover:bg-purple-50"
        >
          {pending ? '処理中...' : '全端末ログアウト'}
        </Button>
      </div>
    </div>
  );
}
