// upsertDailyNote の upsert クエリ形と getDailyNote/getDailyNotesMap のマッピングを検証。

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    dailyNote: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
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
  getDailyNote,
  getDailyNotesMap,
  upsertDailyNote,
} from './daily-notes';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('upsertDailyNote', () => {
  it('issues upsert with composite unique key', async () => {
    prismaMock.dailyNote.upsert.mockResolvedValueOnce({
      userId: 'u_general',
      jstDate: '2026-04-10',
      content: 'メモ',
      updatedAt: new Date(),
    });
    await upsertDailyNote('u_general', '2026-04-10', 'メモ');
    expect(prismaMock.dailyNote.upsert).toHaveBeenCalledWith({
      where: { userId_jstDate: { userId: 'u_general', jstDate: '2026-04-10' } },
      create: { userId: 'u_general', jstDate: '2026-04-10', content: 'メモ' },
      update: { content: 'メモ' },
    });
  });
});

describe('getDailyNote', () => {
  it('returns null when not found', async () => {
    prismaMock.dailyNote.findUnique.mockResolvedValueOnce(null);
    const result = await getDailyNote('u_general', '2026-04-10');
    expect(result).toBeNull();
  });

  it('maps Prisma row to MockDailyNote', async () => {
    prismaMock.dailyNote.findUnique.mockResolvedValueOnce({
      userId: 'u_general',
      jstDate: '2026-04-10',
      content: '会議',
      updatedAt: new Date('2026-04-10T10:00:00Z'),
    });
    const result = await getDailyNote('u_general', '2026-04-10');
    expect(result).toEqual({
      userId: 'u_general',
      jstDate: '2026-04-10',
      content: '会議',
      updatedAt: expect.any(Date),
    });
  });
});

describe('getDailyNotesMap', () => {
  it('returns empty map when input is empty (no DB hit)', async () => {
    const result = await getDailyNotesMap('u_general', []);
    expect(result.size).toBe(0);
    expect(prismaMock.dailyNote.findMany).not.toHaveBeenCalled();
  });

  it('maps date → content for found rows only', async () => {
    prismaMock.dailyNote.findMany.mockResolvedValueOnce([
      { userId: 'u_general', jstDate: '2026-04-10', content: '会議', updatedAt: new Date() },
      { userId: 'u_general', jstDate: '2026-04-12', content: '出張', updatedAt: new Date() },
    ]);
    const result = await getDailyNotesMap('u_general', [
      '2026-04-10',
      '2026-04-11',
      '2026-04-12',
    ]);
    expect(result.size).toBe(2);
    expect(result.get('2026-04-10')).toBe('会議');
    expect(result.get('2026-04-12')).toBe('出張');
    expect(result.has('2026-04-11')).toBe(false);
  });
});
