# 勤怠管理システム — 設計仕様書

> このドキュメントは設計判断と実装方針をまとめた仕様サマリーです。Claude Code をはじめとする AI 補助ツールを利用する場合は、このファイルを最初に読み込ませることを想定しています。

---

## 1. プロジェクトの目的

Next.js 15 (App Router) + Server Actions + Prisma 構成における、業務系システムの設計パターン検証用プロジェクト。労働基準法に準拠した勤怠管理を題材に、以下の実装パターンを扱う：

- effective-dated な履歴管理
- pure function による計算ロジックの分離とテスト容易性
- polymorphic-lite な承認ワークフロー
- snapshot による集計結果の凍結と整合性担保
- ロールベース権限制御（middleware + Server Action 二層）

UI 言語は日本語のみ。マルチテナント化・シフト勤務・任意締め日などは拡張案として scope out とし、業務ロジックの設計に集中する。

### 主要技術スタック

`Next.js 15 (App Router)` `TypeScript` `Prisma` `PostgreSQL` `Auth.js v5` `Tailwind CSS` `shadcn/ui` `TanStack Table` `Zod` `Vitest` `Playwright` `Vercel`

用途別の詳細は §3 を参照。

## 2. 機能スコープ（MVP）

### 2.1 ロール（3 段階）

| ロール | 権限 |
|---|---|
| `admin` | 全権限。会社設定・ルール変更・締め処理・全申請承認 |
| `approver` | 自分の部下（manager_id で紐づく一般ユーザー）の申請承認、勤怠閲覧 |
| `general` | 自分の打刻、勤怠閲覧、申請（打刻修正・有給） |

### 2.2 勤務形態

- 単一会社（マルチテナント化は拡張案）
- 固定勤務のみ（シフト・フレックスは拡張案）
- 月末固定締め（任意締め日は拡張案）
- 雇用形態：正社員月給 / 時給バイト

### 2.3 打刻

- Web ボタン打刻（IP 制限・位置情報は拡張案）
- 休憩は手動打刻（自動控除なし）
- 打刻修正は **申請 → 承認フロー必須**（直接編集不可）

### 2.4 休暇

- 有給のみ（振休・代休・特別休暇は拡張案）
- 法定付与を自動実行（入社 6 ヶ月後 10 日 → 11/12/14/16/18/20 日）
- **FIFO 消化**、失効管理あり
- 申請 → 承認フロー

### 2.5 残業計算（B 案：労基法準拠）

| 項目 | 値 |
|---|---|
| 法定外残業（1 日 8h 超 / 週 40h 超） | 1.25 倍 |
| 深夜割増（22:00–05:00） | +0.25（残業と重複時 1.50） |
| 法定休日 | 1.35 倍 |
| 月 60h 超の法定外残業 | 1.50 倍 |

### 2.6 労働ルール設定

会社単位で全項目を上書き可能なマスタ `work_rule_versions` を持つ。

#### compliance_mode トグル
- **ON**: 法定下限を下回る値はバリデーションで弾く（例：ot_rate を 1.20 にしようとするとエラー）
- **OFF**: 警告バナー表示で許容（自己責任モード）

#### バージョン管理（effective-dated）
- `valid_from`（適用開始日）でバージョンを積む
- `valid_to` は**持たない**。次バージョンの `valid_from` が事実上の終了日
- 過去・現行は **閲覧のみ**、未来予約のみ編集・削除可
- 過去への遡及登録は禁止

#### ルール参照ロジック
```ts
function getEffectiveRule(companyId: string, date: Date): WorkRuleVersion {
  // valid_from <= date を満たす中で valid_from が最大のもの
  return db.workRuleVersion.findFirst({
    where: { companyId, validFrom: { lte: date } },
    orderBy: { validFrom: 'desc' },
  });
}
```
**勤怠計算は必ずこの関数経由でルールを取得する。**

### 2.7 月途中ルール変更戦略（companies テーブルに保持）

`mid_month_rate_change_strategy: 'daily' | 'month_end'`（管理画面で切替）

- **A 案 `daily`**: 各日その日のルールを参照（実装シンプル）
- **B 案 `month_end`**: 月末日のルールで月全体を計算（デフォルト、実務多数派）

主に月 60h 超の閾値またぎ計算で差が出る。変更影響は **未締め月のみ**。

### 2.8 締め処理

- 月次で `attendance_closings` に **snapshot を凍結保存**（jsonb）
- 締め済み月は再計算しない → 過去のルール変更で集計が変わらない（整合性担保）
- 是正処理（締め解除 → 修正 → 再締め）は拡張案

### 2.9 承認フロー

**対象**: 打刻修正、有給申請

**ステータス**: `draft` / `submitted` / `approved` / `rejected` / `withdrawn` / `returned`

**ルーティング**:
- 一般 → 自分の上長（`users.manager_id`）→ 承認 / 却下 / 差戻し
- 承認者は自部下の申請のみ承認可
- admin は全件承認可

**履歴**: `approval_actions` テーブルに全アクション記録（コメント付き）

### 2.10 監査ログ

`audit_logs` に before/after JSON で全変更を記録。

主な対象：
- `work_rule_versions` の作成・変更
- `attendance_closings` の締め・解除
- `companies.mid_month_rate_change_strategy` の変更
- ロール変更

---

## 3. 技術スタック

| カテゴリ | 採用技術 | 用途・補足 |
|---|---|---|
| Framework | Next.js 15 (App Router) | Server Components + Server Actions を多用 |
| Language | TypeScript (strict) | — |
| Database / ORM | PostgreSQL (Supabase) + Prisma | — |
| Auth | Auth.js (next-auth) v5 | role-based middleware |
| Form / Validation | React Hook Form + Zod | — |
| UI | Tailwind CSS + shadcn/ui | — |
| Data Table | TanStack Table v8 | 勤怠一覧・申請一覧 |
| PDF | @react-pdf/renderer | 月次勤怠表・帳票出力 |
| Date / Time | date-fns + date-fns-tz | JST 固定の時刻計算 |
| Testing | Vitest（unit） / Playwright（E2E） | 計算ロジック中心 |
| Deploy | Vercel | — |

---

## 4. ER 図

```mermaid
erDiagram
  COMPANIES ||--o{ USERS : ""
  COMPANIES ||--o{ WORK_RULE_VERSIONS : ""
  USERS ||--o{ USERS : "manages"
  USERS ||--o{ TIME_CLOCKS : ""
  USERS ||--o{ DAILY_ATTENDANCES : ""
  USERS ||--o{ CLOCK_CORRECTION_REQUESTS : "requests"
  USERS ||--o{ LEAVE_REQUESTS : "requests"
  USERS ||--o{ LEAVE_GRANTS : ""
  USERS ||--o{ ATTENDANCE_CLOSINGS : ""
  CLOCK_CORRECTION_REQUESTS ||--o{ APPROVAL_ACTIONS : ""
  LEAVE_REQUESTS ||--o{ APPROVAL_ACTIONS : ""

  COMPANIES { uuid id PK; string name; string strategy; int closing_day }
  USERS { uuid id PK; uuid company_id FK; string role; uuid manager_id FK }
  WORK_RULE_VERSIONS { uuid id PK; uuid company_id FK; date valid_from; bool compliance_mode }
  TIME_CLOCKS { uuid id PK; uuid user_id FK; string type; timestamp occurred_at }
  DAILY_ATTENDANCES { uuid id PK; uuid user_id FK; date work_date; int ot_minutes }
  CLOCK_CORRECTION_REQUESTS { uuid id PK; uuid requester_id FK; string status; json after_payload }
  LEAVE_REQUESTS { uuid id PK; uuid requester_id FK; string status; int days }
  APPROVAL_ACTIONS { uuid id PK; string request_type; uuid request_id; string action }
  LEAVE_GRANTS { uuid id PK; uuid user_id FK; int granted_days; date expires_at }
  ATTENDANCE_CLOSINGS { uuid id PK; uuid user_id FK; string year_month; json snapshot }
```

`audit_logs (entity_type, entity_id, action, actor_id, before, after, created_at)` は全エンティティ横断で別建て。ER 図には含めず。

### 4.1 主要テーブルの全カラム

#### companies
- `id`, `name`, `closing_day` (1-31, 0=月末)
- `mid_month_rate_change_strategy` (`'daily'` | `'month_end'`)

#### users
- `id`, `company_id`, `email`, `name`
- `role` (`'admin'` | `'approver'` | `'general'`)
- `manager_id` (FK → users, 自分の承認者)
- `employment_type` (`'monthly'` | `'hourly'`)
- `hired_at`, `base_salary`, `deactivated_at`

#### work_rule_versions
- `id`, `company_id`, `valid_from`
- `daily_ot_threshold_min` (default 480)
- `weekly_ot_threshold_min` (default 2400)
- `ot_rate` (1.25)
- `night_start_time` / `night_end_time` (22:00 / 05:00)
- `night_rate_addition` (0.25)
- `legal_holiday_rate` (1.35)
- `monthly_60h_ot_rate` (1.50)
- `monthly_60h_threshold_min` (3600)
- `compliance_mode` (boolean)
- `created_at`, `created_by`

#### time_clocks
- `id`, `user_id`, `occurred_at`
- `type` (`'clock_in'` | `'clock_out'` | `'break_start'` | `'break_end'`)
- `source` (`'web'` | `'manual_correction'`)

#### daily_attendances（再計算可能な集計キャッシュ）
- `id`, `user_id`, `work_date`
- `clock_in_at`, `clock_out_at`, `break_minutes`
- `work_minutes`, `ot_minutes`, `night_minutes`
- `legal_holiday_flag`
- `recalculated_at`

#### clock_correction_requests / leave_requests
- 共通: `id`, `requester_id`, `status`, `current_approver_id`, `submitted_at`, `reason`
- 打刻修正: `target_date`, `before_payload` (jsonb), `after_payload` (jsonb)
- 有給: `leave_type`, `start_date`, `end_date`, `days`

#### approval_actions（polymorphic-lite）
- `id`, `request_type`, `request_id`, `actor_id`
- `action` (`'submit'` | `'approve'` | `'reject'` | `'withdraw'` | `'return'`)
- `comment`, `created_at`

#### leave_grants
- `id`, `user_id`, `granted_at`, `expires_at`
- `granted_days`, `used_days`
- `source` (`'legal_auto'` | `'manual'`)

#### attendance_closings
- `id`, `company_id`, `user_id`, `year_month`
- `closed_at`, `closed_by`
- `snapshot` (jsonb)

---

## 5. 画面構成（IA）

### 管理者
- ダッシュボード（未承認件数・締め未了・36 協定アラート）
- 従業員管理（CRUD・ロール変更・承認者割当）
- 勤怠一覧（全社、月次・部門フィルタ）
- 申請承認（全社の打刻修正＋有給）
- 労働ルール設定（バージョンタイムライン＋新規予約フォーム）
- 会社設定（締日・月途中変更戦略・compliance_mode）
- 月次締め処理
- 監査ログ
- レポート出力（月次勤怠表 PDF・給与 CSV）

### 承認者
- 自分の打刻＆勤怠
- 自分の申請（打刻修正・有給）
- 部下の勤怠閲覧
- 部下の申請承認（受信ボックス、未対応バッジ）

### 一般
- 打刻ホーム（出勤・退勤・休憩 大ボタン、現在状態）
- 自分の勤怠（カレンダー＋月次サマリー）
- 申請（打刻修正・有給）
- 自分の申請履歴
- 有給残数（付与履歴＋失効予定）

---

## 6. 設計方針

### 6.1 計算ロジック
- `lib/calc/` 配下に **pure function** で集約
- DB や Auth を知らない関数として書く
- 入力は plain object、出力も plain object
- Vitest で境界条件・複合条件を網羅的にテスト

### 6.2 ルール参照
- 勤怠計算は **必ず** `getEffectiveRule(companyId, date)` 経由
- 月途中変更戦略の分岐はこの上の層で実装

### 6.3 Server Actions
- フォーム処理は Server Actions で実装
- クライアント側のステート管理を最小化し、サーバー側でバリデーションと永続化を完結させる

### 6.4 権限制御
- middleware でロールベースの粗いガード
- Server Action 内で manager_id ベースの細かい認可（自部下チェック）

---

## 7. 次のタスク（Phase 1）

**計算ロジック（残業・割増）の擬似コード＋テストケース** を詰める。

### 設計対象の関数

```ts
// 1日分の勤怠から各種時間を算出
function calcDailyAttendance(
  timeClocks: TimeClock[],
  workDate: Date,
  rule: WorkRuleVersion,
  isLegalHoliday: boolean,
): DailyAttendance

// 1ヶ月分の集計（月60h超計算込み、戦略別）
function calcMonthlySummary(
  dailyAttendances: DailyAttendance[],
  yearMonth: string,
  rules: WorkRuleVersion[], // 月内で有効だった全バージョン
  strategy: 'daily' | 'month_end',
): MonthlySummary

// 給与計算用の割増賃金算出
function calcPremiumPay(
  monthlySummary: MonthlySummary,
  baseHourlyRate: number,
  rule: WorkRuleVersion,
): PremiumPayBreakdown
```

### テストケース観点

- 通常の 8h 勤務（残業なし）
- 法定外残業（日次 8h 超）
- 法定外残業（週次 40h 超だが日次 8h 以下）
- 深夜割増のみ（残業なし）
- 残業 + 深夜（1.50 倍）
- 法定休日勤務
- 法定休日 + 深夜
- 月 60h 超（A 案：日次戦略）
- 月 60h 超（B 案：月末戦略）
- 月途中でルール変更があった場合（A/B 両戦略）
- 休憩時間の控除
- 日跨ぎ勤務
- compliance_mode OFF で法定下限以下のルール

### Phase 2
Prisma スキーマ全文を書き起こす。

### Phase 3
画面ワイヤー → 実装。

---

## 8. 実装ハイライト

README で扱う想定の主要トピック：

1. 設定駆動の計算ロジック（ハードコードを排し、ルールマスタから動的取得）
2. compliance_mode による法定下限バリデーション
3. effective-dated な履歴管理
4. 締め snapshot によるデータ整合性担保
5. polymorphic-lite な承認アクション設計
6. 計算ロジックの単体テスト網羅性
7. 監査ログ
8. ロールベース権限制御（middleware + Server Action）
9. 月途中ルール変更戦略の A/B 切替

---

## 9. 設計判断のメモ

- 計算ロジックは pure function に集約し、DB / Auth に依存させない
- compliance_mode は単純トグルではなく、**法定下限バリデーションのスイッチ** として実装
- 月途中変更戦略は履歴管理に組み込まず、会社単位のメタ設定として保持（再帰問題回避）
- 打刻はイベントベース（`time_clocks`）+ 集計キャッシュ（`daily_attendances`）の二層構成
- 締め後の集計は snapshot で凍結し、過去ルール変更の影響を遮断する

---

> **新セッション開始時のプロンプト例：**
>
> 「`CLAUDE.md` を読んで全体像を把握してから、Phase 1 の計算ロジック設計を進めて。まず `calcDailyAttendance` の擬似コードと、テストケース一覧（input/expected）を出してくれ。pure function で書く前提で、TypeScript の型定義も同時に出して。」
