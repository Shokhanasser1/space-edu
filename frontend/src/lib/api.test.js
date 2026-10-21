/**
 * Regression tests for the API client.
 *
 * Finding (22 Aug 2026 audit): the backend runs ROTATE_REFRESH_TOKENS with
 * BLACKLIST_AFTER_ROTATION, so a refresh response carries a NEW refresh token
 * and blacklists the one just used. The interceptor read only `data.access` and
 * discarded `data.refresh`, so the second refresh went out with a dead token
 * and every user was forced back to /login roughly an hour after signing in.
 */
import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import api, { setupApiAuth, slowApi } from './api';

vi.mock('axios', async () => {
  const actual = await vi.importActual('axios');
  return { ...actual, default: { ...actual.default, post: vi.fn() } };
});

describe('token refresh', () => {
  let tokens;
  let onLogout;

  beforeEach(() => {
    tokens = { access: 'access-1', refresh: 'refresh-1' };
    onLogout = vi.fn();
    setupApiAuth(
      () => tokens.access,
      () => tokens.refresh,
      onLogout,
      (newAccess, newRefresh) => {
        tokens.access = newAccess;
        if (newRefresh) tokens.refresh = newRefresh;
      },
    );
  });

  function reject401() {
    return Promise.reject({
      response: { status: 401 },
      config: { headers: {}, url: '/auth/me/', method: 'get' },
    });
  }

  /** Stub the transport. The interceptor retries with `api(config)`, which is
   *  the instance called as a function — spying on api.request never sees it. */
  function stubRetry() {
    const adapter = vi.fn().mockResolvedValue({
      data: {}, status: 200, statusText: 'OK', headers: {}, config: {},
    });
    api.defaults.adapter = adapter;
    return adapter;
  }

  async function runInterceptor() {
    const handler = api.interceptors.response.handlers.find(Boolean).rejected;
    const error = await reject401().catch((e) => e);
    return handler(error);
  }

  it('stores the rotated refresh token, not just the access token', async () => {
    axios.post.mockResolvedValueOnce({
      data: { access: 'access-2', refresh: 'refresh-2' },
    });
    stubRetry();

    await runInterceptor();

    expect(tokens.access).toBe('access-2');
    // The old refresh token is blacklisted server-side the moment it is used,
    // so failing to store the new one guarantees a forced logout next time.
    expect(tokens.refresh).toBe('refresh-2');
  });

  it('sends the refresh token it currently holds', async () => {
    axios.post.mockResolvedValueOnce({ data: { access: 'a2', refresh: 'r2' } });
    stubRetry();

    await runInterceptor();

    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/auth/token/refresh/'),
      { refresh: 'refresh-1' },
    );
  });

  it('logs out when the refresh itself is rejected', async () => {
    axios.post.mockRejectedValueOnce(new Error('token blacklisted'));

    await runInterceptor().catch(() => {});

    expect(onLogout).toHaveBeenCalled();
  });

  it('does not try to refresh when there is no refresh token', async () => {
    tokens.refresh = null;

    await runInterceptor().catch(() => {});

    expect(axios.post).not.toHaveBeenCalled();
  });

  /*
   * Audit, 21 Oct 2026. When the access token expired, every request in flight
   * came back 401 at once and each one refreshed on its own, with the same
   * refresh token. The first rotated it and the server blacklisted it; the rest
   * were refused and signed the pupil out — on the first page they opened each
   * morning, with six days of a valid session left.
   */
  function failedWith(access) {
    return {
      response: { status: 401 },
      config: { headers: { Authorization: `Bearer ${access}` }, url: '/x/', method: 'get' },
    };
  }

  function handlerOf(client) {
    return client.interceptors.response.handlers.find(Boolean).rejected;
  }

  it('requests that fail together share one refresh', async () => {
    let finish;
    axios.post.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const retried = stubRetry();

    const both = Promise.all([
      handlerOf(api)(failedWith('access-1')),
      handlerOf(api)(failedWith('access-1')),
    ]);
    finish({ data: { access: 'access-2', refresh: 'refresh-2' } });
    await both;

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(retried).toHaveBeenCalledTimes(2);
    expect(onLogout).not.toHaveBeenCalled();
  });

  it('a 401 that lands after the refresh is retried with the new token, not refreshed again', async () => {
    tokens.access = 'access-2';
    tokens.refresh = 'refresh-2';
    const retried = stubRetry();

    await handlerOf(api)(failedWith('access-1'));

    expect(axios.post).not.toHaveBeenCalled();
    expect(retried.mock.calls[0][0].headers.Authorization).toBe('Bearer access-2');
  });

  it('a refresh lost to another tab uses the pair that tab stored instead of signing out', async () => {
    axios.post.mockImplementationOnce(() => {
      tokens.access = 'access-from-other-tab';
      tokens.refresh = 'refresh-from-other-tab';
      return Promise.reject(new Error('token blacklisted'));
    });
    const retried = stubRetry();

    await handlerOf(api)(failedWith('access-1'));

    expect(onLogout).not.toHaveBeenCalled();
    expect(retried.mock.calls[0][0].headers.Authorization).toBe('Bearer access-from-other-tab');
  });

  it('a retry that is refused again signs out instead of refreshing forever', async () => {
    const error = failedWith('access-2');
    error.config._retried = true;

    await handlerOf(api)(error).catch(() => {});

    expect(axios.post).not.toHaveBeenCalled();
    expect(onLogout).toHaveBeenCalled();
  });

  it('the AI client refreshes too, rather than failing every answer after eight hours', async () => {
    axios.post.mockResolvedValueOnce({ data: { access: 'access-2', refresh: 'refresh-2' } });
    const adapter = vi.fn().mockResolvedValue({
      data: {}, status: 200, statusText: 'OK', headers: {}, config: {},
    });
    slowApi.defaults.adapter = adapter;

    const handler = slowApi.interceptors.response.handlers.find(Boolean)?.rejected;
    expect(handler).toBeTypeOf('function');
    await handler(failedWith('access-1'));

    expect(adapter).toHaveBeenCalledTimes(1);
    expect(tokens.access).toBe('access-2');
  });
});

describe('slowApi', () => {
  it('waits longer than the shared client', () => {
    // The AI endpoint waits up to 20s on Gemini; the shared client gives up at
    // 10s, so every longer answer was discarded in the browser.
    expect(slowApi.defaults.timeout).toBeGreaterThan(api.defaults.timeout);
    expect(slowApi.defaults.timeout).toBeGreaterThanOrEqual(30000);
  });

  it('shares the same base URL', () => {
    expect(slowApi.defaults.baseURL).toBe(api.defaults.baseURL);
  });
});
