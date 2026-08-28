/**
 * Found in a browser, 28 Aug 2026: `<html lang="en">` on every Russian and
 * Uzbek page. index.html read a localStorage key nothing wrote, and nothing
 * else ever set the attribute — so a screen reader read Russian in an English
 * voice and the browser offered to translate a page already in the reader's
 * language.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { mirrorLanguageToDocument, useUserStore } from './useUserStore';

describe('the document language', () => {
  beforeEach(() => {
    document.documentElement.lang = 'en';
  });

  it('follows the store', () => {
    useUserStore.getState().setLanguage('RUS');
    expect(document.documentElement.lang).toBe('ru');
    useUserStore.getState().setLanguage('UZB');
    expect(document.documentElement.lang).toBe('uz');
    useUserStore.getState().setLanguage('ENG');
    expect(document.documentElement.lang).toBe('en');
  });

  it('never leaves the attribute on something Intl would not understand', () => {
    mirrorLanguageToDocument('KLINGON');
    expect(document.documentElement.lang).toBe('en');
  });
});
