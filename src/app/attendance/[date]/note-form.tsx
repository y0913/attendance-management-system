'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { saveDailyNoteAction } from './actions';

interface Props {
  jstDate: string;
  initialContent: string;
  maxLength: number;
  backHref: string;
}

export function NoteForm({
  jstDate,
  initialContent,
  maxLength,
  backHref,
}: Props) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = content !== initialContent;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveDailyNoteAction({ jstDate, content });
      if (result.ok) {
        setSavedAt(new Date());
        router.refresh();
      } else {
        setError('保存に失敗しました');
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={maxLength}
        rows={10}
        placeholder="今日の業務内容を記録..."
        className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {content.length} / {maxLength}
        </span>
        {savedAt && !dirty && (
          <span className="text-emerald-700">
            保存しました（{savedAt.toLocaleTimeString('ja-JP')}）
          </span>
        )}
        {error && <span className="text-rose-600">{error}</span>}
      </div>
      <div className="flex justify-end gap-2">
        <Button asChild variant="outline" type="button">
          <a href={backHref}>一覧に戻る</a>
        </Button>
        <Button type="submit" disabled={pending || !dirty}>
          {pending ? '保存中...' : '保存'}
        </Button>
      </div>
    </form>
  );
}
