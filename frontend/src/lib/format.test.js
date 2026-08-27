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
