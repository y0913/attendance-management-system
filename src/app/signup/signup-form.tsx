'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signUpAction } from './actions';

const ROLE_OPTIONS = [
  { value: 'general', label: '一般' },
  { value: 'approver', label: '承認者' },
  { value: 'admin', label: '管理者' },
] as const;

const errorMessage = (
  state: Awaited<ReturnType<typeof signUpAction>> | null,
): string | null => {
  if (!state || state.ok) return null;
  switch (state.error.code) {
    case 'VALIDATION':
      return '入力内容を確認してください（メアド形式・お名前必須）';
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
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">お名前</Label>
        <Input
          id="name"
          name="name"
          type="text"
          maxLength={50}
          required
          aria-required="true"
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">ロール</legend>
        <div className="flex flex-col gap-1.5 pt-1">
          {ROLE_OPTIONS.map((opt, i) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 text-sm"
            >
              <input
                type="radio"
                name="role"
                value={opt.value}
                defaultChecked={i === 0}
                required
              />
              {opt.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          portfolio 用途のため全ロールを自由に選択できます。
        </p>
      </fieldset>
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
        {pending ? '登録中…' : 'サインアップ'}
      </Button>
    </form>
  );
}
