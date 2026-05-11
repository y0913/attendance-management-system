import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { SignUpForm } from './signup-form';

export default function SignUpPage() {
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
