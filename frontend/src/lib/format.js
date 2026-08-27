/**
 * Numbers and dates, written the way the reader's page is written.
 *
 * Every one of these used to be `value.toLocaleString()` with no argument,
 * which formats using the *machine's* locale. Two things followed from that,
 * and both were live:
 *
 *   A page in Russian showed `4,951` to anyone whose computer was set to
 *   English, and `4 951` to anyone whose computer was set to Russian. The site
 *   chooses its language deliberately — there is a switcher, and 1,287 strings
 *   behind it — and then handed the one part nobody translated to whatever the
 *   operating system happened to be.
 *
 *   `ProfileView.test.jsx` asserts `#4,951`. It passes in CI, which runs on a
 *   machine with an English locale, and fails on every laptop in this team.
 *   A test whose result depends on where it runs teaches people to ignore it.
 *
 * Four call sites had already worked this out and written
 * `language === 'UZB' ? 'uz-UZ' : language === 'RUS' ? 'ru-RU' : 'en-US'`
 * inline, four times over. That mapping lives here now, once.
 */

/** The site's three languages, as tags Intl understands. */
const LOCALE_TAG = {
  ENG: 'en-US',
  UZB: 'uz-UZ',
  RUS: 'ru-RU',
};

export function localeTag(language) {
  return LOCALE_TAG[language] || LOCALE_TAG.ENG;
}

/** 4951 -> "4,951" in English, "4 951" in Russian and Uzbek. */
export function formatNumber(value, language) {
  // null, undefined and '' are "nothing was sent", and `Number()` turns all
  // three into 0 — which would put a confident "0 XP" on the screen where the
  // truth is that we do not know. A caller who means zero passes zero.
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString(localeTag(language));
}

/**
 * A sum of money, always grouped with spaces.
 *
 * Prices here are in so'm, and a so'm price is written `1 200 000` whatever
 * language surrounds it — so this one is deliberately *not* language-dependent.
 * Russian grouping is used for its shape and its separator is then normalised,
 * because Intl gives a non-breaking space that is invisible in a diff and
 * different in a test.
 */
export function formatMoney(value) {
  // Escapes rather than the characters themselves: an invisible space in
  // source is unreadable in a diff, and eslint refuses it (no-irregular-whitespace).
  return formatNumber(value, 'RUS').replace(/[\u00a0\u202f]/g, ' ');
}

/** A date, in the reader's language. `options` is passed to Intl unchanged. */
export function formatDate(value, language, options = { year: 'numeric', month: 'long', day: 'numeric' }) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(localeTag(language), options);
}

/** A clock time, hours and minutes, in the reader's language. */
export function formatTime(value, language, options = { hour: '2-digit', minute: '2-digit' }) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(localeTag(language), options);
}

/** A date and a time together — what a moderator's "suspended until" needs. */
export function formatDateTime(value, language) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(localeTag(language), {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
