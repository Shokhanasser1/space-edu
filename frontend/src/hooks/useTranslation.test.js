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
