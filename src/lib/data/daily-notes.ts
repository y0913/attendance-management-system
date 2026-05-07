// Phase 3: 内部を Prisma 経由に書き換え。すべて async。

import type { DailyNote } from '@prisma/client';
import { prisma, type DbClient } from '@/lib/db';

export interface MockDailyNote {
  userId: string;
  jstDate: string;
  content: string;
  updatedAt: Date;
}

export const DAILY_NOTE_MAX_LENGTH = 2000;

const toMockDailyNote = (n: DailyNote): MockDailyNote => ({
  userId: n.userId,
  jstDate: n.jstDate,
  content: n.content,
  updatedAt: n.updatedAt,
});

export async function getDailyNote(
  userId: string,
  jstDate: string,
): Promise<MockDailyNote | null> {
  const n = await prisma.dailyNote.findUnique({
    where: { userId_jstDate: { userId, jstDate } },
  });
  return n ? toMockDailyNote(n) : null;
}

export async function getDailyNotesMap(
  userId: string,
  jstDates: string[],
): Promise<Map<string, string>> {
  if (jstDates.length === 0) return new Map();
  const notes = await prisma.dailyNote.findMany({
    where: { userId, jstDate: { in: jstDates } },
  });
  const map = new Map<string, string>();
  for (const n of notes) {
    map.set(n.jstDate, n.content);
  }
  return map;
}

export async function upsertDailyNote(
  userId: string,
  jstDate: string,
  content: string,
  db: DbClient = prisma,
): Promise<MockDailyNote> {
  const note = await db.dailyNote.upsert({
    where: { userId_jstDate: { userId, jstDate } },
    create: { userId, jstDate, content },
    update: { content },
  });
  return toMockDailyNote(note);
}
