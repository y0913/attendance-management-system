---
name: server-action-pattern
description: Next.js App Router で Server Action を実装する場面で必ず使う。'use server' を書く時、フォーム送信処理を実装する時、ミューテーション系の API を作る時、「Server Action 書いて」「フォーム処理書いて」「データ更新の処理書いて」などの指示で発動する。認証・バリデーション・権限チェック・エラーハンドリング・キャッシュ再検証の全レイヤーを規約通りに揃えるためのテンプレート。Server Action は雑に書くとセキュリティホールになるため、毎回必ず通すべきガード。
---

# Server Action Pattern

Next.js App Router の Server Action 実装規約。認可漏れ・バリデーション漏れは即セキュリティ事故になるため、毎回テンプレに沿って書く。

## 発動条件

- `'use server'` を含むファイルを作成・編集する
- フォーム送信処理を実装する
- データ更新（create / update / delete）を伴う関数を実装する
- 「Server Action 書いて」「保存処理作って」「フォームのアクション書いて」などの指示

## Server Action の必須レイヤー

すべての Server Action は **以下の 5 層を順番に通す**：

1. **Auth**: ログインしているか
2. **Validate**: 入力が型・スキーマに合うか（Zod）
3. **Authorize**: そのユーザーがその操作をする権限があるか
4. **Execute**: ビジネスロジック実行（DB アクセス含む）
5. **Revalidate & Return**: キャッシュ再検証して構造化レスポンス返却

省略したり順序を入れ替えたりしない。

## 標準テンプレート

```typescript
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import type { ActionResult } from '@/lib/action-result';

// 1. 入力スキーマ
const InputSchema = z.object({
  targetDate: z.string().date(),
  reason: z.string().min(1).max(500),
});

type Input = z.infer<typeof InputSchema>;

// 2. Action 本体
export async function createClockCorrectionRequest(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  // ─── Auth ──────────────────────────────────────
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: { code: 'UNAUTHORIZED' } };
  }

  // ─── Validate ──────────────────────────────────
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION', details: parsed.error.flatten() },
    };
  }

  // ─── Authorize ─────────────────────────────────
  // 例: 一般ユーザーは自分の打刻修正のみ可能
  // ここで manager_id ベースの細かい認可ロジックを書く

  // ─── Execute ───────────────────────────────────
  try {
    const created = await prisma.clockCorrectionRequest.create({
      data: {
        requesterId: session.user.id,
        targetDate: new Date(parsed.data.targetDate),
        reason: parsed.data.reason,
        status: 'submitted',
      },
      select: { id: true },
    });

    // ─── Revalidate ────────────────────────────────
    revalidatePath('/requests');

    return { ok: true, data: { id: created.id } };
  } catch (e) {
    console.error('createClockCorrectionRequest failed', e);
    return { ok: false, error: { code: 'INTERNAL' } };
  }
}
```

## ActionResult 型（共通）

`/lib/action-result.ts` に共通定義を置き、すべての Server Action で使う。

```typescript
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

export type ActionError =
  | { code: 'UNAUTHORIZED' }
  | { code: 'FORBIDDEN' }
  | { code: 'VALIDATION'; details: unknown }
  | { code: 'NOT_FOUND' }
  | { code: 'CONFLICT'; message?: string }
  | { code: 'INTERNAL' };
```

クライアント側では `if (result.ok)` で型を絞る。`throw` ではなく `Result` 型で扱う。

## 認可（Authorize）の書き方

### ロールベースの粗いチェック

```typescript
if (session.user.role !== 'admin') {
  return { ok: false, error: { code: 'FORBIDDEN' } };
}
```

### リソースベースの細かいチェック

たとえば「自部下の申請のみ承認可能」のような場合：

```typescript
const request = await prisma.leaveRequest.findUnique({
  where: { id: requestId },
  select: { requesterId: true, requester: { select: { managerId: true } } },
});
if (!request) {
  return { ok: false, error: { code: 'NOT_FOUND' } };
}

const canApprove =
  session.user.role === 'admin' ||
  (session.user.role === 'approver' &&
    request.requester.managerId === session.user.id);

if (!canApprove) {
  return { ok: false, error: { code: 'FORBIDDEN' } };
}
```

**「自分のリソースか」「自部下か」のチェックは必ずサーバ側で行う**。クライアントから渡された role や userId を信用しない。常に `session` から取る。

## 入力スキーマ（Zod）

- すべての Server Action は **入力を Zod で検証**
- 引数の型は `unknown` にして、`safeParse` で絞る（クライアントが何渡してくるか分からない前提）
- `FormData` を受ける場合は最初に Object に変換してから `safeParse`
- ID は `z.string().cuid()` または `z.string().uuid()` で形式チェック
- 日付は `z.string().date()` または `z.coerce.date()`
- 数値の上限・下限を必ず明記（`.min(0).max(1440)` など）

## キャッシュ再検証

データを変更する Server Action は **必ず** 影響を受けるパスを再検証：

```typescript
revalidatePath('/attendance');
revalidatePath(`/users/${userId}`);

// タグベースで管理しているなら
revalidateTag('leave-requests');
```

再検証を忘れると、UI に古いデータが表示される。SPA 的な見た目で動かないバグの温床。

## ファイル配置

- Server Action 単体ファイル: `src/app/<route>/actions.ts`
- 機能横断のもの: `src/lib/actions/<feature>.ts`
- ヘルパー（auth check 等）: `src/lib/auth/guards.ts`

## NG な振る舞い

- `'use server'` の宣言忘れ
- `try/catch` なし（DB エラーがそのままクライアントに漏れる）
- バリデーションを `zod` ではなく手書き `if` でやる
- 認可チェックを skip して「呼び出し元で見てる」と仮定する
- `session.user.id` を信用せず、引数で渡された userId を使う ← **絶対NG**
- `revalidatePath` を忘れる
- エラーを `throw` する（クライアントで catch しないとクラッシュ）
- 戻り値の型をその場で書く（共通の ActionResult を使う）
- DB の生エラーメッセージをそのまま `error.message` で返す（情報漏洩リスク）
