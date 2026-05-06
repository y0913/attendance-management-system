import {
  Card,
  CardContent,
  CardDescription,
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

export default async function LoginPage() {
  const users = await listAllUsers();
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>勤怠管理システム</CardTitle>
          <CardDescription>モック認証 — メールアドレスのみでログイン</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <LoginForm />
          <div className="rounded-md border bg-muted/50 p-4 text-sm">
            <p className="mb-2 font-medium">テストユーザー</p>
            <ul className="space-y-1 text-muted-foreground">
              {users.map((u) => (
                <li key={u.id} className="flex items-center justify-between">
                  <span>{u.email}</span>
                  <span className="text-xs">{ROLE_LABEL[u.role]}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
