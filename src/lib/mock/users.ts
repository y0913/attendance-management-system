import type { EmploymentType, Role } from '@prisma/client';

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

const store: MockUser[] = [
  {
    id: 'u_admin',
    email: 'admin@example.com',
    name: '管理 太郎',
    role: 'admin',
    managerId: null,
    employmentType: 'monthly',
    hiredAt: new Date('2018-04-01T00:00:00+09:00'),
    baseSalary: 600000,
    deactivatedAt: null,
  },
  {
    id: 'u_approver',
    email: 'approver@example.com',
    name: '承認 花子',
    role: 'approver',
    managerId: 'u_admin',
    employmentType: 'monthly',
    hiredAt: new Date('2021-04-01T00:00:00+09:00'),
    baseSalary: 450000,
    deactivatedAt: null,
  },
  {
    id: 'u_general',
    email: 'general@example.com',
    name: '一般 次郎',
    role: 'general',
    managerId: 'u_approver',
    employmentType: 'monthly',
    hiredAt: new Date('2023-10-01T00:00:00+09:00'),
    baseSalary: 300000,
    deactivatedAt: null,
  },
];

export const MOCK_USERS: readonly MockUser[] = store;

export function findMockUserByEmail(email: string): MockUser | null {
  return store.find((u) => u.email === email) ?? null;
}

export function findMockUserById(id: string): MockUser | null {
  return store.find((u) => u.id === id) ?? null;
}

export function findSubordinates(managerId: string): MockUser[] {
  return store.filter(
    (u) => u.managerId === managerId && u.deactivatedAt === null,
  );
}

export function isManagerOf(managerId: string, userId: string): boolean {
  const target = findMockUserById(userId);
  return target?.managerId === managerId;
}

export function listActiveUsers(): MockUser[] {
  return store.filter((u) => u.deactivatedAt === null);
}

export function listAllUsers(): MockUser[] {
  return store.slice();
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

export function createMockUser(input: CreateUserInput): MockUser {
  const user: MockUser = {
    id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    email: input.email,
    name: input.name,
    role: input.role,
    managerId: input.managerId,
    employmentType: input.employmentType,
    hiredAt: input.hiredAt,
    baseSalary: input.baseSalary,
    deactivatedAt: null,
  };
  store.push(user);
  return user;
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

export function updateMockUser(id: string, input: UpdateUserInput): MockUser | null {
  const user = store.find((u) => u.id === id);
  if (!user) return null;
  if (input.email !== undefined) user.email = input.email;
  if (input.name !== undefined) user.name = input.name;
  if (input.role !== undefined) user.role = input.role;
  if (input.managerId !== undefined) user.managerId = input.managerId;
  if (input.employmentType !== undefined)
    user.employmentType = input.employmentType;
  if (input.hiredAt !== undefined) user.hiredAt = input.hiredAt;
  if (input.baseSalary !== undefined) user.baseSalary = input.baseSalary;
  return user;
}

export function setUserDeactivation(
  id: string,
  deactivatedAt: Date | null,
): MockUser | null {
  const user = store.find((u) => u.id === id);
  if (!user) return null;
  user.deactivatedAt = deactivatedAt;
  return user;
}

export function isEmailTaken(email: string, exceptId?: string): boolean {
  return store.some((u) => u.email === email && u.id !== exceptId);
}
