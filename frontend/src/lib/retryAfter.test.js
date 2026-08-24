/**
 * Third-pass finding, 24 Aug 2026.
 *
 * The login and registration screens showed `response.data.detail` for every
 * failure. On a rate-limited request that string is DRF's own English —
 * "Request was throttled. Expected available in 3513 seconds." — shown as-is to
 * a Russian or Uzbek child, saying neither what happened nor what to do.
 */
import { describe, expect, it } from 'vitest';

import { retryAfterMinutes } from './retryAfter';

const throttled = (headers) => ({ response: { status: 429, headers } });

describe('retryAfterMinutes', () => {
  it('is null for anything that is not a throttle, so other errors keep their message', () => {
    expect(retryAfterMinutes({ response: { status: 401, headers: {} } })).toBeNull();
    expect(retryAfterMinutes({ response: { status: 400, headers: {} } })).toBeNull();
    expect(retryAfterMinutes(new Error('network down'))).toBeNull();
    expect(retryAfterMinutes(undefined)).toBeNull();
  });

  it('rounds up, because "0 minutes" would read as "try now" and it is not', () => {
    expect(retryAfterMinutes(throttled({ 'retry-after': '61' }))).toBe(2);
    expect(retryAfterMinutes(throttled({ 'retry-after': '3513' }))).toBe(59);
  });

  it('never returns less than a minute', () => {
    expect(retryAfterMinutes(throttled({ 'retry-after': '1' }))).toBe(1);
    expect(retryAfterMinutes(throttled({ 'retry-after': '0' }))).toBe(1);
  });

  it('survives a missing or unusable header rather than showing an empty box', () => {
    expect(retryAfterMinutes(throttled({}))).toBe(1);
    expect(retryAfterMinutes(throttled({ 'retry-after': 'Wed, 21 Oct 2026 07:28:00 GMT' }))).toBe(1);
    expect(retryAfterMinutes({ response: { status: 429 } })).toBe(1);
  });

  it('reads the header whatever case it arrives in', () => {
    expect(retryAfterMinutes(throttled({ 'Retry-After': '120' }))).toBe(2);
  });
});
