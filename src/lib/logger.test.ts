// logActionError が pino logger に { action, userId, err, ...extra } を渡し、
// メッセージが `${action} failed` になることを検証。
// pino 自体の挙動はライブラリ側のテストに任せる。

import { afterEach, describe, expect, it, vi } from 'vitest';

const captureExceptionMock = vi.hoisted(() => vi.fn());
vi.mock('./sentry', () => ({
  captureException: captureExceptionMock,
}));

import { logActionError, logger } from './logger';

describe('logActionError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('action / userId / err を構造化フィールドとして渡し、msg は "<action> failed"', () => {
    const errSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const err = new Error('boom');

    logActionError({ action: 'closeMonthAction', userId: 'u_admin', err });

    expect(errSpy).toHaveBeenCalledWith(
      {
        action: 'closeMonthAction',
        userId: 'u_admin',
        err,
      },
      'closeMonthAction failed',
    );
  });

  it('userId が undefined / null なら出力フィールドからも消える', () => {
    const errSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});

    logActionError({ action: 'foo', userId: null, err: new Error('x') });

    expect(errSpy.mock.calls[0][0]).toMatchObject({
      action: 'foo',
      err: expect.any(Error),
    });
    expect(errSpy.mock.calls[0][0]).not.toHaveProperty('userId', null);
  });

  it('extra のフィールドはトップレベルに展開される', () => {
    const errSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});

    logActionError({
      action: 'decideRequestAction',
      userId: 'u_approver',
      err: new Error('x'),
      extra: { type: 'leave', requestId: 'lv_1' },
    });

    expect(errSpy.mock.calls[0][0]).toMatchObject({
      action: 'decideRequestAction',
      userId: 'u_approver',
      type: 'leave',
      requestId: 'lv_1',
    });
  });

  it('Sentry の captureException も同じ context で呼ばれる', () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    captureExceptionMock.mockClear();
    const err = new Error('boom');

    logActionError({
      action: 'closeMonthAction',
      userId: 'u_admin',
      err,
      extra: { yearMonth: '2026-04' },
    });

    expect(captureExceptionMock).toHaveBeenCalledWith(err, {
      action: 'closeMonthAction',
      userId: 'u_admin',
      extra: { yearMonth: '2026-04' },
    });
  });
});
