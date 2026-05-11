'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signUpAction } from './actions';

const errorMessage = (
  state: Awaited<ReturnType<typeof signUpAction>> | null,
): string | null => {
  if (!state || state.ok) return null;
  switch (state.error.code) {
    case 'VALIDATION':
      return '入力内容を確認してください（会社名・お名前・メアド形式）';
    case 'CONFLICT':
      return state.error.message ?? '既に登録されているメールアドレスです';
    default:
      return '登録に失敗しました';
  }
};

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, null);
  const error = errorMessage(state);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="companyName">会社名</Label>
        <Input
          id="companyName"
          name="companyName"
          type="text"
          placeholder="株式会社サンプル"
          maxLength={100}
          required
          aria-required="true"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">お名前（管理者）</Label>
        <Input
          id="name"
          name="name"
          type="text"
          maxLength={50}
          required
          aria-required="true"
        />
      </div>
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
        />
      </div>
      <p className="text-xs text-muted-foreground">
        登録すると新しい会社が作成され、あなたはその会社の管理者になります。
        他の従業員は管理者画面の「従業員管理」から招待できます。
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={pending}
        aria-busy={pending ? 'true' : undefined}
      >
        {pending ? '登録中…' : '会社を登録する'}
      </Button>
    </form>
  );
}
