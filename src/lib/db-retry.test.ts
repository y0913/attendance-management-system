// withRetry / isRetryableDbError の挙動検証。
// db-retry.ts は Prisma client を初期化しないので DATABASE_URL なしで import できる。

import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

import { isRetryableDbError, withRetry } from './db-retry';

const mkP2034 = () =>
  new Prisma.PrismaClientKnownRequestError('deadlock detected', {
    code: 'P2034',
    clientVersion: 'x',
  });

const mkP2025 = () =>
  new Prisma.PrismaClientKnownRequestError('record not found', {
    code: 'P2025',
    clientVersion: 'x',
  });

const mkPgError = (code: string) => Object.assign(new Error('pg error'), { code });

describe('isRetryableDbError', () => {
  it('Prisma P2034 を retryable と判定する', () => {
    expect(isRetryableDbError(mkP2034())).toBe(true);
  });

  it('SQLSTATE 40001 / 40P01 を retryable と判定する', () => {
    expect(isRetryableDbError(mkPgError('40001'))).toBe(true);
    expect(isRetryableDbError(mkPgError('40P01'))).toBe(true);
  });

  it('それ以外の Prisma error / 一般エラーは retryable でない', () => {
    expect(isRetryableDbError(mkP2025())).toBe(false);
    expect(isRetryableDbError(new Error('boom'))).toBe(false);
    expect(isRetryableDbError(null)).toBe(false);
    expect(isRetryableDbError(mkPgError('23505'))).toBe(false);
  });
});

describe('withRetry', () => {
  it('成功時はそのまま値を返し、再試行しない', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(withRetry(fn, { sleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retryable エラーは指数バックオフで再試行し、最終的に成功すれば値を返す', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(mkP2034())
      .mockRejectedValueOnce(mkPgError('40001'))
      .mockResolvedValue('done');
    const sleep = vi.fn().mockResolvedValue(undefined);
    const onRetry = vi.fn();

    await expect(
      withRetry(fn, { baseMs: 10, sleep, onRetry }),
    ).resolves.toBe('done');

    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 10); // 2^0 * 10
    expect(sleep).toHaveBeenNthCalledWith(2, 20); // 2^1 * 10
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('retryable でないエラーは即時 throw して再試行しない', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(withRetry(fn, { sleep })).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('max 回まで再試行しても retryable なら最後のエラーを throw する', async () => {
    const lastError = mkPgError('40P01');
    const fn = vi
      .fn()
      .mockRejectedValueOnce(mkP2034())
      .mockRejectedValueOnce(mkPgError('40001'))
      .mockRejectedValueOnce(lastError);
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(withRetry(fn, { max: 3, baseMs: 1, sleep })).rejects.toBe(
      lastError,
    );
    expect(fn).toHaveBeenCalledTimes(3);
    // 最終 attempt の前に 2 回 sleep する (再試行は max-1 回)。
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('途中で retryable でないエラーに切り替わったらそこで止める', async () => {
    const terminal = new Error('not retryable');
    const fn = vi
      .fn()
      .mockRejectedValueOnce(mkP2034())
      .mockRejectedValueOnce(terminal);
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(withRetry(fn, { sleep })).rejects.toBe(terminal);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('isRetryable を差し替えれば任意の判定にできる', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('flaky'))
      .mockResolvedValue('ok');
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      withRetry(fn, {
        sleep,
        baseMs: 1,
        isRetryable: (e) => e instanceof Error && e.message === 'flaky',
      }),
    ).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
