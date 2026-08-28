/**
 * Fifth-pass finding, 24 Aug 2026: the sign-in screen greeted Russian readers
 * with "С возвращением Back".
 *
 * English splits "Welcome Back" across two keys so the second half can be
 * coloured. Russian says it in one word, so `loginPage.welcomeHighlight` is
 * deliberately `""` — and `t()` used `if (value)`, which cannot tell an empty
 * translation from an absent one, so it fell back to the English half and
 * pasted it onto the end of the Russian sentence.
 */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useTranslation } from './useTranslation';
import { useUserStore } from '@/store/useUserStore';

const t = (lang) => {
  useUserStore.setState({ language: lang });
  return renderHook(() => useTranslation()).result.current.t;
};

beforeEach(() => {
  localStorage.clear();
});

describe('a deliberately empty translation', () => {
  it('stays empty rather than turning into English', () => {
    expect(t('RUS')('loginPage', 'welcomeHighlight')).toBe('');
  });

  it('leaves the rest of the sentence translated', () => {
    const translate = t('RUS');
    expect(translate('loginPage', 'welcomeTitle')).not.toBe('Welcome');
    expect(translate('loginPage', 'welcomeTitle')).not.toMatch(/Back/);
  });
});

describe('a genuinely missing translation', () => {
  it('still falls back to English', () => {
    // uz has this one; the point is that the fallback path is untouched.
    expect(t('UZB')('loginPage', 'welcomeHighlight')).toBeTruthy();
  });

  it('returns the key path when nothing has it, rather than blank', () => {
    expect(t('ENG')('loginPage', 'noSuchKeyAnywhere')).toBe('loginPage.noSuchKeyAnywhere');
    expect(t('ENG')('noSuchSection', 'key')).toBe('noSuchSection.key');
  });
});

describe('a placeholder in the sentence', () => {
  // Found in a browser, 28 Aug 2026: CreativityTopicView passed `{ name }` and
  // a child read "Изучите инженерные и дизайнерские принципы {name}." — the
  // third argument was accepted and ignored.
  it('is filled from the third argument, in every language', () => {
    for (const lang of ['ENG', 'RUS', 'UZB']) {
      const said = t(lang)('learnViews', 'lessonDescription', { name: 'Sputnik' });
      expect(said).toContain('Sputnik');
      expect(said).not.toContain('{name}');
    }
  });

  it('accepts the double-brace form some strings use', () => {
    const said = t('RUS')('game', 'shopDesc', { skin: 'Comet' });
    expect(said).toContain('Comet');
    expect(said).not.toMatch(/\{\{/);
  });

  it('leaves a placeholder alone when nothing was given for it', () => {
    expect(t('ENG')('learnViews', 'lessonDescription')).toContain('{name}');
    expect(t('ENG')('learnViews', 'lessonDescription', {})).toContain('{name}');
  });
});
