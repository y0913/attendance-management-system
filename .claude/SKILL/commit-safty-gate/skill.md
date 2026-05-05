---
name: commit-safety-gate
description: コミット前の品質・安全ゲート。git commit / git push / 「コミットして」「プッシュして」「保存して」などコードをバージョン管理に書き込む可能性があるすべての操作の前に必ず使う。Lint・型チェック・機密情報スキャン（APIキー、トークン、.env、パスワード等）を実行し、ひとつでも失敗したら commit を拒否する。フェーズ終了時の自動コミット指示でも必ず発動する。例外なく常に通すべきゲート。
---

# Commit Safety Gate

git にコードをコミットする前に必ず通す品質・安全チェック。チェックを省略しての commit は禁止。

## 発動条件

以下のいずれかに該当する状況では、何よりもまずこの skill を発動する：

- ユーザーが「コミットして」「commit して」「プッシュして」「push して」と指示した
- ユーザーが「変更を保存して」「ここまでで一旦保存」など、commit 意図のある曖昧な指示をした
- `git add` / `git commit` / `git push` のいずれかを実行しようとしている
- 各 Phase / マイルストーンの区切りで自動コミットする場面
- ユーザーが「終わったらコミットして」と先回り指示している（タスク完了時に自動発動）

## 実行手順

以下のチェックを **すべて順番に** 実行する。途中でひとつでも失敗したら、その時点で停止して commit は実行しない。

### Step 1: Lint

プロジェクトの lint コマンドを実行。**警告も含めて 0 件** であることを確認する。

```bash
# package.json の lint script が優先
npm run lint

# 直接 ESLint を呼ぶ場合は warning も errorとして扱う
npx eslint . --max-warnings=0
```

エラー・警告がひとつでも残っていたら commit を中止する。「警告くらいなら」と妥協しない。

### Step 2: 型チェック（TypeScript プロジェクトの場合）

```bash
npx tsc --noEmit
```

型エラーゼロを確認する。

### Step 3: 機密情報スキャン

ステージングされている変更すべてに対して、以下のパターンを検出する。

#### 必ず弾くファイル名パターン

```bash
git diff --cached --name-only | grep -E '\.env($|\.)' | grep -v '\.env\.example$'
```

`.env`, `.env.local`, `.env.production` などはステージングされていてはいけない。`.env.example` は OK。

#### 必ず弾く文字列パターン

```bash
git diff --cached | grep -iE '(sk_live_|sk_test_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16}|ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}|xox[baprs]-[A-Za-z0-9-]+|AIza[A-Za-z0-9_-]{35}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})'
```

代表的な機密文字列パターン：

| 種類 | パターン |
|---|---|
| Stripe Live Key | `sk_live_` |
| Stripe Test Key | `sk_test_` + 長い英数字 |
| AWS Access Key | `AKIA` + 16 桁英数大文字 |
| GitHub PAT | `ghp_`, `gho_` + 36 桁英数 |
| Slack Token | `xoxb-`, `xoxp-`, `xoxa-`, `xoxr-`, `xoxs-` |
| Google API Key | `AIza` + 35 桁英数 |
| JWT | `eyJ` で始まる 3 ピース base64（`.` 区切り） |

#### キー名 + 値のハードコードを警告

```bash
git diff --cached | grep -iE '(api[_-]?key|secret|password|private[_-]?key|access[_-]?token)\s*[=:]\s*["\x27][^"\x27]{8,}["\x27]'
```

`apiKey = "..."`, `password: "..."` のように、キー名と値が近接してハードコードされているケースを検出する。プレースホルダ（`xxx`, `your_key_here` など短すぎるもの）は無視。

### Step 4: .gitignore 検証

`.gitignore` に最低限以下が含まれていることを確認する。不足していたら **追記してから** commit する。

```
.env
.env.local
.env.*.local
node_modules/
.next/
dist/
build/
*.log
.DS_Store
.vscode/
.idea/
```

`.env.example` は明示的に許可（`!.env.example`）。

### Step 5: 通過したら commit

すべて緑になって初めて commit を実行する。コミットメッセージはユーザー指示通りに使う。

## 失敗時の対応

いずれかのチェックで NG が出た場合：

1. **commit は絶対に実行しない**
2. 何が NG だったかを具体的に報告する：
   - Lint: ファイル名、行番号、ルール名
   - 型エラー: ファイル名、行番号、エラーメッセージ
   - 機密情報: ファイル名、行番号、検出されたパターンの種類（具体的な値はマスクして表示）
3. 修正案を提示する
4. ユーザーの判断を仰ぐ

### 機密情報が検出されたときの追加対応

該当ファイルが新規追加（initial commit の場合）：
```bash
git reset HEAD <file>
echo "<file>" >> .gitignore
```

該当ファイルが既に履歴に入っている場合：
- `.git/` の履歴から削除する必要があることを警告
- `git filter-repo` または `git filter-branch` での履歴書き換えを提案
- 機密情報をローテーションすべきことを必ず伝える

## 例外的に通すケース

ユーザーが明示的に「機密チェック飛ばして」「強制コミットして」のように指示した場合：

1. **警告を必ず出す**：「機密情報の commit はリスクがあります。本当に実行しますか？」
2. ユーザーの **明確な再確認** を取得してから実行する
3. それでも `.env` 系ファイルは絶対に commit しない（これだけは例外なし）

## NG な振る舞い

- 「Lint 警告はちょっとくらい大丈夫」と通す
- 「これは多分機密じゃない」と曖昧に判断して通す
- 検出パターンを忘れて軽くチェックして済ます
- ユーザーが急いでいるからと省略する
- ステージングされていないファイルだけ見て安心する（`git diff --cached` を必ず使う）

## 補足：プロジェクト固有の追加チェック

プロジェクトに `package.json` の scripts として以下が定義されていればそれも実行する：

- `npm run typecheck`
- `npm run test`（unit test）
- `npm run format:check`（Prettier 等）

定義されていなければスキップして良い。