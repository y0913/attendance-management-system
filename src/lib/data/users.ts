// Phase 2: 内部を Prisma 経由に書き換え。API 形は維持しつつ async 化。
// 旧 mock 配列・ensureSeeded は廃止し、seed は prisma/seed.ts へ移動済み。

import { Prisma, type EmploymentType, type Role, type User } from '@prisma/client';
import { prisma, type DbClient } from '@/lib/db';

// Prisma のレコード未発見エラー (P2025) のみ意図的に null で吸収する。
// それ以外（接続エラー・制約違反など）は throw して呼び出し側に委ねる。
const isNotFoundError = (e: unknown): boolean =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025';

export interface MockUser {
  id: string;
  email: string;
  name: string;
  companyId: string;
  role: Role;
  managerId: string | null;
  employmentType: EmploymentType;
  hiredAt: Date;
  baseSalary: number | null;
  deactivatedAt: Date | null;
}

const toMockUser = (u: User): MockUser => ({
  id: u.id,
  email: u.email,
  name: u.name ?? '',
  companyId: u.companyId,
  role: u.role,
  managerId: u.managerId,
  employmentType: u.employmentType,
  hiredAt: u.hiredAt ?? new Date(0),
  baseSalary: u.baseSalary,
  deactivatedAt: u.deactivatedAt,
});

export async function findMockUserByEmail(
  email: string,
): Promise<MockUser | null> {
  const u = await prisma.user.findUnique({ where: { email } });
  return u ? toMockUser(u) : null;
}

export async function findMockUserById(id: string): Promise<MockUser | null> {
  const u = await prisma.user.findUnique({ where: { id } });
  return u ? toMockUser(u) : null;
}

export async function findSubordinates(managerId: string): Promise<MockUser[]> {
  const users = await prisma.user.findMany({
    where: { managerId, deactivatedAt: null },
  });
  return users.map(toMockUser);
}

export async function isManagerOf(
  managerId: string,
  userId: string,
): Promise<boolean> {
  const target = await findMockUserById(userId);
  return target?.managerId === managerId;
}

export async function listActiveUsers(companyId: string): Promise<MockUser[]> {
  const users = await prisma.user.findMany({
    where: { companyId, deactivatedAt: null },
  });
  return users.map(toMockUser);
}

export async function findMockUsersByIds(ids: string[]): Promise<MockUser[]> {
  if (ids.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
  });
  return users.map(toMockUser);
}

export async function listAllUsers(companyId: string): Promise<MockUser[]> {
  const users = await prisma.user.findMany({ where: { companyId } });
  return users.map(toMockUser);
}

export interface CreateUserInput {
  email: string;
  name: string;
  companyId: string;
  role: Role;
  managerId: string | null;
  employmentType: EmploymentType;
  hiredAt: Date;
  baseSalary: number | null;
}

export async function createMockUser(
  input: CreateUserInput,
  db: DbClient = prisma,
): Promise<MockUser> {
  const user = await db.user.create({
    data: {
      email: input.email,
      name: input.name,
      companyId: input.companyId,
      role: input.role,
      managerId: input.managerId,
      employmentType: input.employmentType,
      hiredAt: input.hiredAt,
      baseSalary: input.baseSalary,
    },
  });
  return toMockUser(user);
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
  role?: Role;
  managerId?: string | null;
  employmentType?: EmploymentType;
  hiredAt?: Date;
  baseSalary?: number | null;
}

export async function updateMockUser(
  companyId: string,
  id: string,
  input: UpdateUserInput,
  db: DbClient = prisma,
): Promise<MockUser | null> {
  // companyId 一致を先に検証してからの update。cross-tenant の URL 推測経由で
  // 他社ユーザーが書き換えられるのを防ぐ。
  const existing = await db.user.findFirst({ where: { id, companyId } });
  if (!existing) return null;
  try {
    const user = await db.user.update({
      where: { id },
      data: {
        email: input.email,
        name: input.name,
        role: input.role,
        managerId: input.managerId,
        employmentType: input.employmentType,
        hiredAt: input.hiredAt,
        baseSalary: input.baseSalary,
      },
    });
    return toMockUser(user);
  } catch (e) {
    if (isNotFoundError(e)) return null;
    throw e;
  }
}

export async function setUserDeactivation(
  companyId: string,
  id: string,
  deactivatedAt: Date | null,
  db: DbClient = prisma,
): Promise<MockUser | null> {
  const existing = await db.user.findFirst({ where: { id, companyId } });
  if (!existing) return null;
  try {
    const user = await db.user.update({
      where: { id },
      // deactivate と同時に tokenVersion を bump し、active な JWT を即無効化対象にする。
      // 次の jwt callback refresh (最大 1 分) で session が切れる。
      data: deactivatedAt
        ? { deactivatedAt, tokenVersion: { increment: 1 } }
        : { deactivatedAt },
    });
    return toMockUser(user);
  } catch (e) {
    if (isNotFoundError(e)) return null;
    throw e;
  }
}

// 個別 force logout。tokenVersion を bump して当該ユーザーの既存 JWT を
// 次の refresh (最大 1 分) で無効化する。
export async function bumpUserTokenVersion(
  companyId: string,
  id: string,
  db: DbClient = prisma,
): Promise<MockUser | null> {
  const existing = await db.user.findFirst({ where: { id, companyId } });
  if (!existing) return null;
  try {
    const user = await db.user.update({
      where: { id },
      data: { tokenVersion: { increment: 1 } },
    });
    return toMockUser(user);
  } catch (e) {
    if (isNotFoundError(e)) return null;
    throw e;
  }
}

export async function isEmailTaken(
  email: string,
  exceptId?: string,
): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { email } });
  if (!u) return false;
  return u.id !== exceptId;
}
