import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SignUpForm } from './signup-form';

export default function SignUpPage() {
  const demoEnabled = process.env.DEMO_LOGIN_ENABLED === 'true';

  // portfolio デモモードでは新規登録を停止し、デモアカウントのある /login へ誘導。
  if (demoEnabled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>新規登録は現在停止中です</CardTitle>
            <CardDescription>
              本サイトは portfolio デモのため、新規会社登録は停止しています。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              管理者 / 承認者 / 一般社員の各ロールはデモアカウントから即座に試せます。
            </p>
            <Button asChild className="w-full">
              <Link href="/login">デモアカウントで試す</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>会社を登録する</CardTitle>
          <CardDescription>
            あなたが管理者となる新しい会社を作成します。登録後、メールアドレスにログインリンクを送信します
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignUpForm />
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            既にアカウントをお持ちの方は{' '}
            <Link href="/login" className="underline">
              ログイン
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
