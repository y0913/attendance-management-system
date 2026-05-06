import type { Role } from '@prisma/client';

export interface MockUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  managerId: string | null;
  hiredAt: Date;
}

export const MOCK_USERS: MockUser[] = [
  {
    id: 'u_admin',
    email: 'admin@example.com',
    name: '管理 太郎',
    role: 'admin',
    managerId: null,
    hiredAt: new Date('2018-04-01T00:00:00+09:00'),
  },
  {
    id: 'u_approver',
    email: 'approver@example.com',
    name: '承認 花子',
    role: 'approver',
    managerId: 'u_admin',
    hiredAt: new Date('2021-04-01T00:00:00+09:00'),
  },
  {
    id: 'u_general',
    email: 'general@example.com',
    name: '一般 次郎',
    role: 'general',
    managerId: 'u_approver',
    hiredAt: new Date('2023-10-01T00:00:00+09:00'),
  },
];

export function findMockUserByEmail(email: string): MockUser | null {
  return MOCK_USERS.find((u) => u.email === email) ?? null;
}

export function findMockUserById(id: string): MockUser | null {
  return MOCK_USERS.find((u) => u.id === id) ?? null;
}

export function findSubordinates(managerId: string): MockUser[] {
  return MOCK_USERS.filter((u) => u.managerId === managerId);
}

export function isManagerOf(managerId: string, userId: string): boolean {
  const target = findMockUserById(userId);
  return target?.managerId === managerId;
}
