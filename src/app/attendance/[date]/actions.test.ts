// submitCorrectionAction の認可・バリデーション・TOCTOU 防止（findActive→submit を 1 tx）を検証。
// saveDailyNoteAction も最低限のロジックを確認。

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, usersMock, correctionsMock, notesMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  usersMock: {
    findMockUserById: vi.fn(),
  },
  correctionsMock: {
    findActiveCorrection: vi.fn(),
    submitCorrection: vi.fn(),
    captureCurrentSnapshot: vi.fn(),
  },
  notesMock: {
    upsertDailyNote: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: async <T,>(fn: (tx: unknown) => Promise<T>) => fn({}),
  },
  withTx: async <T,>(_db: unknown, fn: (tx: unknown) => Promise<T>) => fn({}),
}));

vi.mock('@/auth', () => ({ auth: authMock }));

vi.mock('@/lib/data/session', () => ({
  getMockSession: async () => {
    const session = await authMock();
    if (!session?.user?.id) return null;
    return usersMock.findMockUserById(session.user.id);
  },
}));

vi.mock('@/lib/data/users', () => usersMock);

vi.mock('@/lib/data/clock-corrections', () => ({
  REASON_MAX_LENGTH: 500,
  findActiveCorrection: correctionsMock.findActiveCorrection,
  submitCorrection: correctionsMock.submitCorrection,
  captureCurrentSnapshot: correctionsMock.captureCurrentSnapshot,
}));

vi.mock('@/lib/data/daily-notes', () => ({
  DAILY_NOTE_MAX_LENGTH: 2000,
  upsertDailyNote: notesMock.upsertDailyNote,
}));

import { saveDailyNoteAction, submitCorrectionAction } from './actions';
import { generalUser } from '@/test/fixtures';

const general = generalUser;

const validCorrectionInput = {
  jstDate: '2026-04-10',
  reason: '退勤打刻を忘れたため',
  clockIn: '09:00',
  clockOut: '18:00',
  breakStart: '12:00',
  breakEnd: '13:00',
};

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: 'u_general' } });
  usersMock.findMockUserById.mockImplementation(async (id: string) => {
    if (id === 'u_general') return general;
    return null;
  });
  correctionsMock.captureCurrentSnapshot.mockResolvedValue({
    clockIn: null,
    clockOut: null,
    breakStart: null,
    breakEnd: null,
  });
  correctionsMock.findActiveCorrection.mockResolvedValue(null);
});

describe('submitCorrectionAction (auth)', () => {
  it('UNAUTHORIZED if no session', async () => {
    authMock.mockResolvedValueOnce(null);
    const result = await submitCorrectionAction(validCorrectionInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNAUTHORIZED');
  });
});

describe('submitCorrectionAction (validation)', () => {
  it('VALIDATION on bad date format', async () => {
    const result = await submitCorrectionAction({
      ...validCorrectionInput,
      jstDate: '2026/04/10',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });

  it('VALIDATION on empty reason', async () => {
    const result = await submitCorrectionAction({
      ...validCorrectionInput,
      reason: '',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });

  it('VALIDATION on bad time format', async () => {
    const result = await submitCorrectionAction({
      ...validCorrectionInput,
      clockIn: '25:00', // invalid hour
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });

  it('accepts empty time strings (means no clock for that slot)', async () => {
    correctionsMock.submitCorrection.mockResolvedValueOnce({ id: 'ccr_001' });
    const result = await submitCorrectionAction({
      ...validCorrectionInput,
      clockOut: '',
      breakStart: '',
      breakEnd: '',
    });
    expect(result.ok).toBe(true);
    expect(correctionsMock.submitCorrection).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({
          clockIn: '09:00',
          clockOut: null,
          breakStart: null,
          breakEnd: null,
        }),
      }),
      expect.anything(),
    );
  });
});

describe('submitCorrectionAction (TOCTOU / duplicate)', () => {
  it('CONFLICT when active correction already exists for the date', async () => {
    correctionsMock.findActiveCorrection.mockResolvedValueOnce({
      id: 'ccr_existing',
    });
    const result = await submitCorrectionAction(validCorrectionInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CONFLICT');
      expect(
        'message' in result.error ? result.error.message : '',
      ).toMatch(/審査中/);
    }
    expect(correctionsMock.submitCorrection).not.toHaveBeenCalled();
  });

  it('findActive と submit は同じ tx 内で呼ばれる (TOCTOU 防止)', async () => {
    // 同一 tx ブロック内では prisma.$transaction の引数で渡された tx オブジェクトを共有する。
    // mock では空オブジェクト {} だが、両関数に同じ参照が渡ることを確認。
    let capturedFindTx: unknown = null;
    let capturedSubmitTx: unknown = null;
    correctionsMock.findActiveCorrection.mockImplementationOnce(
      async (_uid, _date, tx) => {
        capturedFindTx = tx;
        return null;
      },
    );
    correctionsMock.submitCorrection.mockImplementationOnce(
      async (_input, tx) => {
        capturedSubmitTx = tx;
        return { id: 'ccr_001' };
      },
    );
    await submitCorrectionAction(validCorrectionInput);
    expect(capturedFindTx).toBe(capturedSubmitTx);
  });
});

describe('submitCorrectionAction (success)', () => {
  it('captures before snapshot and submits', async () => {
    correctionsMock.captureCurrentSnapshot.mockResolvedValueOnce({
      clockIn: '08:55',
      clockOut: null,
      breakStart: null,
      breakEnd: null,
    });
    correctionsMock.submitCorrection.mockResolvedValueOnce({ id: 'ccr_001' });
    const result = await submitCorrectionAction(validCorrectionInput);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe('ccr_001');
    expect(correctionsMock.submitCorrection).toHaveBeenCalledWith(
      expect.objectContaining({
        requesterId: 'u_general',
        targetDate: '2026-04-10',
        before: expect.objectContaining({ clockIn: '08:55' }),
        after: expect.objectContaining({ clockIn: '09:00', clockOut: '18:00' }),
      }),
      expect.anything(),
    );
  });
});

describe('submitCorrectionAction (internal error)', () => {
  it('returns INTERNAL on unexpected throw', async () => {
    correctionsMock.submitCorrection.mockRejectedValueOnce(new Error('boom'));
    const result = await submitCorrectionAction(validCorrectionInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INTERNAL');
  });
});

describe('saveDailyNoteAction', () => {
  it('UNAUTHORIZED if no session', async () => {
    authMock.mockResolvedValueOnce(null);
    const result = await saveDailyNoteAction({
      jstDate: '2026-04-10',
      content: 'メモ',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNAUTHORIZED');
  });

  it('VALIDATION on bad date format', async () => {
    const result = await saveDailyNoteAction({
      jstDate: '2026/04/10',
      content: 'メモ',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });

  it('upserts daily note and returns ok', async () => {
    notesMock.upsertDailyNote.mockResolvedValueOnce({});
    const result = await saveDailyNoteAction({
      jstDate: '2026-04-10',
      content: '会議対応',
    });
    expect(result.ok).toBe(true);
    expect(notesMock.upsertDailyNote).toHaveBeenCalledWith(
      'u_general',
      '2026-04-10',
      '会議対応',
    );
  });
});
