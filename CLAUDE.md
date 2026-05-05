# 勤怠管理システム — 実装規約・仕様詳細

> **このドキュメントは実装作業に直結する規約・仕様・Phase 状態に絞っている。**
> プロジェクトの全体像（目的・採用技術スタックと選定理由・実装ハイライト・ER 図・設計判断のメモ）は [`README.md`](./README.md) を最初に読むこと。
> 規約系（Server Action テンプレ、コミット安全ゲート、Prisma マイグレーション、テスト規律）は [`.claude/SKILL/`](./.claude/SKILL/) 配下を参照。

---

## 1. 機能スコープ（実装制約）

### 1.1 ロール（3 段階）

| ロール | 権限 |
|---|---|
| `admin` | 全権限。会社設定・ルール変更・締め処理・全申請承認 |
| `approver` | 自分の部下（manager_id で紐づく一般ユーザー）の申請承認、勤怠閲覧 |
| `general` | 自分の打刻、勤怠閲覧、申請（打刻修正・有給） |

### 1.2 勤務形態

- 単一会社（マルチテナント化は拡張案）
- 固定勤務のみ(シフト・フレックスは拡張案)
- 月末固定締め（任意締め日は拡張案）
- 雇用形態：正社員月給 / 時給バイト

### 1.3 打刻

- Web ボタン打刻（IP 制限・位置情報は拡張案）
- 休憩は手動打刻（自動控除なし）
- 打刻修正は **申請 → 承認フロー必須**（直接編集不可）

### 1.4 休暇

- 有給のみ（振休・代休・特別休暇は拡張案）
- 法定付与を自動実行（入社 6 ヶ月後 10 日 → 11/12/14/16/18/20 日）
- **FIFO 消化**、失効管理あり
- 申請 → 承認フロー

### 1.5 残業計算（B 案：労基法準拠）

| 項目 | 値 |
|---|---|
| 法定外残業（1 日 8h 超 / 週 40h 超） | 1.25 倍 |
| 深夜割増（22:00–05:00） | +0.25（残業と重複時 1.50） |
| 法定休日 | 1.35 倍 |
| 月 60h 超の法定外残業 | 1.50 倍 |

### 1.6 労働ルール設定

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

### 1.7 月途中ルール変更戦略（companies テーブルに保持）

`mid_month_rate_change_strategy: 'daily' | 'month_end'`（管理画面で切替）

- **A 案 `daily`**: 各日その日のルールを参照（実装シンプル）
- **B 案 `month_end`**: 月末日のルールで月全体を計算（デフォルト、実務多数派）

主に月 60h 超の閾値またぎ計算で差が出る。変更影響は **未締め月のみ**。

### 1.8 締め処理

- 月次で `attendance_closings` に **snapshot を凍結保存**（jsonb）
- 締め済み月は再計算しない → 過去のルール変更で集計が変わらない（整合性担保）
- 是正処理（締め解除 → 修正 → 再締め）は拡張案

### 1.9 承認フロー

**対象**: 打刻修正、有給申請

**ステータス**: `draft` / `submitted` / `approved` / `rejected` / `withdrawn` / `returned`

**ルーティング**:
- 一般 → 自分の上長（`users.manager_id`）→ 承認 / 却下 / 差戻し
- 承認者は自部下の申請のみ承認可
- admin は全件承認可

**履歴**: `approval_actions` テーブルに全アクション記録(コメント付き)

### 1.10 監査ログ

`audit_logs` に before/after JSON で全変更を記録。

主な対象：
- `work_rule_versions` の作成・変更
- `attendance_closings` の締め・解除
- `companies.mid_month_rate_change_strategy` の変更
- ロール変更

---

## 2. 主要テーブルの全カラム

> ER 図と全体構造は [`README.md` の ER 図セクション](./README.md#er-図) を参照。本節は実装に直結するカラム定義。

### companies
- `id`, `name`, `closing_day` (1-31, 0=月末)
- `mid_month_rate_change_strategy` (`'daily'` | `'month_end'`)

### users
- `id`, `company_id`, `email`, `name`
- `role` (`'admin'` | `'approver'` | `'general'`)
- `manager_id` (FK → users, 自分の承認者)
- `employment_type` (`'monthly'` | `'hourly'`)
- `hired_at`, `base_salary`, `deactivated_at`

### work_rule_versions
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

### time_clocks
- `id`, `user_id`, `occurred_at`
- `type` (`'clock_in'` | `'clock_out'` | `'break_start'` | `'break_end'`)
- `source` (`'web'` | `'manual_correction'`)

### daily_attendances（再計算可能な集計キャッシュ）
- `id`, `user_id`, `work_date`
- `clock_in_at`, `clock_out_at`, `break_minutes`
- `work_minutes`, `ot_minutes`, `night_minutes`
- `legal_holiday_flag`
- `recalculated_at`

### clock_correction_requests / leave_requests
- 共通: `id`, `requester_id`, `status`, `current_approver_id`, `submitted_at`, `reason`
- 打刻修正: `target_date`, `before_payload` (jsonb), `after_payload` (jsonb)
- 有給: `leave_type`, `start_date`, `end_date`, `days`

### approval_actions（polymorphic-lite）
- `id`, `request_type`, `request_id`, `actor_id`
- `action` (`'submit'` | `'approve'` | `'reject'` | `'withdraw'` | `'return'`)
- `comment`, `created_at`

### leave_grants
- `id`, `user_id`, `granted_at`, `expires_at`
- `granted_days`, `used_days`
- `source` (`'legal_auto'` | `'manual'`)

### attendance_closings
- `id`, `company_id`, `user_id`, `year_month`
- `closed_at`, `closed_by`
- `snapshot` (jsonb)

---

## 3. 画面構成（IA）

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

## 4. 設計方針（実装規約）

### 4.1 計算ロジック
- `lib/calc/` 配下に **pure function** で集約
- DB や Auth を知らない関数として書く
- 入力は plain object、出力も plain object
- Vitest で境界条件・複合条件を網羅的にテスト
- 詳しくは [`.claude/SKILL/test-discipline/SKILL.md`](./.claude/SKILL/test-discipline/SKILL.md)

### 4.2 ルール参照
- 勤怠計算は **必ず** `getEffectiveRule(companyId, date)` 経由
- 月途中変更戦略の分岐はこの上の層で実装

### 4.3 Server Actions
- フォーム処理は Server Actions で実装
- クライアント側のステート管理を最小化し、サーバー側でバリデーションと永続化を完結させる
- 必須 5 層（Auth → Validate → Authorize → Execute → Revalidate）と `ActionResult` 型は [`.claude/SKILL/server-action-pattern/SKILL.md`](./.claude/SKILL/server-action-pattern/SKILL.md) を参照

### 4.4 権限制御
- middleware でロールベースの粗いガード
- Server Action 内で manager_id ベースの細かい認可（自部下チェック）
- クライアントから渡された role / userId は信用せず、必ず `session` から取得

### 4.5 Prisma スキーマ運用
- 命名規約・破壊的変更検出・既存マイグレーション保護は [`.claude/SKILL/prisma-migration-discipline/SKILL.md`](./.claude/SKILL/prisma-migration-discipline/SKILL.md)

### 4.6 コミット
- Lint / 型チェック / 機密情報スキャン全部通してから commit
- 詳しくは [`.claude/SKILL/commit-safty-gate/SKILLl.md`](./.claude/SKILL/commit-safty-gate/SKILLl.md)

---

## 5. 現在の Phase

### Phase 1（進行中）：計算ロジック設計

**設計対象の関数**

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

**テストケース観点**

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

### Phase 2（予定）
Prisma スキーマ全文を書き起こす。

### Phase 3（予定）
画面ワイヤー → 実装。

---

> **新セッション開始時のプロンプト例：**
>
> 「`README.md` で全体像を把握してから、`CLAUDE.md` の実装規約と現在の Phase を確認して。Phase 1 の `calcDailyAttendance` の擬似コードと、テストケース一覧（input/expected）を出してくれ。pure function で書く前提で、TypeScript の型定義も同時に出して。」
