// closeMonth の race-handling (P2002 → null) と deleteClosing (P2025 → null) を中心に
// findClosing / getEffectiveMonthlySummary の振る舞いを検証。
// summarizeMonth / listLeaveRequests は外部依存なので mock で固定値を返す。

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const { prismaMock, summaryMock, leaveMock } = vi.hoisted(() => ({
  prismaMock: {
    attendanceClosing: {
      create: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
  summaryMock: {
    summarizeMonth: vi.fn(),
    totalWorkMinutes: vi.fn(),
  },
  leaveMock: {
    listLeaveRequests: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
  withTx: async <T,>(_db: unknown, fn: (tx: unknown) => Promise<T>) =>
    fn(prismaMock),
}));

vi.mock('./attendance-summary', () => summaryMock);
vi.mock('./leave-requests', () => leaveMock);

import {
  closeMonth,
  deleteClosing,
  findClosing,
  getEffectiveMonthlySummary,
} from './attendance-closings';

const mkP2002 = () =>
  new Prisma.PrismaClientKnownRequestError('unique violation', {
    code: 'P2002',
    clientVersion: 'x',
  });
const mkP2025 = () =>
  new Prisma.PrismaClientKnownRequestError('not found', {
    code: 'P2025',
    clientVersion: 'x',
  });

const dbClosing = {
  id: 'ac_001',
  companyId: 'co_default',
  userId: 'u_general',
  yearMonth: '2026-04',
  closedAt: new Date('2026-05-01T00:00:00Z'),
  closedById: 'u_admin',
  snapshot: { yearMonth: '2026-04', daily: [] },
};

beforeEach(() => {
  vi.clearAllMocks();
  summaryMock.summarizeMonth.mockResolvedValue([]);
  summaryMock.totalWorkMinutes.mockReturnValue(0);
  leaveMock.listLeaveRequests.mockResolvedValue([]);
});

describe('findClosing', () => {
  it('returns null when not found', async () => {
    prismaMock.attendanceClosing.findUnique.mockResolvedValueOnce(null);
    expect(await findClosing('u_general', '2026-04')).toBeNull();
  });

  it('uses composite unique key', async () => {
    prismaMock.attendanceClosing.findUnique.mockResolvedValueOnce(dbClosing);
    await findClosing('u_general', '2026-04');
    expect(prismaMock.attendanceClosing.findUnique).toHaveBeenCalledWith({
      where: {
        userId_yearMonth: { userId: 'u_general', yearMonth: '2026-04' },
      },
    });
  });
});

describe('closeMonth (race handling)', () => {
  it('returns the created closing on success', async () => {
    prismaMock.attendanceClosing.create.mockResolvedValueOnce(dbClosing);
    const result = await closeMonth('u_general', '2026-04', 'u_admin');
    expect(result?.id).toBe('ac_001');
  });

  it('returns null on P2002 (race: another tx already closed)', async () => {
    prismaMock.attendanceClosing.create.mockRejectedValueOnce(mkP2002());
    const result = await closeMonth('u_general', '2026-04', 'u_admin');
    expect(result).toBeNull();
  });

  it('rethrows non-P2002 errors (real DB failures should bubble)', async () => {
    prismaMock.attendanceClosing.create.mockRejectedValueOnce(
      new Error('connection lost'),
    );
    await expect(
      closeMonth('u_general', '2026-04', 'u_admin'),
    ).rejects.toThrow(/connection lost/);
  });

  it('builds snapshot before tx (read-only, no race risk)', async () => {
    prismaMock.attendanceClosing.create.mockResolvedValueOnce(dbClosing);
    await closeMonth('u_general', '2026-04', 'u_admin');
    expect(summaryMock.summarizeMonth).toHaveBeenCalledWith(
      'u_general',
      '2026-04',
    );
    expect(leaveMock.listLeaveRequests).toHaveBeenCalledWith('u_general');
  });

  it('writes snapshot data with companyId pinned', async () => {
    prismaMock.attendanceClosing.create.mockResolvedValueOnce(dbClosing);
    await closeMonth('u_general', '2026-04', 'u_admin');
    const arg = prismaMock.attendanceClosing.create.mock.calls[0][0];
    expect(arg.data.companyId).toBe('co_default');
    expect(arg.data.userId).toBe('u_general');
    expect(arg.data.yearMonth).toBe('2026-04');
  });
});

describe('deleteClosing', () => {
  it('returns null on P2025', async () => {
    prismaMock.attendanceClosing.delete.mockRejectedValueOnce(mkP2025());
    expect(await deleteClosing('ac_missing')).toBeNull();
  });

  it('returns the deleted record on success', async () => {
    prismaMock.attendanceClosing.delete.mockResolvedValueOnce(dbClosing);
    const result = await deleteClosing('ac_001');
    expect(result?.id).toBe('ac_001');
  });

  it('rethrows non-P2025 errors', async () => {
    prismaMock.attendanceClosing.delete.mockRejectedValueOnce(
      new Error('foreign key violation'),
    );
    await expect(deleteClosing('ac_001')).rejects.toThrow(/foreign key/);
  });
});

describe('getEffectiveMonthlySummary', () => {
  it('returns isClosed=true with snapshot when closing exists', async () => {
    prismaMock.attendanceClosing.findUnique.mockResolvedValueOnce({
      ...dbClosing,
      snapshot: {
        yearMonth: '2026-04',
        workedDays: 20,
        totalWorkMinutes: 9600,
        totalBreakMinutes: 1200,
        missingClockOutDays: 0,
        approvedLeaveDays: 1,
        daily: [],
      },
    });
    const summary = await getEffectiveMonthlySummary('u_general', '2026-04');
    expect(summary.isClosed).toBe(true);
    expect(summary.workedDays).toBe(20);
    expect(summary.closedById).toBe('u_admin');
  });

  it('returns isClosed=false and computes snapshot fresh when no closing', async () => {
    prismaMock.attendanceClosing.findUnique.mockResolvedValueOnce(null);
    summaryMock.summarizeMonth.mockResolvedValueOnce([]);
    const summary = await getEffectiveMonthlySummary('u_general', '2026-04');
    expect(summary.isClosed).toBe(false);
    expect(summary.closedAt).toBeNull();
    expect(summary.closedById).toBeNull();
  });
});
