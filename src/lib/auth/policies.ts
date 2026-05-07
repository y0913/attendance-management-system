// 認可ポリシー（pure 関数 + DB 引きする async 関数）。
//
// 責務分担:
// - これらのポリシーは page / server action の「事前チェック」用。
// - data 層関数は内部で同等のチェックを別途持つ（深い防御）。policies は
//   data 層を置き換えるものではなく、UI 側の早期リダイレクトと文言出し分けが目的。
// - session を受け取るが、state は持たない (pure)。テスト容易性のため。

import type { MockUser } from '@/lib/data/users';
import { isManagerOf } from '@/lib/data/users';

export const isAdmin = (s: MockUser): boolean => s.role === 'admin';

export const isApproverRole = (s: MockUser): boolean =>
  s.role === 'approver' || s.role === 'admin';

// 申請の現行承認者として処理（承認/却下/差戻し）できるか。
// admin は全件可、それ以外は currentApproverId 一致時のみ。
export function canDecideRequest(
  session: MockUser,
  request: { currentApproverId: string | null },
): boolean {
  if (isAdmin(session)) return true;
  return request.currentApproverId === session.id;
}

// 自分の申請を取下げできるか。requester 本人のみ（admin でも他人の取下げは不可）。
export function canWithdrawRequest(
  session: MockUser,
  request: { requesterId: string },
): boolean {
  return request.requesterId === session.id;
}

// 対象ユーザーの勤怠を閲覧できるか。
// admin: 全員可
// approver: 自部下のみ可（DB 引き）
// general: 自分のみ可
export async function canViewUserAttendance(
  session: MockUser,
  targetUserId: string,
): Promise<boolean> {
  if (isAdmin(session)) return true;
  if (session.id === targetUserId) return true;
  if (session.role !== 'approver') return false;
  return await isManagerOf(session.id, targetUserId);
}
