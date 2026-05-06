// Phase 2: 内部を Prisma 経由に書き換え。API 形は維持しつつ async 化。
// 旧 mock 配列・ensureSeeded は廃止し、seed は prisma/seed.ts へ移動済み。

import type { EmploymentType, Role, User } from '@prisma/client';
import { prisma } from '@/lib/db';

export interface MockUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  managerId: string | null;
  employmentType: EmploymentType;
  hiredAt: Date;
  baseSalary: number | null;
  deactivatedAt: Date | null;
}

const COMPANY_ID = 'co_default';

const toMockUser = (u: User): MockUser => ({
  id: u.id,
  email: u.email,
  name: u.name ?? '',
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

export async function listActiveUsers(): Promise<MockUser[]> {
  const users = await prisma.user.findMany({
    where: { deactivatedAt: null },
  });
  return users.map(toMockUser);
}

export async function listAllUsers(): Promise<MockUser[]> {
  const users = await prisma.user.findMany();
  return users.map(toMockUser);
}

export interface CreateUserInput {
  email: string;
  name: string;
  role: Role;
  managerId: string | null;
  employmentType: EmploymentType;
  hiredAt: Date;
  baseSalary: number | null;
}

export async function createMockUser(
  input: CreateUserInput,
): Promise<MockUser> {
  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      companyId: COMPANY_ID,
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
  id: string,
  input: UpdateUserInput,
): Promise<MockUser | null> {
  try {
    const user = await prisma.user.update({
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
  } catch {
    return null;
  }
}

export async function setUserDeactivation(
  id: string,
  deactivatedAt: Date | null,
): Promise<MockUser | null> {
  try {
    const user = await prisma.user.update({
      where: { id },
      data: { deactivatedAt },
    });
    return toMockUser(user);
  } catch {
    return null;
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
