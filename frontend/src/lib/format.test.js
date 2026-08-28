/**
 * A number on a Russian page should look Russian, wherever the reader's laptop
 * thinks it is.
 *
 * Twenty-odd call sites used `toLocaleString()` with no argument, which formats
 * with the *machine's* locale. Two things came of it. A page in Russian showed
 * `4,951` to a reader whose computer was set to English — the site chooses its
 * language deliberately, with a switcher and 1,287 translated strings behind it,
 * and then handed the numbers to the operating system. And
 * `ProfileView.test.jsx` asserted `#4,951`, which passed in CI on an
 * English-locale runner and failed on every laptop in this team; a test whose
 * answer depends on where it runs teaches people to ignore it.
 *
 * The tests below say the same thing twice on purpose: what each language looks
 * like, and that none of it moves when the machine changes.
 */
import { describe, expect, it } from 'vitest';

import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatTime,
  localeTag,
  pluralForm,
  repairNamedMonth,
} from './format';

describe('a number', () => {
  it('is grouped the way each language groups it', () => {
    expect(formatNumber(4951, 'ENG')).toBe('4,951');
    // Russian and Uzbek group with a space — which Intl gives as a non-breaking
    // one, so this checks the digits and the absence of a comma rather than
    // asserting a character nobody can see in a diff.
    for (const language of ['RUS', 'UZB']) {
      const shown = formatNumber(4951, language);
      expect(shown).not.toContain(',');
      expect(shown.replace(/\s|\u00a0|\u202f/g, '')).toBe('4951');
    }
  });

  it('does not ask the machine what it thinks', () => {
    // The point of the whole module: the same input and the same language give
    // the same answer on a laptop in Tashkent and on a runner in Azure.
    expect(formatNumber(1234567, 'ENG')).toBe('1,234,567');
  });

  it('falls back to English for a language nobody has heard of', () => {
    expect(formatNumber(4951, 'KLINGON')).toBe('4,951');
    expect(formatNumber(4951, undefined)).toBe('4,951');
  });

  it('says nothing rather than NaN when there is nothing to say', () => {
    for (const nothing of [null, undefined, '', 'abc', NaN]) {
      expect(formatNumber(nothing, 'ENG')).toBe('');
    }
  });
});

describe('a price', () => {
  it('is grouped with plain spaces whatever the page language', () => {
    // So'm is written `1 200 000` in all three languages, so this one is
    // deliberately not language-dependent.
    expect(formatMoney(1200000)).toBe('1 200 000');
  });

  it('carries no invisible space that a test could not see', () => {
    expect(formatMoney(1200000)).not.toMatch(/[\u00a0\u202f]/);
  });
});

describe('a date and a time', () => {
  const moment = new Date('2026-08-28T14:05:00Z');

  it('come out in the language of the page', () => {
    expect(formatDate(moment, 'ENG', { month: 'long' })).toBe('August');
    expect(formatDate(moment, 'RUS', { month: 'long' })).toMatch(/август/i);
  });

  it('accept a string as readily as a Date, because the API sends strings', () => {
    expect(formatDate('2026-08-28T14:05:00Z', 'ENG', { year: 'numeric' })).toBe('2026');
  });

  it('say nothing for something that is not a date', () => {
    expect(formatDate('not a date', 'ENG')).toBe('');
    expect(formatTime(undefined, 'ENG')).toBe('');
    expect(formatDateTime('', 'ENG')).toBe('');
  });

  it('give hours and minutes for a time', () => {
    expect(formatTime(moment, 'ENG')).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe('the language-to-locale mapping', () => {
  it('is the one the four hand-written copies used to spell out', () => {
    expect(localeTag('ENG')).toBe('en-US');
    expect(localeTag('UZB')).toBe('uz-UZ');
    expect(localeTag('RUS')).toBe('ru-RU');
  });
});

/**
 * Chromium has no Uzbek month names.
 *
 * `new Date().toLocaleDateString('uz-UZ', { month: 'long' })` answers "M08 28"
 * in Chrome — ICU's root-locale fallback — while `supportedLocalesOf(['uz-UZ'])`
 * still says the locale is supported, so nothing warns you. The News page's
 * heading is a date in 44px type, and it read "M08 28" to the readers this site
 * exists for.
 *
 * Node's ICU has the names, so a test that went through `formatDate` would take
 * the other branch and pass without touching any of this. These give
 * `repairNamedMonth` the string a browser would have produced, which makes both
 * branches deterministic wherever the suite runs.
 */
describe('a browser with no month names for the reader s language', () => {
  const august = new Date(2026, 7, 28);

  it('rebuilds an Uzbek date instead of printing M08', () => {
    expect(repairNamedMonth('M08 28', august, 'UZB', { day: 'numeric', month: 'long' }))
      .toBe('28-avgust');
  });

  it('keeps the year when the caller asked for one', () => {
    expect(repairNamedMonth('2026 M08 28', august, 'UZB',
      { year: 'numeric', month: 'short', day: 'numeric' })).toBe('28-avg, 2026');
  });

  it('does not put the month before the day, which is what a swap would do', () => {
    const rebuilt = repairNamedMonth('2026 M08 28', august, 'UZB',
      { year: 'numeric', month: 'long', day: 'numeric' });
    expect(rebuilt).toBe('28-avgust, 2026');
    expect(rebuilt).not.toMatch(/^2026/);
  });

  it('leaves a date alone when the browser managed it', () => {
    // Every browser has these, and this branch must never touch them.
    expect(repairNamedMonth('28 августа', august, 'RUS', { day: 'numeric', month: 'long' }))
      .toBe('28 августа');
    expect(repairNamedMonth('August 28', august, 'ENG', { day: 'numeric', month: 'long' }))
      .toBe('August 28');
  });

  it('is not fooled by an M-number that is not a month token', () => {
    expect(repairNamedMonth('M13 28', august, 'UZB', { day: 'numeric', month: 'long' }))
      .toBe('M13 28');
    expect(repairNamedMonth('M00 28', august, 'UZB', { day: 'numeric', month: 'long' }))
      .toBe('M00 28');
  });

  it('formatDate passes a working browser s output straight through', () => {
    // Node has full ICU, so this is the other branch, and it must be untouched.
    expect(formatDate(august, 'ENG', { day: 'numeric', month: 'long' })).toBe('August 28');
  });
});

/**
 * Russian needs three plural forms and an anniversary line prints one every
 * time: "1 год назад", "33 года назад", "237 лет назад".
 */
describe('plural forms', () => {
  it('picks the Russian form the number actually takes', () => {
    expect(pluralForm(1, 'RUS')).toBe('one');
    expect(pluralForm(33, 'RUS')).toBe('few');
    expect(pluralForm(237, 'RUS')).toBe('many');
    expect(pluralForm(11, 'RUS')).toBe('many');
  });

  it('gives English and Uzbek the two forms they have', () => {
    expect(pluralForm(1, 'ENG')).toBe('one');
    expect(pluralForm(2, 'ENG')).toBe('other');
    expect(pluralForm(1, 'UZB')).toBe('one');
    expect(pluralForm(69, 'UZB')).toBe('other');
  });

  it('never throws on rubbish, so a missing count cannot blank a page', () => {
    for (const bad of [null, undefined, '', NaN, 'many']) {
      expect(pluralForm(bad, 'RUS')).toBe('other');
    }
  });
});
