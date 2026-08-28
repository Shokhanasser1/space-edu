/**
 * Whether this browser has been through the intro.
 *
 * localStorage, wrapped: a private window, cleared site data or a browser
 * set to block storage all throw or forget, and none of those should trap
 * somebody on the intro. When storage cannot be read we say "seen", so the
 * worst case is a missed intro rather than an inescapable one.
 */
const KEY = 'uzc:intro-seen';

export function hasSeenIntro() {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return true;
  }
}

export function markIntroSeen() {
  try {
    window.localStorage.setItem(KEY, '1');
  } catch {
    /* nothing to remember it in; the gate will simply ask again next time */
  }
}

/** For the "watch again" link and for tests. */
export function forgetIntro() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* see above */
  }
}
