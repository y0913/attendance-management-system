'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { decideRequestAction } from './actions';

interface Props {
  type: 'correction' | 'leave';
  id: string;
  commentMaxLength: number;
}

type Decision = 'approve' | 'reject' | 'return';

const DECISION_LABEL: Record<Decision, string> = {
  approve: '承認',
  reject: '却下',
  return: '差戻し',
};

const REJECTION_REQUIRES_COMMENT: Record<Decision, boolean> = {
  approve: false,
  reject: true,
  return: true,
};

export function DecisionForm({ type, id, commentMaxLength }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const submit = (decision: Decision) => {
    setError(null);
    if (REJECTION_REQUIRES_COMMENT[decision] && comment.trim().length === 0) {
      setError(`${DECISION_LABEL[decision]}にはコメントが必須です`);
      return;
    }
    if (
      decision === 'approve' &&
      !confirm('この申請を承認します。よろしいですか？')
    )
      return;

    startTransition(async () => {
      const result = await decideRequestAction({
        type,
        id,
        decision,
        comment,
      });
      if (result.ok) {
        router.push('/team/approvals');
        router.refresh();
        return;
      }
      if (result.error.code === 'CONFLICT') {
        setError(result.error.message ?? '既に処理済みです');
      } else if (result.error.code === 'FORBIDDEN') {
        setError('この申請を処理する権限がありません');
      } else if (result.error.code === 'NOT_FOUND') {
        setError('申請が見つかりません');
      } else if (result.error.code === 'VALIDATION') {
        setError('入力内容に誤りがあります');
      } else {
        setError('処理に失敗しました');
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="approval-comment">
          コメント
          <span className="ml-1 text-xs text-muted-foreground">
            （却下・差戻しは必須）
          </span>
        </Label>
        <textarea
          id="approval-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={commentMaxLength}
          rows={3}
          placeholder="承認者からのコメント"
          className="rounded-md border bg-background px-3 py-2 text-sm shadow-sm"
        />
        <span className="self-end text-xs text-muted-foreground">
          {comment.length} / {commentMaxLength}
        </span>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => submit('reject')}
          className="border-rose-300 text-rose-700 hover:bg-rose-50"
        >
          却下
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => submit('return')}
        >
          差戻し
        </Button>
        <Button
          type="button"
          disabled={pending}
          onClick={() => submit('approve')}
        >
          {pending ? '処理中...' : '承認'}
        </Button>
      </div>
    </div>
  );
}
