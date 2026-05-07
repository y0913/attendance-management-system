// recordApprovalAction の正規化（'correction' → 'clock_correction' 等）と
// listApprovalActions のフィルタを検証。

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    approvalAction: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
  withTx: async <T,>(_db: unknown, fn: (tx: unknown) => Promise<T>) =>
    fn(prismaMock),
}));

import {
  listApprovalActions,
  recordApprovalAction,
} from './approval-actions';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('recordApprovalAction', () => {
  it('maps "correction" → Prisma "clock_correction"', async () => {
    prismaMock.approvalAction.create.mockResolvedValueOnce({
      id: 'aa_001',
      requestType: 'clock_correction',
      requestId: 'ccr_001',
      actorId: 'u_admin',
      action: 'approve',
      comment: 'OK',
      createdAt: new Date(),
    });
    await recordApprovalAction({
      requestType: 'correction',
      requestId: 'ccr_001',
      actorId: 'u_admin',
      action: 'approve',
      comment: 'OK',
    });
    expect(prismaMock.approvalAction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requestType: 'clock_correction',
        requestId: 'ccr_001',
      }),
    });
  });

  it('maps "leave" → Prisma "leave_request"', async () => {
    prismaMock.approvalAction.create.mockResolvedValueOnce({
      id: 'aa_002',
      requestType: 'leave_request',
      requestId: 'lr_001',
      actorId: 'u_admin',
      action: 'approve',
      comment: null,
      createdAt: new Date(),
    });
    await recordApprovalAction({
      requestType: 'leave',
      requestId: 'lr_001',
      actorId: 'u_admin',
      action: 'approve',
    });
    expect(prismaMock.approvalAction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ requestType: 'leave_request' }),
    });
  });

  it('comment defaults to null when undefined', async () => {
    prismaMock.approvalAction.create.mockResolvedValueOnce({
      id: 'aa_003',
      requestType: 'clock_correction',
      requestId: 'ccr_001',
      actorId: 'u_admin',
      action: 'submit',
      comment: null,
      createdAt: new Date(),
    });
    await recordApprovalAction({
      requestType: 'correction',
      requestId: 'ccr_001',
      actorId: 'u_admin',
      action: 'submit',
    });
    expect(prismaMock.approvalAction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ comment: null }),
    });
  });
});

describe('listApprovalActions', () => {
  it('filters by request type and id, ordered by createdAt asc', async () => {
    prismaMock.approvalAction.findMany.mockResolvedValueOnce([]);
    await listApprovalActions('leave', 'lr_001');
    expect(prismaMock.approvalAction.findMany).toHaveBeenCalledWith({
      where: { requestType: 'leave_request', requestId: 'lr_001' },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('maps Prisma "clock_correction" → app "correction" in returned objects', async () => {
    prismaMock.approvalAction.findMany.mockResolvedValueOnce([
      {
        id: 'aa_001',
        requestType: 'clock_correction',
        requestId: 'ccr_001',
        actorId: 'u_admin',
        action: 'approve',
        comment: null,
        createdAt: new Date('2026-04-15T10:00:00Z'),
      },
    ]);
    const list = await listApprovalActions('correction', 'ccr_001');
    expect(list).toHaveLength(1);
    expect(list[0].requestType).toBe('correction');
  });
});
