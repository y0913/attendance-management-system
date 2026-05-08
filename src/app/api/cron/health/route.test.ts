// /api/cron/health の認可・成功・失敗パスを検証。
// prisma と Sentry を mock して、実 DB 接続なしで挙動を確認する。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, captureExceptionMock } = vi.hoisted(() => ({
  prismaMock: {
    company: {
      count: vi.fn(),
    },
  },
  captureExceptionMock: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

vi.mock('@/lib/sentry', () => ({
  captureException: captureExceptionMock,
}));

import { GET } from './route';

const ORIGINAL_SECRET = process.env.CRON_SECRET;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL_SECRET;
});

const mkReq = (auth?: string) =>
  new Request('http://localhost/api/cron/health', {
    headers: auth ? { authorization: auth } : {},
  });

describe('GET /api/cron/health', () => {
  it('returns 503 if CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(mkReq('Bearer anything'));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it('returns 401 when Bearer header is missing or wrong', async () => {
    process.env.CRON_SECRET = 'sekret';
    const r1 = await GET(mkReq());
    expect(r1.status).toBe(401);
    const r2 = await GET(mkReq('Bearer wrong'));
    expect(r2.status).toBe(401);
    expect(prismaMock.company.count).not.toHaveBeenCalled();
  });

  it('returns 200 with companyCount on success', async () => {
    process.env.CRON_SECRET = 'sekret';
    prismaMock.company.count.mockResolvedValue(3);
    const res = await GET(mkReq('Bearer sekret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.companyCount).toBe(3);
    expect(typeof body.elapsedMs).toBe('number');
    expect(typeof body.ts).toBe('string');
  });

  it('returns 500 and captures exception on DB failure', async () => {
    process.env.CRON_SECRET = 'sekret';
    const dbErr = new Error('db down');
    prismaMock.company.count.mockRejectedValue(dbErr);
    const res = await GET(mkReq('Bearer sekret'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(captureExceptionMock).toHaveBeenCalledWith(dbErr, {
      action: 'cronHealth',
    });
  });
});
