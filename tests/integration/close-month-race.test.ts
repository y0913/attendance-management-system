// closeMonth の race handling を実 DB で検証。
// mock では出てこない振る舞い (実際の P2002 unique 違反 + tx 内 rollback) を確認する。

import { describe, expect, it } from 'vitest';
import { closeMonth, findClosing } from '@/lib/data/attendance-closings';
import { prisma } from '@/lib/db';
import { seedCompany, seedUser } from './helpers';

describe('closeMonth (integration / race handling)', () => {
  it('sequential: first call succeeds, second call returns null', async () => {
    await seedCompany();
    const user = await seedUser({ id: 'u_general', role: 'general' });
    const admin = await seedUser({
      id: 'u_admin',
      role: 'admin',
      email: 'admin@example.com',
    });

    const first = await closeMonth(user.id, '2026-04', admin.id);
    expect(first).not.toBeNull();
    expect(first?.userId).toBe(user.id);
    expect(first?.yearMonth).toBe('2026-04');

    const second = await closeMonth(user.id, '2026-04', admin.id);
    expect(second).toBeNull(); // P2002 → null

    // DB 上は 1 件のみ
    const closings = await prisma.attendanceClosing.findMany({
      where: { userId: user.id, yearMonth: '2026-04' },
    });
    expect(closings).toHaveLength(1);
  });

  it('concurrent: only one of N parallel closeMonth calls succeeds', async () => {
    await seedCompany();
    const user = await seedUser({ id: 'u_general', role: 'general' });
    const admin = await seedUser({
      id: 'u_admin',
      role: 'admin',
      email: 'admin@example.com',
    });

    // 5 並列で同じ (user, ym) を締めにいく
    const N = 5;
    const results = await Promise.all(
      Array.from({ length: N }, () =>
        closeMonth(user.id, '2026-05', admin.id),
      ),
    );
    const successes = results.filter((r) => r !== null);
    const nulls = results.filter((r) => r === null);
    expect(successes.length).toBe(1);
    expect(nulls.length).toBe(N - 1);

    // DB は 1 件のみ
    const closings = await prisma.attendanceClosing.findMany({
      where: { userId: user.id, yearMonth: '2026-05' },
    });
    expect(closings).toHaveLength(1);
  });

  it('different (user, yearMonth) combinations do not block each other', async () => {
    await seedCompany();
    const u1 = await seedUser({ id: 'u_a', email: 'a@example.com' });
    const u2 = await seedUser({ id: 'u_b', email: 'b@example.com' });
    const admin = await seedUser({
      id: 'u_admin',
      role: 'admin',
      email: 'admin@example.com',
    });

    const [r1, r2, r3] = await Promise.all([
      closeMonth(u1.id, '2026-04', admin.id),
      closeMonth(u2.id, '2026-04', admin.id),
      closeMonth(u1.id, '2026-05', admin.id),
    ]);
    expect(r1).not.toBeNull();
    expect(r2).not.toBeNull();
    expect(r3).not.toBeNull();
  });

  it('findClosing returns the closed record after closeMonth', async () => {
    await seedCompany();
    const user = await seedUser({ id: 'u_general', role: 'general' });
    const admin = await seedUser({
      id: 'u_admin',
      role: 'admin',
      email: 'admin@example.com',
    });

    expect(await findClosing(user.id, '2026-04')).toBeNull();
    await closeMonth(user.id, '2026-04', admin.id);
    const found = await findClosing(user.id, '2026-04');
    expect(found).not.toBeNull();
    expect(found?.closedById).toBe(admin.id);
  });
});
