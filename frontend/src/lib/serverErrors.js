/**
 * What the server said, in the reader's language.
 *
 * The API answers in English and only in English: there is no
 * LocaleMiddleware, none of the nineteen `detail` strings in
 * `apps/accounts/views.py` go through gettext, and the browser sends no
 * `Accept-Language` the site controls. So on 28 August 2026 a Russian child
 * who typed a wrong password read "Invalid credentials.", one who reused an
 * address read "This email is already registered.", and one who mistyped a
 * code read "That code is wrong or has expired." — on screens where every
 * other word was Russian. Found by opening the page; both test suites mock the
 * other half and never saw it.
 *
 * Every sentence the accounts API can emit is listed here against the key
 * that says it in the reader's language. An English sentence that is not
 * listed is *not* shown: it goes to the console, and the reader gets the
 * caller's fallback — a translated "that did not work" beats a sentence they
 * cannot read. Field errors are the one exception (see `serverFieldErrors`),
 * because a raw sentence against the field it is about is still more useful
 * than nothing, and the list below covers everything the server sends today.
 *
 * Kept as a table rather than fixed on the server because the server's own
 * messages are not the only ones: Django's password validators and DRF's
 * field validators write their own, and DRF ships no Uzbek translation at all.
 */

// Exact sentences, from apps/accounts, Django's password validators and DRF's
// field validators. The value is [section, key] in the locale files.
const EXACT = new Map([
  // apps/accounts/views.py
  ['Invalid credentials.', ['loginPage', 'invalidCreds']],
  ['Email and password are required.', ['loginPage', 'fillAll']],
  ['That code is wrong or has expired.', ['serverErrors', 'codeInvalid']],
  ['Code must be 6 digits.', ['serverErrors', 'codeFormat']],
  ['Email and code are required.', ['serverErrors', 'emailAndCodeRequired']],
  ['Valid email is required.', ['registerPage', 'invalidEmail']],
  ['This address is already confirmed.', ['serverErrors', 'alreadyConfirmed']],
  ['This account has no e-mail address to confirm.', ['serverErrors', 'noEmailToConfirm']],
  ['No address change was asked for.', ['serverErrors', 'noEmailChange']],
  ['That address was taken while you were confirming it.', ['serverErrors', 'emailTaken']],
  ['No sign-in was received from Google.', ['loginPage', 'googleFailed']],
  ['That Google sign-in could not be verified.', ['loginPage', 'googleFailed']],
  ['Signing in with Google is not set up on this server.', ['loginPage', 'googleUnavailable']],
  // apps/accounts/serializers.py
  ['This email is already registered.', ['serverErrors', 'emailTaken']],
  ['Date of birth must be in the past.', ['registerPage', 'dobFuture']],
  ['Passwords do not match.', ['registerPage', 'passwordsDoNotMatch']],
  // django.contrib.auth.password_validation
  ['This password is too common.', ['serverErrors', 'passwordCommon']],
  ['This password is entirely numeric.', ['registerPage', 'allDigits']],
  // rest_framework fields
  ['Enter a valid email address.', ['registerPage', 'invalidEmail']],
  ['This field is required.', ['registerPage', 'required']],
  ['This field may not be blank.', ['registerPage', 'required']],
  ['This field may not be null.', ['registerPage', 'required']],
]);

// Sentences that carry a number or a name and so cannot be matched whole.
const PATTERNS = [
  [/^This password is too short\./, ['registerPage', 'tooShort']],
  [/^Ensure this field has at least \d+ characters\./, ['registerPage', 'tooShort']],
  [/^The password is too similar to the /, ['serverErrors', 'passwordSimilar']],
  [/^Date has wrong format\./, ['registerPage', 'dobInvalid']],
];

// Machine-readable `code` fields some responses carry alongside `detail`.
// A code wins over the sentence: it is the one thing the server promises not
// to reword.
const CODES = {
  no_password_set: ['serverErrors', 'noPasswordSet'],
  google_unconfigured: ['loginPage', 'googleUnavailable'],
  google_email_unverified: ['loginPage', 'googleEmailUnverified'],
};

const firstOf = (value) => (Array.isArray(value) ? value[0] : value);

/**
 * The reader's-language version of one server sentence, or `null` when the
 * sentence is not one we know.
 */
export function translateServerMessage(t, message) {
  if (typeof message !== 'string') return null;
  const text = message.trim();
  const exact = EXACT.get(text);
  if (exact) return t(exact[0], exact[1]);
  const pattern = PATTERNS.find(([re]) => re.test(text));
  return pattern ? t(pattern[1][0], pattern[1][1]) : null;
}

/**
 * The one line to show for a failed request: the translated `code` or
 * `detail` when we know it, else `fallback`. The English sentence never
 * reaches the screen; it goes to the console so the mismatch is findable.
 *
 * Rate limits are not handled here — `retryAfterMinutes` is, and callers
 * check it first, because a 429 is a wait and not a mistake.
 */
export function serverDetail(t, err, fallback) {
  const data = err?.response?.data;
  if (!data || typeof data !== 'object') return fallback;

  const code = CODES[data.code];
  if (code) return t(code[0], code[1]);

  const detail = firstOf(data.detail ?? data.non_field_errors);
  if (detail === undefined || detail === null) return fallback;
  const known = translateServerMessage(t, detail);
  if (known) return known;

  console.warn('Server error not in serverErrors.js, shown as the fallback:', detail);
  return fallback;
}

/**
 * `{ field: sentence }` for the fields in `fields` the server complained
 * about, each in the reader's language where the sentence is known and as
 * sent where it is not. Against a labelled box, an English sentence is still
 * a pointer to what is wrong; the table above is meant to make that path
 * unreachable, and the console says when it was not.
 */
export function serverFieldErrors(t, err, fields) {
  const data = err?.response?.data;
  if (!data || typeof data !== 'object') return {};
  const out = {};
  for (const field of fields) {
    if (!(field in data)) continue;
    const raw = firstOf(data[field]);
    if (typeof raw !== 'string') continue;
    const known = translateServerMessage(t, raw);
    if (!known) console.warn(`Server error for "${field}" not in serverErrors.js:`, raw);
    out[field] = known || raw;
  }
  return out;
}
