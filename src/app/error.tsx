'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // production では監視ツール（Sentry 等）へ送信。dev では console。
    console.error('[ErrorBoundary]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-rose-700">
            問題が発生しました
          </CardTitle>
          <CardDescription>
            ページを表示できませんでした。再読み込みするか、しばらく経ってから再度お試しください。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {error.digest && (
            <p className="font-mono text-xs text-muted-foreground">
              エラー ID: {error.digest}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => reset()}>
              再試行
            </Button>
            <Button asChild variant="outline">
              <a href="/clock">ホームに戻る</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
