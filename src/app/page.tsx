import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getMockSession } from '@/lib/data/session';

export default async function Home() {
  // 認証済はそれぞれのホームへ。LP は未認証ユーザー向け。
  const session = await getMockSession();
  if (session) {
    redirect(session.role === 'admin' ? '/admin/dashboard' : '/clock');
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <p className="text-base font-bold tracking-tight">勤怠管理システム</p>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">ログイン</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">無料で始める</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-900 text-white">
        <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium tracking-wide">
              労基法準拠 × マルチテナント × ゼロ円運用
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              打刻・申請・労務管理を、
              <br />
              ひとつのシステムで。
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-slate-300">
              残業（法定外・深夜・休日・月 60h 超）の割増計算、有給の自動付与と消化、
              労働ルールの履歴管理まで自動化。
              社員数十名規模の管理コストを抜本的に削減します。
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="h-12 bg-white px-8 text-base font-semibold text-slate-900 hover:bg-slate-800 hover:text-white"
              >
                <Link href="/signup">無料で会社を登録する</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 border-slate-600 bg-transparent px-8 text-base text-white hover:bg-slate-800 hover:text-white"
              >
                <Link href="/login">既にお持ちの方</Link>
              </Button>
            </div>
            <p className="mt-6 text-sm text-slate-400">
              クレジットカード登録不要 / パスワード設定不要（magic link 認証）
            </p>
          </div>
        </div>
      </section>

      {/* なぜ 3 columns */}
      <section className="border-b">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div>
              <h3 className="text-lg font-bold">法令に準拠した自動計算</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                法定外残業 1.25 倍、深夜割増 +0.25、法定休日 1.35 倍、月 60 時間超 1.50 倍
                ──労基法に基づく割増を自動計算。法定下限を下回る設定はエラーで弾く
                「法令準拠モード」も搭載。
              </p>
            </div>
            <div>
              <h3 className="text-lg font-bold">業務時間を削減する設計</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                有給は法定付与（入社 6 ヶ月後 10 日〜最大 20 日）と失効管理まで完全自動。
                月次締めの結果は固定されるので、過去のルールを変更しても集計はぶれません。
                36 協定の超過は月途中で警告。
              </p>
            </div>
            <div>
              <h3 className="text-lg font-bold">本番運用に耐えるセキュリティ</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                パスワード不要のメール認証、ログイン状態の自動失効、
                XSS・なりすまし対策、admin による全端末強制ログアウト。
                複数の企業が同居しても、別会社のデータは一切見えない厳格な分離を実装。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ロール別機能 */}
      <section className="bg-muted/40 border-b">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              すべての立場の人に、最適なインターフェース
            </h2>
            <p className="mt-3 text-muted-foreground">
              管理者 / 承認者 / 一般社員の 3 ロール、それぞれに最適化された画面
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  一般社員
                </p>
                <CardTitle className="text-xl">打刻、申請、有給</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• ワンクリック打刻（出勤・退勤・休憩）</li>
                  <li>• 月次カレンダー + サマリー</li>
                  <li>• 打刻修正 / 有給申請（半日対応）</li>
                  <li>• 自分の申請履歴と取下げ</li>
                  <li>• 有給残数・付与履歴・失効予定</li>
                  <li>• 日報（業務内容）の記録</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  承認者
                </p>
                <CardTitle className="text-xl">部下の管理と承認</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• 部下の勤怠閲覧（月次・日次）</li>
                  <li>• 承認受信ボックス（未対応バッジ付き）</li>
                  <li>• コメント付き承認 / 却下 / 差戻し</li>
                  <li>• 打刻修正の承認 → 自動反映</li>
                  <li>• 有給承認 → 残数から自動消化</li>
                  <li>• 自分の打刻 / 申請も並行利用</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                  管理者
                </p>
                <CardTitle className="text-xl">全社の運用とレポート</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• 全社ダッシュボード（未承認 / 締め / 36 協定）</li>
                  <li>• 従業員 CRUD + 招待メール自動送信</li>
                  <li>• 労働ルールのバージョン管理</li>
                  <li>• 月次締め（個別 / 一括 / 解除）</li>
                  <li>• 給与 CSV / 勤怠表 PDF / CSV 出力</li>
                  <li>• 監査ログ（全変更を before/after 記録）</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 横断機能 */}
      <section className="border-b">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">主要機能</h2>
            <p className="mt-3 text-muted-foreground">
              中小企業の労務担当が必要とする機能を一通り
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-lg border bg-background p-5"
              >
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* セキュリティ */}
      <section className="bg-slate-900 text-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">
                データ保護とアクセス制御
              </h2>
              <p className="mt-4 text-slate-300 leading-relaxed">
                勤怠データは個人情報そのもの。Web アプリの一般的な脆弱性に対して
                ベストプラクティスを徹底し、複数の企業が安全に同居できるマルチテナント構造で実装しています。
              </p>
            </div>
            <ul className="space-y-3 text-sm">
              {SECURITY_ITEMS.map((s) => (
                <li key={s} className="flex gap-3">
                  <span className="text-emerald-400">✓</span>
                  <span className="text-slate-200">{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 技術スタック */}
      <section className="border-b">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">技術スタック</h2>
            <p className="mt-3 text-muted-foreground">
              モダン Web 技術で構築。型安全と保守性を重視
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {TECH_STACK.map((t) => (
              <div
                key={t.name}
                className="flex items-center gap-3 rounded-md border bg-background px-4 py-3"
              >
                <TechIcon tech={t} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{t.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t.role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-slate-900 text-white">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            今すぐ無料で始める
          </h2>
          <p className="mt-4 text-slate-300">
            メールアドレスだけで登録完了。会社を作成して管理者としてログインできます。
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="h-12 bg-white px-8 text-base font-semibold text-slate-900 hover:bg-slate-800 hover:text-white"
            >
              <Link href="/signup">無料で会社を登録する</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 border-slate-600 bg-transparent px-8 text-base text-white hover:bg-slate-800 hover:text-white"
            >
              <Link href="/login">ログイン</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <p className="text-center text-xs text-slate-400">
            © {new Date().getFullYear()} 勤怠管理システム — Built with Next.js,
            Prisma, PostgreSQL
          </p>
        </div>
      </footer>
    </div>
  );
}

const FEATURES = [
  {
    title: '労基法準拠の残業計算',
    desc: '法定外残業 1.25 倍 / 深夜 +0.25 / 法定休日 1.35 倍 / 月 60 時間超 1.50 倍を自動算出。',
  },
  {
    title: '労働ルールの履歴管理',
    desc: '残業率や休日設定の変更を「いつから適用するか」付きで管理。未来予約・現行・過去を一覧で確認。',
  },
  {
    title: '有給休暇の完全自動化',
    desc: '法定付与（6 ヶ月後 10 日〜最大 20 日）・古い付与から先に消化・失効管理まで全自動。半日有給対応。',
  },
  {
    title: '申請ワークフロー',
    desc: '打刻修正・有給申請を「承認 / 却下 / 差戻し / 取下げ」で運用。各アクションにコメントを記録。',
  },
  {
    title: '月次締め処理',
    desc: '締めた月の集計結果は固定。過去のルール変更があっても、締め済み月の数字はぶれません。',
  },
  {
    title: '36 協定アラート',
    desc: '月途中の残業概算で上限超過を警告。違反を未然に防ぎます。',
  },
  {
    title: 'レポート出力',
    desc: '給与 CSV（賃金の内訳まで含む） / 月次勤怠表 PDF / 個別 CSV。Excel で文字化けしない UTF-8。',
  },
  {
    title: '監査ログ',
    desc: '労働ルール変更・会社設定・従業員管理・月次締めなど、全変更を変更前後セットで記録。',
  },
  {
    title: '招待メール + 強制ログアウト',
    desc: '新規社員にログイン用のリンクメールを自動送信。盗難疑い時は管理者が全端末から強制ログアウト可能。',
  },
];

const SECURITY_ITEMS = [
  'パスワード不要のメールリンク認証',
  'ログイン状態は一定期間で自動失効',
  'XSS 対策（Content Security Policy による）',
  'CSRF 攻撃の防御',
  'クリックジャッキング対策',
  '会社ごとに完全分離されたデータベース設計',
  '管理者によるセッション失効機能',
  '全変更を監査ログに記録（ユーザー / 労働ルール / 会社設定 / 月次締め 等）',
  '個人情報の暗号化通信（HTTPS）',
  '最小権限の原則に基づくロールベースのアクセス制御',
];

// simple-icons.org のスラッグとブランドカラー (HEX without #)
// inline: true は CDN に icon が無いので手書き SVG を使う印
interface TechEntry {
  name: string;
  role: string;
  slug?: string;
  color?: string;
  inline?: boolean;
}

const TECH_STACK: TechEntry[] = [
  { name: 'Next.js 16', role: 'App Router / RSC', slug: 'nextdotjs', color: '000000' },
  { name: 'TypeScript', role: 'strict mode', slug: 'typescript', color: '3178C6' },
  { name: 'Prisma 7', role: 'ORM + migration', slug: 'prisma', color: '2D3748' },
  { name: 'PostgreSQL', role: 'Supabase', slug: 'postgresql', color: '4169E1' },
  { name: 'NextAuth v5', role: 'magic link auth', slug: 'auth0', color: 'EB5424' },
  { name: 'Tailwind CSS', role: 'styling', slug: 'tailwindcss', color: '06B6D4' },
  { name: 'shadcn/ui', role: 'components', slug: 'shadcnui', color: '000000' },
  { name: 'Vitest', role: 'unit + integration', slug: 'vitest', color: '6E9F18' },
  { name: 'Playwright', role: 'e2e test', inline: true },
  { name: 'Sentry', role: 'monitoring', slug: 'sentry', color: '362D59' },
  { name: 'Vercel', role: 'deploy + cron', slug: 'vercel', color: '000000' },
  { name: 'Resend', role: 'email delivery', slug: 'resend', color: '000000' },
];

function TechIcon({ tech }: { tech: TechEntry }) {
  if (tech.inline && tech.name === 'Playwright') {
    // simple-icons に無いので playwright.dev の公式ロゴを public に置いて参照。
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/playwright-logo.svg"
        alt=""
        width={24}
        height={24}
        className="shrink-0"
        loading="lazy"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://cdn.simpleicons.org/${tech.slug}/${tech.color}`}
      alt=""
      width={24}
      height={24}
      className="shrink-0"
      loading="lazy"
    />
  );
}
