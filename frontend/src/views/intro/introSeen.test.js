import { afterEach, describe, expect, it, vi } from 'vitest';

import { forgetIntro, hasSeenIntro, markIntroSeen } from './introSeen';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('the intro flag', () => {
  it('is unset for a new browser and set once marked', () => {
    expect(hasSeenIntro()).toBe(false);
    markIntroSeen();
    expect(hasSeenIntro()).toBe(true);
    forgetIntro();
    expect(hasSeenIntro()).toBe(false);
  });

  it('counts as seen when storage cannot be read, so nobody is trapped on the intro', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(hasSeenIntro()).toBe(true);
  });

  it('does not throw when storage cannot be written', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => markIntroSeen()).not.toThrow();
  });
});
