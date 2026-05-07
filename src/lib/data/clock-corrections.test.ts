// decideCorrection の副作用（承認時の打刻反映）と認可ロジックを検証。

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, replaceClocksMock } = vi.hoisted(() => ({
  prismaMock: {
    clockCorrectionRequest: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
  replaceClocksMock: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
  withTx: async <T,>(_db: unknown, fn: (tx: unknown) => Promise<T>) =>
    fn(prismaMock),
}));

vi.mock('./time-clocks', () => ({
  replaceClocksForDate: replaceClocksMock,
  listClocksForDate: vi.fn(),
}));

vi.mock('./users', () => ({
  findMockUserById: vi.fn(async () => ({
    id: 'u_general',
    managerId: 'u_approver',
  })),
}));

import { decideCorrection } from './clock-corrections';

const fakeRequest = (overrides: Record<string, unknown> = {}) => ({
  id: 'ccr_test',
  requesterId: 'u_general',
  status: 'submitted',
  currentApproverId: 'u_approver',
  submittedAt: new Date('2026-04-15T00:00:00Z'),
  decidedAt: null,
  reason: '理由',
  targetDate: new Date('2026-04-10T00:00:00+09:00'),
  beforePayload: {
    clockIn: '09:00',
    clockOut: null,
    breakStart: '12:00',
    breakEnd: '13:00',
  },
  afterPayload: {
    clockIn: '09:00',
    clockOut: '20:00',
    breakStart: '12:00',
    breakEnd: '13:00',
  },
  createdAt: new Date('2026-04-15T00:00:00Z'),
  updatedAt: new Date('2026-04-15T00:00:00Z'),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('decideCorrection', () => {
  it('approve triggers replaceClocksForDate with afterPayload', async () => {
    prismaMock.clockCorrectionRequest.findUnique.mockResolvedValueOnce(
      fakeRequest(),
    );
    prismaMock.clockCorrectionRequest.update.mockResolvedValueOnce(
      fakeRequest({ status: 'approved', decidedAt: new Date() }),
    );
    const result = await decideCorrection({
      id: 'ccr_test',
      deciderId: 'u_approver',
      decision: 'approve',
      isAdmin: false,
    });
    expect(result.ok).toBe(true);
    expect(replaceClocksMock).toHaveBeenCalledOnce();
    const args = replaceClocksMock.mock.calls[0];
    expect(args[0]).toBe('u_general');
    expect(args[1]).toBe('2026-04-10');
    expect(args[2]).toEqual({
      clockIn: '09:00',
      clockOut: '20:00',
      breakStart: '12:00',
      breakEnd: '13:00',
    });
  });

  it('reject does NOT trigger replaceClocksForDate', async () => {
    prismaMock.clockCorrectionRequest.findUnique.mockResolvedValueOnce(
      fakeRequest(),
    );
    prismaMock.clockCorrectionRequest.update.mockResolvedValueOnce(
      fakeRequest({ status: 'rejected', decidedAt: new Date() }),
    );
    const result = await decideCorrection({
      id: 'ccr_test',
      deciderId: 'u_approver',
      decision: 'reject',
      isAdmin: false,
    });
    expect(result.ok).toBe(true);
    expect(replaceClocksMock).not.toHaveBeenCalled();
  });

  it('FORBIDDEN if non-admin and approver mismatch', async () => {
    prismaMock.clockCorrectionRequest.findUnique.mockResolvedValueOnce(
      fakeRequest({ currentApproverId: 'u_other' }),
    );
    const result = await decideCorrection({
      id: 'ccr_test',
      deciderId: 'u_approver',
      decision: 'approve',
      isAdmin: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('FORBIDDEN');
    expect(replaceClocksMock).not.toHaveBeenCalled();
    expect(prismaMock.clockCorrectionRequest.update).not.toHaveBeenCalled();
  });

  it('NOT_PENDING if already approved', async () => {
    prismaMock.clockCorrectionRequest.findUnique.mockResolvedValueOnce(
      fakeRequest({ status: 'approved' }),
    );
    const result = await decideCorrection({
      id: 'ccr_test',
      deciderId: 'u_approver',
      decision: 'approve',
      isAdmin: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('NOT_PENDING');
  });

  it('NOT_FOUND if id does not exist', async () => {
    prismaMock.clockCorrectionRequest.findUnique.mockResolvedValueOnce(null);
    const result = await decideCorrection({
      id: 'ccr_missing',
      deciderId: 'u_approver',
      decision: 'approve',
      isAdmin: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('NOT_FOUND');
  });
});
