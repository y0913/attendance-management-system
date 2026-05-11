import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { listAllUsers } from '@/lib/data/users';
import { LoginForm } from './login-form';

const ROLE_LABEL: Record<string, string> = {
  admin: '管理者',
  approver: '承認者',
  general: '一般',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verify?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const isVerify = sp.verify === '1';
  const errorCode = sp.error;
  const users = await listAllUsers();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>勤怠管理システム</CardTitle>
          <CardDescription>
            {isVerify
              ? '送信したログインリンクをクリックしてください'
              : 'メールアドレスにログインリンクを送信します'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {isVerify ? (
            <div className="rounded-md border bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="mb-1 font-medium">確認メールを送信しました</p>
              <p className="text-xs">
                受信箱を確認し、リンクをクリックしてログインを完了してください。
                ローカル開発環境では{' '}
                <a
                  href="http://localhost:8025"
                  target="_blank"
                  rel="noopener"
                  className="underline"
                >
                  Mailpit (http://localhost:8025)
                </a>{' '}
                で受信メールを確認できます。
              </p>
            </div>
          ) : (
            <>
              {errorCode && (
                <div className="rounded-md border bg-rose-50 p-3 text-sm text-rose-900">
                  認証に失敗しました（{errorCode}）。メールアドレスを確認してください。
                </div>
              )}
              <LoginForm />
            </>
          )}
          <div className="rounded-md border bg-muted/50 p-4 text-sm">
            <p className="mb-2 font-medium">登録済みユーザー</p>
            <ul className="space-y-1 text-muted-foreground">
              {users.map((u) => (
                <li key={u.id} className="flex items-center justify-between">
                  <span>{u.email}</span>
                  <span className="text-xs">{ROLE_LABEL[u.role]}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              admin が `/admin/employees`
              から招待した社員、または新規登録したユーザーのみログイン可能です。
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            アカウントをお持ちでない方は{' '}
            <Link href="/signup" className="underline">
              新規登録
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
