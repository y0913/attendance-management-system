// Vitest setup file. unit test 全体で必要な「常に同じ shape の mock」を集約する。
// テストごとに上書きが必要な mock (auth / data 層) はここに置かないこと。
//
// vitest.config.ts の test.setupFiles にこのファイルを指定して有効化する。

import { vi } from 'vitest';

// Server Action から呼ばれる Next.js キャッシュ無効化 API は test では何もしない。
// revalidatePath / revalidateTag いずれも副作用検証ではなく「呼ばれること」を
// 確認するケースが現状無いので、ただの no-op にする。
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// next/navigation の redirect / notFound は Server Action や page で使う可能性があり、
// テストでは throw されると邪魔なので no-op にしておく。
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
}));
