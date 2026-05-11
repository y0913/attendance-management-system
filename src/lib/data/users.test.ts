// users.ts の CRUD と P2025 例外の意図的吸収を検証。

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
  withTx: async <T,>(_db: unknown, fn: (tx: unknown) => Promise<T>) =>
    fn(prismaMock),
}));

import {
  createMockUser,
  findMockUserById,
  findSubordinates,
  isEmailTaken,
  isManagerOf,
  listActiveUsers,
  setUserDeactivation,
  updateMockUser,
} from './users';

const dbUser = {
  id: 'u_general',
  email: 'general@example.com',
  name: '一般 次郎',
  role: 'general',
  managerId: 'u_approver',
  employmentType: 'monthly',
  hiredAt: new Date('2023-10-01'),
  baseSalary: 300000,
  deactivatedAt: null,
  companyId: 'co_default',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('findMockUserById', () => {
  it('returns null when not found', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    expect(await findMockUserById('u_missing')).toBeNull();
  });

  it('maps DB row to MockUser with default name when null', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      ...dbUser,
      name: null,
    });
    const u = await findMockUserById('u_general');
    expect(u?.name).toBe('');
  });
});

describe('findSubordinates', () => {
  it('filters by managerId and excludes deactivated', async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([dbUser]);
    await findSubordinates('u_approver');
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { managerId: 'u_approver', deactivatedAt: null },
    });
  });
});

describe('isManagerOf', () => {
  it('true when user.managerId matches', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(dbUser);
    expect(await isManagerOf('u_approver', 'u_general')).toBe(true);
  });

  it('false when user not found', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    expect(await isManagerOf('u_approver', 'u_missing')).toBe(false);
  });

  it('false when manager mismatch', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(dbUser);
    expect(await isManagerOf('u_other', 'u_general')).toBe(false);
  });
});

describe('listActiveUsers', () => {
  it('filters by companyId + deactivatedAt: null', async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([]);
    await listActiveUsers('co_default');
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { companyId: 'co_default', deactivatedAt: null },
    });
  });
});

describe('createMockUser', () => {
  it('inserts with provided companyId', async () => {
    prismaMock.user.create.mockResolvedValueOnce(dbUser);
    await createMockUser({
      email: 'new@example.com',
      name: '新人',
      companyId: 'co_default',
      role: 'general',
      managerId: 'u_approver',
      employmentType: 'monthly',
      hiredAt: new Date('2026-04-01'),
      baseSalary: 280000,
    });
    const arg = prismaMock.user.create.mock.calls[0][0];
    expect(arg.data.companyId).toBe('co_default');
  });
});

describe('updateMockUser', () => {
  it('returns updated user on success', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce(dbUser);
    prismaMock.user.update.mockResolvedValueOnce({ ...dbUser, name: '改名' });
    const u = await updateMockUser('co_default', 'u_general', { name: '改名' });
    expect(u?.name).toBe('改名');
  });

  it('returns null when target not in company', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce(null);
    expect(
      await updateMockUser('co_default', 'u_missing', { name: 'x' }),
    ).toBeNull();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('rethrows non-P2025 errors (no silent swallow)', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce(dbUser);
    prismaMock.user.update.mockRejectedValueOnce(new Error('connection lost'));
    await expect(
      updateMockUser('co_default', 'u_general', { name: 'x' }),
    ).rejects.toThrow(/connection lost/);
  });
});

describe('setUserDeactivation', () => {
  it('returns null when target not in company', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce(null);
    expect(
      await setUserDeactivation('co_default', 'u_missing', new Date()),
    ).toBeNull();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('rethrows other errors', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce(dbUser);
    prismaMock.user.update.mockRejectedValueOnce(new Error('db down'));
    await expect(
      setUserDeactivation('co_default', 'u_general', new Date()),
    ).rejects.toThrow(/db down/);
  });
});

describe('isEmailTaken', () => {
  it('false when no user with that email', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    expect(await isEmailTaken('new@example.com')).toBe(false);
  });

  it('true when email exists and exceptId not provided', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(dbUser);
    expect(await isEmailTaken('general@example.com')).toBe(true);
  });

  it('false when matched user is the exceptId (self update)', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(dbUser);
    expect(
      await isEmailTaken('general@example.com', 'u_general'),
    ).toBe(false);
  });

  it('true when email exists on a different user (taken by someone else)', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(dbUser);
    expect(await isEmailTaken('general@example.com', 'u_other')).toBe(true);
  });
});
