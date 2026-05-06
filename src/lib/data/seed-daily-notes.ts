import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { JST_TIMEZONE } from '@/lib/calc/constants';

export interface SeedNote {
  userId: string;
  jstDate: string;
  content: string;
}

const SAMPLES: Array<[number, string]> = [
  [1, 'リリース作業：v1.4.0 デプロイ完了。リリースノート公開済み。'],
  [2, '新機能の設計レビュー。API スキーマを調整中。'],
  [4, '顧客定例MTG。要望を整理して issue 化。'],
  [7, '不具合調査：締め処理のタイムゾーン関連を修正、テスト追加。'],
  [10, '月次集計バッチの性能改善。クエリ最適化で 3x 高速化。'],
  [14, 'コードレビュー多数。型定義の整理 PR を作成。'],
  [21, '新人オンボーディング資料の更新。'],
  [28, '四半期計画ミーティング。次QのOKR策定。'],
];

export function buildSeedNotes(now: Date = new Date()): SeedNote[] {
  const notes: SeedNote[] = [];
  const userId = 'u_general';

  for (const [daysAgo, content] of SAMPLES) {
    const target = new Date(now);
    target.setUTCDate(target.getUTCDate() - daysAgo);

    const dow = toZonedTime(target, JST_TIMEZONE).getDay();
    if (dow === 0 || dow === 6) continue;

    const jstDate = formatInTimeZone(target, JST_TIMEZONE, 'yyyy-MM-dd');
    notes.push({ userId, jstDate, content });
  }

  return notes;
}
