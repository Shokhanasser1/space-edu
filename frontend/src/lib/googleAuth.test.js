/**
 * Audit, 21 Oct 2026: the Google sign-in answers two flags — the account has no
 * date of birth yet, or its password was taken away when Google linked it — and
 * nothing read either, so the pupil landed on the home page with an unfinished
 * account and no idea. They go to the profile's account panel now.
 */
import { describe, expect, it } from 'vitest';

import { needsAccountSetup } from './googleAuth';

describe('needsAccountSetup', () => {
  it('is true when the profile is not complete', () => {
    expect(needsAccountSetup({ profile_complete: false, password_reset_required: false })).toBe(true);
  });

  it('is true when the password was cleared', () => {
    expect(needsAccountSetup({ profile_complete: true, password_reset_required: true })).toBe(true);
  });

  it('is false for a finished account', () => {
    expect(needsAccountSetup({ profile_complete: true, password_reset_required: false })).toBe(false);
  });

  it('is false for an answer that says nothing either way', () => {
    expect(needsAccountSetup({})).toBe(false);
    expect(needsAccountSetup(undefined)).toBe(false);
  });
});
