import type { Role } from '@prisma/client';

export interface MockUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  managerId: string | null;
}

export const MOCK_USERS: MockUser[] = [
  {
    id: 'u_admin',
    email: 'admin@example.com',
    name: '管理 太郎',
    role: 'admin',
    managerId: null,
  },
  {
    id: 'u_approver',
    email: 'approver@example.com',
    name: '承認 花子',
    role: 'approver',
    managerId: 'u_admin',
  },
  {
    id: 'u_general',
    email: 'general@example.com',
    name: '一般 次郎',
    role: 'general',
    managerId: 'u_approver',
  },
];

export function findMockUserByEmail(email: string): MockUser | null {
  return MOCK_USERS.find((u) => u.email === email) ?? null;
}

export function findMockUserById(id: string): MockUser | null {
  return MOCK_USERS.find((u) => u.id === id) ?? null;
}
