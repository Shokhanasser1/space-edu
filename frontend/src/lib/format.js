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

import en from '@/locales/en.json';
import ru from '@/locales/ru.json';
import uz from '@/locales/uz.json';

/** The site's three languages, as tags Intl understands. */
const LOCALE_TAG = {
  ENG: 'en-US',
  UZB: 'uz-UZ',
  RUS: 'ru-RU',
};

export function localeTag(language) {
  return LOCALE_TAG[language] || LOCALE_TAG.ENG;
}

const MONTH_NAMES = { ENG: en.dates, RUS: ru.dates, UZB: uz.dates };

/**
 * The token ICU prints when it has no month names for a locale: `M01`..`M12`.
 *
 * **Chromium has no Uzbek month names.** `toLocaleDateString('uz-UZ', {month:
 * 'long'})` answers `"M08 28"` there, so the News page's own heading read
 * "M08 28" to exactly the readers this site is built for. `Intl.DateTimeFormat
 * .supportedLocalesOf(['uz-UZ'])` still returns `['uz-UZ']`, so nothing warns
 * you; it just quietly falls back to the root locale's numeric month.
 *
 * Node's full-ICU build gets it right, which is why no unit test was ever going
 * to catch this — it was found by opening the page in a browser. Same shape as
 * the sign-out bug: real in the browser, invisible to both suites.
 */
const ICU_FALLBACK_MONTH = /\bM(?:0[1-9]|1[0-2])\b/;

/**
 * Intl's output, or a hand-built one when Intl gave up on the month name.
 *
 * Exported because it is the only honest way to test this: under Node the
 * fallback never fires, so a test that went through `formatDate` would exercise
 * the wrong branch and pass for the wrong reason. Give this the string a
 * browser would have produced and it is deterministic anywhere.
 */
export function repairNamedMonth(text, date, language, options = {}) {
  const names = MONTH_NAMES[language];
  if (!names || !ICU_FALLBACK_MONTH.test(text)) return text;

  const list = options.month === 'short' ? names.monthsShort : names.monthsLong;
  const month = list[date.getMonth()];
  if (!month) return text;

  // Rebuilt rather than patched: the fallback pattern is month-first
  // ("2026 M08 28"), and swapping the token in place would leave an Uzbek
  // reader with "2026 avg 28". Uzbek writes the day joined to the month.
  const head = options.day ? `${date.getDate()}-${month}` : month;
  return options.year ? `${head}, ${date.getFullYear()}` : head;
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
  const text = date.toLocaleDateString(localeTag(language), options);
  return repairNamedMonth(text, date, language, options);
}

/** A clock time, hours and minutes, in the reader's language. */
export function formatTime(value, language, options = { hour: '2-digit', minute: '2-digit' }) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(localeTag(language), options);
}

/**
 * Which plural form a count takes, in the reader's language.
 *
 * Russian needs three: 1 год, 2 года, 5 лет — and "69 лет назад" written as
 * "69 год назад" under an anniversary is the sort of thing a Russian-speaking
 * child reads as broken before they read it as information. `Intl.PluralRules`
 * already knows every language's rules, so nothing here hand-writes the
 * arithmetic: the caller supplies the words and is told which one to use.
 *
 * Returns one of `one`, `few`, `many`, `other`. English and Uzbek only ever
 * produce `one` and `other`, so their locale files repeat one word four times
 * rather than pretending to a distinction they do not make.
 */
export function pluralForm(count, language) {
  // null, undefined and '' are "nothing was sent" — the same reading
  // `formatNumber` above takes of them, and for the same reason. `Number()`
  // turns all three into 0, which in Russian is the `many` form, so without
  // this a missing count would confidently pick a word for a number nobody
  // gave us.
  if (count === null || count === undefined || count === '') return 'other';
  const n = Number(count);
  if (!Number.isFinite(n)) return 'other';
  return new Intl.PluralRules(localeTag(language)).select(Math.abs(n));
}

/** A date and a time together — what a moderator's "suspended until" needs. */
export function formatDateTime(value, language) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  const text = date.toLocaleString(localeTag(language), {
    ...options, hour: '2-digit', minute: '2-digit',
  });
  if (!ICU_FALLBACK_MONTH.test(text)) return text;
  // The clock half is digits and survives the missing month names, but it is
  // simpler to rebuild both halves than to cut one out of the string.
  return `${repairNamedMonth('M01', date, language, options)}, ${formatTime(date, language)}`;
}
