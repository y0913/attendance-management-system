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
import { LoginForm } from './login-form';
import { demoLoginAction } from './actions';

const DEMO_ROLES: { role: 'admin' | 'approver' | 'general'; label: string; desc: string }[] = [
  { role: 'admin', label: '管理者で試す', desc: '全機能（締め / 監査 / レポート 等）' },
  { role: 'approver', label: '承認者で試す', desc: '部下の勤怠閲覧 / 承認' },
  { role: 'general', label: '一般社員で試す', desc: '打刻 / 申請 / 有給' },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verify?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const isVerify = sp.verify === '1';
  const errorCode = sp.error;
  const demoEnabled = process.env.DEMO_LOGIN_ENABLED === 'true';

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>勤怠管理システム</CardTitle>
          <CardDescription>
            {isVerify
              ? '送信したログインリンクをクリックしてください'
              : demoEnabled
                ? 'portfolio デモアカウントで動作確認できます'
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

              {demoEnabled && (
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    デモアカウントで即時ログイン
                  </p>
                  {DEMO_ROLES.map((r) => (
                    <form key={r.role} action={demoLoginAction}>
                      <input type="hidden" name="role" value={r.role} />
                      <Button
                        type="submit"
                        variant="outline"
                        className="h-auto w-full justify-start py-3 text-left"
                      >
                        <div>
                          <p className="font-semibold">{r.label}</p>
                          <p className="text-xs text-muted-foreground">{r.desc}</p>
                        </div>
                      </Button>
                    </form>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    ※ デモアカウントは共有なので、データは他の訪問者にも見えます。
                  </p>
                  <div className="my-2 flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs text-muted-foreground">
                      または管理者本人でログイン
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                </div>
              )}

              <LoginForm />
            </>
          )}
        </CardContent>
        {!demoEnabled && (
          <CardFooter className="flex justify-center">
            <p className="text-sm text-muted-foreground">
              アカウントをお持ちでない方は{' '}
              <Link href="/signup" className="underline">
                新規登録
              </Link>
            </p>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
