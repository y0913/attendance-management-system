// recordAuditLog の Json null 変換と listAuditLogs / countAuditLogs のフィルタを検証。

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
  withTx: async <T,>(_db: unknown, fn: (tx: unknown) => Promise<T>) =>
    fn(prismaMock),
}));

import { countAuditLogs, listAuditLogs, recordAuditLog } from './audit-logs';

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.auditLog.create.mockResolvedValue({
    id: 'al_001',
    entityType: 'company',
    entityId: 'co_default',
    action: 'update',
    actorId: 'u_admin',
    before: null,
    after: { name: 'X' },
    createdAt: new Date(),
  });
});

describe('recordAuditLog', () => {
  it('converts undefined before/after to null Json input', async () => {
    await recordAuditLog({
      entityType: 'company',
      entityId: 'co_default',
      action: 'update',
      actorId: 'u_admin',
    });
    const arg = prismaMock.auditLog.create.mock.calls[0][0];
    expect(arg.data.before).toBeNull();
    expect(arg.data.after).toBeNull();
  });

  it('passes object before/after through', async () => {
    await recordAuditLog({
      entityType: 'company',
      entityId: 'co_default',
      action: 'update',
      actorId: 'u_admin',
      before: { name: 'old' },
      after: { name: 'new' },
    });
    const arg = prismaMock.auditLog.create.mock.calls[0][0];
    expect(arg.data.before).toEqual({ name: 'old' });
    expect(arg.data.after).toEqual({ name: 'new' });
  });
});

describe('listAuditLogs', () => {
  it('applies entityType / actorId filter when provided', async () => {
    prismaMock.auditLog.findMany.mockResolvedValueOnce([]);
    await listAuditLogs({ entityType: 'user', actorId: 'u_admin' });
    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { entityType: 'user', actorId: 'u_admin' },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('omits filters when not provided', async () => {
    prismaMock.auditLog.findMany.mockResolvedValueOnce([]);
    await listAuditLogs();
    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('applies take/skip only when positive', async () => {
    prismaMock.auditLog.findMany.mockResolvedValueOnce([]);
    await listAuditLogs({ limit: 50, offset: 100 });
    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50, skip: 100 }),
    );

    prismaMock.auditLog.findMany.mockClear();
    prismaMock.auditLog.findMany.mockResolvedValueOnce([]);
    await listAuditLogs({ limit: 0, offset: 0 });
    const arg = prismaMock.auditLog.findMany.mock.calls[0][0];
    expect(arg.take).toBeUndefined();
    expect(arg.skip).toBeUndefined();
  });
});

describe('countAuditLogs', () => {
  it('forwards filters to count', async () => {
    prismaMock.auditLog.count.mockResolvedValueOnce(42);
    const n = await countAuditLogs({ entityType: 'work_rule_version' });
    expect(n).toBe(42);
    expect(prismaMock.auditLog.count).toHaveBeenCalledWith({
      where: { entityType: 'work_rule_version' },
    });
  });
});
