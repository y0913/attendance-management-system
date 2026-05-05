'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signInAction } from './actions';

const errorMessage = (
  state: Awaited<ReturnType<typeof signInAction>> | null,
): string | null => {
  if (!state || state.ok) return null;
  switch (state.error.code) {
    case 'VALIDATION':
      return 'メールアドレスの形式が正しくありません';
    case 'NOT_FOUND':
      return '該当するユーザーが見つかりません';
    default:
      return 'ログインに失敗しました';
  }
};

export function LoginForm() {
  const [state, action, pending] = useActionState(signInAction, null);
  const error = errorMessage(state);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">メールアドレス</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="example@example.com"
          autoComplete="email"
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'ログイン中…' : 'ログイン'}
      </Button>
    </form>
  );
}
