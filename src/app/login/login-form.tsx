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
    <form action={action} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">メールアドレス</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="example@example.com"
          autoComplete="email"
          required
          aria-required="true"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? 'login-error' : undefined}
        />
      </div>
      {error && (
        <p
          id="login-error"
          role="alert"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={pending}
        aria-busy={pending ? 'true' : undefined}
      >
        {pending ? 'ログイン中…' : 'ログインリンクを送信'}
      </Button>
    </form>
  );
}
