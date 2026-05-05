import { buildSeedNotes } from './seed-daily-notes';

export interface MockDailyNote {
  userId: string;
  jstDate: string;
  content: string;
  updatedAt: Date;
}

export const DAILY_NOTE_MAX_LENGTH = 2000;

const store = new Map<string, MockDailyNote>();
const key = (userId: string, jstDate: string) => `${userId}__${jstDate}`;

let seeded = false;
function ensureSeeded(): void {
  if (seeded) return;
  seeded = true;
  for (const r of buildSeedNotes()) {
    store.set(key(r.userId, r.jstDate), {
      userId: r.userId,
      jstDate: r.jstDate,
      content: r.content,
      updatedAt: new Date(),
    });
  }
}

export function getDailyNote(
  userId: string,
  jstDate: string,
): MockDailyNote | null {
  ensureSeeded();
  return store.get(key(userId, jstDate)) ?? null;
}

export function getDailyNotesMap(
  userId: string,
  jstDates: string[],
): Map<string, string> {
  ensureSeeded();
  const map = new Map<string, string>();
  for (const date of jstDates) {
    const note = store.get(key(userId, date));
    if (note) map.set(date, note.content);
  }
  return map;
}

export function upsertDailyNote(
  userId: string,
  jstDate: string,
  content: string,
): MockDailyNote {
  ensureSeeded();
  const note: MockDailyNote = {
    userId,
    jstDate,
    content,
    updatedAt: new Date(),
  };
  store.set(key(userId, jstDate), note);
  return note;
}
