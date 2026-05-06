import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AppHeader } from '@/components/app-header';
import {
  currentYearMonthJst,
  shiftYearMonth,
} from '@/lib/mock/attendance-summary';
import { countPendingForApprover } from '@/lib/mock/pending-approvals';
import { getMockSession } from '@/lib/mock/session';
import { listActiveUsers } from '@/lib/mock/users';

const isValidYm = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

const previousYearMonth = (): string =>
  shiftYearMonth(currentYearMonthJst(new Date()), -1);

const fmtMonth = (ym: string) => {
  const [y, m] = ym.split('-');
  return `${y}年${Number(m)}月`;
};

const ROLE_LABEL: Record<string, string> = {
  admin: '管理者',
  approver: '承認者',
  general: '一般',
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  const session = await getMockSession();
  if (!session) redirect('/login');
  if (session.role !== 'admin') redirect('/clock');

  const sp = await searchParams;
  const ym = sp.ym && isValidYm(sp.ym) ? sp.ym : previousYearMonth();
  const users = (await listActiveUsers()).sort((a, b) =>
    a.name.localeCompare(b.name, 'ja'),
  );
  const myPending = await countPendingForApprover(session.id);

  const prevYm = shiftYearMonth(ym, -1);
  const nextYm = shiftYearMonth(ym, 1);

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader
        user={session}
        active="admin-reports"
        pendingApprovalCount={myPending}
      />

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        <div className="flex flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">レポート出力</h1>
            <p className="text-sm text-muted-foreground">
              対象月: {fmtMonth(ym)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/reports?ym=${prevYm}`}>← 前月</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/reports?ym=${previousYearMonth()}`}>
                先月
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/reports?ym=${nextYm}`}>次月 →</Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">給与 CSV</CardTitle>
              <p className="text-xs text-muted-foreground">
                全社員の月次基本情報＋勤務サマリーを CSV 出力（UTF-8 BOM 付）
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                出力項目: 社員ID / 氏名 / メール / ロール / 雇用形態 / 基本給 /
                勤務日数 / 合計勤務時間 / 退勤未打刻 / 承認済有給 / 承認者
              </p>
              <Button asChild>
                <a href={`/api/admin/reports/payroll?ym=${ym}`} download>
                  CSV をダウンロード
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">月次勤怠表 PDF</CardTitle>
              <p className="text-xs text-muted-foreground">
                社員ごとの月次勤怠表を A4 縦の PDF で出力。下部の社員別ボタンから
                「PDF」を選択してください。
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                @react-pdf/renderer + Noto Sans JP（Google Fonts CDN
                経由）で生成。初回ダウンロード時はフォント取得が走るため数秒かかります。
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">勤怠表 CSV（個別）</CardTitle>
            <p className="text-xs text-muted-foreground">
              社員ごとの月次日次データを CSV 出力（UTF-8 BOM 付）
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">名前</th>
                    <th className="px-3 py-2 font-medium">ロール</th>
                    <th className="px-3 py-2 font-medium">メール</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b align-middle last:border-b-0"
                    >
                      <td className="px-3 py-3 font-medium">{u.name}</td>
                      <td className="px-3 py-3 text-xs">
                        {ROLE_LABEL[u.role]}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">
                        {u.email}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button asChild size="sm" variant="outline">
                            <a
                              href={`/api/admin/reports/attendance/${u.id}?ym=${ym}`}
                              download
                            >
                              CSV
                            </a>
                          </Button>
                          <Button asChild size="sm" variant="outline">
                            <a
                              href={`/api/admin/reports/attendance-pdf/${u.id}?ym=${ym}`}
                              download
                            >
                              PDF
                            </a>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
