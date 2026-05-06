import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>ページが見つかりません</CardTitle>
          <CardDescription>
            指定された URL のページは存在しないか、削除された可能性があります。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <a href="/clock">ホームに戻る</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
