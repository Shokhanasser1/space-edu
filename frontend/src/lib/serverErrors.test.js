/**
 * Found in a browser on 28 August 2026: every sentence the accounts API
 * answers with is English, and three of them were on screen in the middle of
 * Russian pages — "Invalid credentials.", "This email is already registered.",
 * "That code is wrong or has expired." Neither suite could see it: the
 * frontend tests mock the API and the backend tests never render a page.
 *
 * So the table in serverErrors.js is tested against the real sentences, in
 * two languages, and the rule that an unknown sentence never reaches the
 * screen is tested too.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { translations } from '@/i18n/translations';
import { serverDetail, serverFieldErrors, translateServerMessage } from './serverErrors';

function tFor(language) {
  return (section, key) => {
    const value = key.split('.').reduce((acc, part) => acc && acc[part], translations[language][section]);
    return value === undefined ? `${section}.${key}` : value;
  };
}

const tRu = tFor('RUS');
const tEn = tFor('ENG');
const tUz = tFor('UZB');

function rejection(status, data) {
  return { response: { status, headers: {}, data } };
}

describe('the sentences the accounts API actually sends', () => {
  it.each([
    ['Invalid credentials.', /пароль/i],
    ['This email is already registered.', /уже зарегистрирован/i],
    ['That code is wrong or has expired.', /код/i],
    ['Date of birth must be in the past.', /дата рождения/i],
    ['This password is too common.', /пароль/i],
    ['This password is too short. It must contain at least 8 characters.', /8/],
    ['The password is too similar to the email address.', /похож/i],
    ['Enter a valid email address.', /почт/i],
    ['This field is required.', /поле/i],
  ])('"%s" is said in Russian', (sentence, expected) => {
    const said = translateServerMessage(tRu, sentence);
    expect(said).toMatch(expected);
    expect(said).not.toMatch(/[a-z]{3,}/i);
  });

  it('are said in Uzbek too, with no English left in them', () => {
    for (const sentence of [
      'Invalid credentials.', 'This email is already registered.',
      'That code is wrong or has expired.', 'This password is too common.',
    ]) {
      const said = translateServerMessage(tUz, sentence);
      expect(said).toBeTruthy();
      expect(said).not.toMatch(/\b(the|is|password|email|code)\b/i);
    }
  });

  it('never answers with a missing-key marker', () => {
    // A key listed in the table but absent from a locale file would leak
    // "serverErrors.something" onto the screen. Parity is checked in CI; this
    // checks the table's side of the contract.
    for (const t of [tEn, tRu, tUz]) {
      for (const sentence of [
        'Invalid credentials.', 'Email and password are required.',
        'That code is wrong or has expired.', 'Code must be 6 digits.',
        'Email and code are required.', 'Valid email is required.',
        'This address is already confirmed.', 'This account has no e-mail address to confirm.',
        'No address change was asked for.', 'That address was taken while you were confirming it.',
        'No sign-in was received from Google.', 'That Google sign-in could not be verified.',
        'Signing in with Google is not set up on this server.',
        'This email is already registered.', 'Date of birth must be in the past.',
        'Passwords do not match.', 'This password is too common.',
        'This password is entirely numeric.', 'Enter a valid email address.',
        'This field is required.', 'This field may not be blank.', 'This field may not be null.',
        'This password is too short. It must contain at least 8 characters.',
        'Ensure this field has at least 8 characters.',
        'The password is too similar to the first name.', 'Date has wrong format. Use one of these formats instead: YYYY-MM-DD.',
      ]) {
        expect(translateServerMessage(t, sentence)).not.toMatch(/^\w+\.\w+$/);
      }
    }
  });

  it('does not pretend to know a sentence it does not', () => {
    expect(translateServerMessage(tRu, 'Something new the server started saying.')).toBeNull();
    expect(translateServerMessage(tRu, undefined)).toBeNull();
    expect(translateServerMessage(tRu, { detail: 'nested' })).toBeNull();
  });
});

describe('serverDetail', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('turns a known detail into the reader\'s language', () => {
    const said = serverDetail(tRu, rejection(401, { detail: 'Invalid credentials.' }), 'fallback');
    expect(said).toMatch(/пароль/i);
    expect(said).not.toBe('fallback');
  });

  it('keeps an unknown English sentence off the screen', () => {
    const said = serverDetail(tRu, rejection(400, { detail: 'A brand new sentence.' }), 'fallback');
    expect(said).toBe('fallback');
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/serverErrors/), 'A brand new sentence.');
  });

  it('lets a machine-readable code win over the wording', () => {
    const said = serverDetail(
      tRu,
      rejection(400, { detail: 'This account has no password yet. Ask for a code at ...', code: 'no_password_set' }),
      'fallback',
    );
    expect(said).not.toBe('fallback');
    expect(said).not.toMatch(/[a-z]{3,}/i);
  });

  it('reads non_field_errors the way DRF sends them', () => {
    const said = serverDetail(tEn, rejection(400, { non_field_errors: ['Passwords do not match.'] }), 'fallback');
    expect(said).toMatch(/not the same/i);
  });

  it('answers the fallback when there is no body at all', () => {
    expect(serverDetail(tRu, new Error('Network Error'), 'fallback')).toBe('fallback');
    expect(serverDetail(tRu, rejection(500, '<html>debug page</html>'), 'fallback')).toBe('fallback');
  });
});

describe('serverFieldErrors', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('translates each field it knows and ignores fields not asked for', () => {
    const got = serverFieldErrors(
      tRu,
      rejection(400, {
        email: ['This email is already registered.'],
        password: ['This password is too common.'],
        detail: 'ignored here',
      }),
      ['email', 'password', 'password2'],
    );
    expect(Object.keys(got).sort()).toEqual(['email', 'password']);
    expect(got.email).toMatch(/уже зарегистрирован/i);
    expect(got.password).not.toMatch(/[a-z]{3,}/i);
  });

  it('shows an unknown field sentence as sent, and says so in the console', () => {
    const got = serverFieldErrors(tRu, rejection(400, { email: ['Domain is on the block list.'] }), ['email']);
    expect(got.email).toBe('Domain is on the block list.');
    expect(console.warn).toHaveBeenCalled();
  });
});
