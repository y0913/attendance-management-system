// upsertEmployeeAction / setEmployeeDeactivationAction の認可・自己防衛ロジックを検証。
// auth() を mock してロール別の挙動を確認する。

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, usersMock, auditLogMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  usersMock: {
    findMockUserById: vi.fn(),
    isEmailTaken: vi.fn(),
    createMockUser: vi.fn(),
    updateMockUser: vi.fn(),
    setUserDeactivation: vi.fn(),
  },
  auditLogMock: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: async <T,>(fn: (tx: unknown) => Promise<T>) => fn({}),
  },
  withTx: async <T,>(_db: unknown, fn: (tx: unknown) => Promise<T>) => fn({}),
}));

vi.mock('@/auth', () => ({
  auth: authMock,
}));

// session.ts は auth() を呼ぶラッパーなので合わせて mock
vi.mock('@/lib/data/session', () => ({
  getMockSession: async () => {
    const session = await authMock();
    if (!session?.user?.id) return null;
    return usersMock.findMockUserById(session.user.id);
  },
}));

vi.mock('@/lib/data/users', () => usersMock);

vi.mock('@/lib/data/audit-logs', () => ({
  recordAuditLog: auditLogMock,
}));

import {
  setEmployeeDeactivationAction,
  upsertEmployeeAction,
} from './actions';
import { adminUser } from '@/test/fixtures';

const validInput = {
  name: '新人',
  email: 'new@example.com',
  role: 'general' as const,
  managerId: 'u_approver',
  employmentType: 'monthly' as const,
  hiredAt: '2026-05-01',
  baseSalary: 250000,
};

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: 'u_admin' } });
  usersMock.findMockUserById.mockImplementation(async (id: string) => {
    if (id === 'u_admin') return adminUser;
    if (id === 'u_approver')
      return { ...adminUser, id: 'u_approver', role: 'approver' };
    if (id === 'u_general')
      return { ...adminUser, id: 'u_general', role: 'general', managerId: 'u_approver' };
    return null;
  });
  usersMock.isEmailTaken.mockResolvedValue(false);
});

describe('upsertEmployeeAction (auth)', () => {
  it('UNAUTHORIZED if no session', async () => {
    authMock.mockResolvedValueOnce(null);
    const result = await upsertEmployeeAction(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNAUTHORIZED');
  });

  it('FORBIDDEN if non-admin', async () => {
    authMock.mockResolvedValueOnce({ user: { id: 'u_general' } });
    const result = await upsertEmployeeAction(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });
});

describe('upsertEmployeeAction (self-protection)', () => {
  it('CONFLICT if admin tries to demote themselves', async () => {
    const result = await upsertEmployeeAction({
      ...validInput,
      id: 'u_admin',
      role: 'general',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CONFLICT');
      expect(
        'message' in result.error ? result.error.message : '',
      ).toMatch(/降格/);
    }
  });

  it('CONFLICT if managerId equals own id (self-as-manager)', async () => {
    const result = await upsertEmployeeAction({
      ...validInput,
      id: 'u_general',
      role: 'general',
      managerId: 'u_general',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CONFLICT');
      expect(
        'message' in result.error ? result.error.message : '',
      ).toMatch(/承認者/);
    }
  });

  it('VALIDATION if managerId points to non-existent user', async () => {
    const result = await upsertEmployeeAction({
      ...validInput,
      managerId: 'u_nonexistent',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });

  it('CONFLICT if email is taken', async () => {
    usersMock.isEmailTaken.mockResolvedValueOnce(true);
    const result = await upsertEmployeeAction(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CONFLICT');
  });
});

describe('upsertEmployeeAction (success)', () => {
  it('creates new user when id is not provided', async () => {
    usersMock.createMockUser.mockResolvedValueOnce({
      ...adminUser,
      id: 'u_new',
      email: 'new@example.com',
      role: 'general',
      managerId: 'u_approver',
    });
    const result = await upsertEmployeeAction(validInput);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe('u_new');
    expect(usersMock.createMockUser).toHaveBeenCalledOnce();
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', entityType: 'user' }),
      expect.anything(),
    );
  });

  it('updates existing user when id is provided', async () => {
    usersMock.updateMockUser.mockResolvedValueOnce({
      ...adminUser,
      id: 'u_general',
    });
    const result = await upsertEmployeeAction({
      ...validInput,
      id: 'u_general',
    });
    expect(result.ok).toBe(true);
    expect(usersMock.updateMockUser).toHaveBeenCalledOnce();
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'update', entityType: 'user' }),
      expect.anything(),
    );
  });
});

describe('setEmployeeDeactivationAction', () => {
  it('CONFLICT if admin tries to deactivate themselves', async () => {
    const result = await setEmployeeDeactivationAction({
      id: 'u_admin',
      deactivate: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CONFLICT');
      expect(
        'message' in result.error ? result.error.message : '',
      ).toMatch(/自分自身/);
    }
  });

  it('records deactivate audit log on success', async () => {
    usersMock.setUserDeactivation.mockResolvedValueOnce({
      ...adminUser,
      id: 'u_general',
      deactivatedAt: new Date(),
    });
    const result = await setEmployeeDeactivationAction({
      id: 'u_general',
      deactivate: true,
    });
    expect(result.ok).toBe(true);
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'deactivate', entityType: 'user' }),
      expect.anything(),
    );
  });

  it('records reactivate audit log when deactivate=false', async () => {
    usersMock.setUserDeactivation.mockResolvedValueOnce({
      ...adminUser,
      id: 'u_general',
      deactivatedAt: null,
    });
    const result = await setEmployeeDeactivationAction({
      id: 'u_general',
      deactivate: false,
    });
    expect(result.ok).toBe(true);
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'reactivate' }),
      expect.anything(),
    );
  });
});
