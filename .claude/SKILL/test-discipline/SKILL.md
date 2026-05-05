---
name: test-discipline
description: lib/calc/ 配下の pure function を実装・編集する場面、ビジネスロジックを修正する場面、バグ修正する場面で必ず使う。「テスト書いて」「テスト走らせて」「ロジック直して」「計算結果がおかしい」などの指示で発動する。テストを書くタイミング、境界条件の網羅、TDD でのバグ修正手順を規約化する。「動いたから OK」は禁止。テストが落ちたらテストを通すように実装を直す（テスト側を緩めない）。
---

# Test Discipline

テストを書くタイミングと書き方の規約。特に計算ロジック（`lib/calc/`）はポートフォリオの中核なので、網羅的にテストする。

## 発動条件

- `src/lib/calc/` 配下のファイルを作成・編集する
- ビジネスロジック（残業計算、有給消化、ルール参照など）を変更する
- バグ修正をする
- 「テスト書いて」「テスト走らせて」「Vitest 動かして」などの指示
- 計算結果が想定と違うという報告（「計算結果がおかしい」）

## テスト方針

### 必ずテストを書く対象

- `lib/calc/` 配下のすべての pure function
- 日付・時刻計算のヘルパー（タイムゾーン処理が絡むため）
- 法定下限バリデーション（compliance_mode）
- 有給残数の FIFO 消化ロジック
- ルール参照ロジック（`getEffectiveRule`）

### テストを書かなくて良い対象

- UI コンポーネントの単純な表示（型チェックでカバー）
- Prisma の単純な findUnique / findMany（ORM 自体のテストになる）
- 設定値の読み込み

### E2E テストの対象

E2E（Playwright）は **ロール別の主要ジャーニー** に限定する。全画面 E2E は工数に対してリターンが薄いため避ける。

| ロール | ジャーニー |
|---|---|
| 一般 | ログイン → 出勤打刻 → 退勤打刻 → 月次勤怠確認 |
| 一般 | 打刻修正申請 → 申請履歴で submitted を確認 |
| 一般 | 有給申請 → 残数が pending 分減ることを確認 |
| 承認者 | 部下の申請を受信ボックスで確認 → 承認 → ステータス変化 |
| 管理者 | ルール編集（未来予約） → 保存 → 一覧で表示確認 |
| 管理者 | 月次締め実行 → snapshot 保存確認 |

## テストファイルの配置

ロジックと隣接配置する：

```
src/lib/calc/
├── daily-attendance.ts
├── daily-attendance.test.ts      ← 隣に置く
├── monthly-summary.ts
├── monthly-summary.test.ts
└── premium-pay.ts
    └── premium-pay.test.ts
```

E2E は `e2e/` 配下に集約：

```
e2e/
├── general/
│   ├── clock-in-out.spec.ts
│   └── leave-request.spec.ts
├── approver/
│   └── approve-request.spec.ts
└── admin/
    ├── rule-versioning.spec.ts
    └── monthly-closing.spec.ts
```

## 計算ロジックのテストの書き方

### 境界条件を必ずテスト

「正常系 + 1パターン異常系」では足りない。境界条件を全部洗う。

例：日次残業計算 `calcDailyOt(workMinutes, threshold)`

| ケース | 入力 | 期待 |
|---|---|---|
| ぴったり閾値 | 480, 480 | 0 |
| 閾値+1 | 481, 480 | 1 |
| 閾値-1 | 479, 480 | 0 |
| 0時間勤務 | 0, 480 | 0 |
| 24時間勤務 | 1440, 480 | 960 |
| 閾値超過 | 600, 480 | 120 |
| compliance_mode OFF で閾値 0 | 480, 0 | 480 |

### Arrange-Act-Assert で書く

```typescript
import { describe, expect, it } from 'vitest';
import { calcDailyOt } from './daily-attendance';

describe('calcDailyOt', () => {
  it('閾値ちょうどなら残業 0 分', () => {
    // Arrange
    const workMinutes = 480;
    const threshold = 480;

    // Act
    const result = calcDailyOt(workMinutes, threshold);

    // Assert
    expect(result).toBe(0);
  });

  it('閾値を 1 分超えたら残業 1 分', () => {
    expect(calcDailyOt(481, 480)).toBe(1);
  });
});
```

### テーブル駆動テストで境界を網羅

```typescript
describe.each([
  ['閾値ちょうど', 480, 480, 0],
  ['閾値+1', 481, 480, 1],
  ['閾値-1', 479, 480, 0],
  ['0時間勤務', 0, 480, 0],
  ['24時間勤務', 1440, 480, 960],
  ['閾値超過', 600, 480, 120],
])('calcDailyOt: %s', (_label, work, threshold, expected) => {
  it(`work=${work}, threshold=${threshold} → ${expected}`, () => {
    expect(calcDailyOt(work, threshold)).toBe(expected);
  });
});
```

### タイムゾーン

時刻を扱うテストは **必ず JST 固定** で書く：

```typescript
import { fromZonedTime } from 'date-fns-tz';
const jst = (s: string) => fromZonedTime(s, 'Asia/Tokyo');

it('22:00 JST から深夜割増', () => {
  const start = jst('2025-04-01 22:00');
  // ...
});
```

`new Date('2025-04-01 22:00')` のようなローカルタイム依存の書き方は禁止。CI 環境の TZ が違うと壊れる。

## バグ修正の手順（TDD）

バグを発見したら：

### Step 1: 再現テストを書く

修正前に **失敗するテスト** を書く。バグの存在を test で記録する。

```typescript
it('月内ルール変更時の月60h超計算 (regression: #42)', () => {
  // バグ報告通りの入力
  const result = calcMonthlyPremium(...);
  expect(result.monthly60hSurcharge).toBe(EXPECTED);
  // ↑ 修正前は failing
});
```

### Step 2: 失敗を確認

```bash
npx vitest run path/to/file.test.ts
```

赤になることを確認する。

### Step 3: 実装を直す

最小限の修正で test を緑にする。

### Step 4: 関連テストも全部走らせる

```bash
npx vitest run
```

他のテストを壊していないか確認。

### Step 5: コミット

「fix: 月内ルール変更時の月60h超計算が誤っていた問題」のようなメッセージで commit する。テストも同じコミットに含める。

## カバレッジ

- `lib/calc/` 配下は **branch coverage 90% 以上** を目標
- カバレッジ測定: `npx vitest run --coverage`
- 100% を盲目的に追わない（自明なゲッターまでテストするのは過剰）

## NG な振る舞い

- 「動いたから OK」でテスト書かずに進める
- 計算ロジックを変更したのに既存テストを走らせない
- テストが落ちたら **テスト側の expected を変えて通す** ← 絶対 NG（バグ報告でない限り）
- 境界条件を 1 パターンだけ書いて済ます（閾値ちょうど、+1、-1 は最低でも書く）
- E2E でユニットテストの代わりをしようとする（重い、遅い、壊れやすい）
- 時刻を `new Date(string)` で書く（タイムゾーン依存）
- バグ修正で再現テストを書かずに直す（同じバグが再発する）
- `expect(...).toBeTruthy()` のような曖昧なアサーション（具体的な値で比較する）

## テスト実行コマンド早見表

```bash
# 単発実行
npx vitest run

# 特定ファイル
npx vitest run path/to/file.test.ts

# watch モード（開発中）
npx vitest

# カバレッジ
npx vitest run --coverage

# E2E
npx playwright test

# E2E 特定ファイル
npx playwright test e2e/general/clock-in-out.spec.ts
```
