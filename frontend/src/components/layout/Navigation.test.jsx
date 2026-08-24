/**
 * Fourth-pass finding, 24 August 2026: on a phone there was no way to sign out.
 *
 * The profile dropdown that holds "Log Out" is `hidden` below Tailwind's `xl`
 * breakpoint, and the compact bar that replaces it only links to /profile. So
 * on every phone, every tablet and any laptop under 1280px a signed-in pupil
 * could not end their session — which on a shared school computer leaves the
 * previous child's account open for the next one.
 *
 * jsdom applies no media queries, so this cannot test the breakpoint itself.
 * What it tests is the thing that was actually missing: the mobile panel had no
 * account section at all, so opening it produced no way out.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn().mockResolvedValue({ data: {} }) },
  slowApi: { post: vi.fn() },
  setupApiAuth: vi.fn(),
}));

let Navigation;
let useAuthStore;

beforeEach(async () => {
  localStorage.clear();
  // `restoreMocks` clears the factory's mockResolvedValue between tests, and an
  // api.post that returns undefined is not what production does.
  const api = (await import('@/lib/api')).default;
  api.post.mockResolvedValue({ data: {} });
  ({ default: Navigation } = await import('./Navigation'));
  ({ useAuthStore } = await import('@/store/useAuthStore'));
  useAuthStore.setState({
    user: null, accessToken: null, refreshToken: null, isAuthenticated: false,
  });
});

function renderNav() {
  return render(
    <MemoryRouter>
      <Navigation />
    </MemoryRouter>,
  );
}

async function openTheMobileMenu() {
  await userEvent.click(document.querySelector('nav button[aria-expanded]'));
}

describe('the menu behind the hamburger', () => {
  it('offers a way to sign out when signed in', async () => {
    useAuthStore.setState({
      user: { id: 1, username: 'pupil' },
      accessToken: 'a', refreshToken: 'r', isAuthenticated: true,
    });
    renderNav();

    await openTheMobileMenu();

    const signOut = screen.getByRole('button', { name: /log ?out|выйти|chiqish/i });
    expect(signOut).toBeInTheDocument();
  });

  it('ends the session when it is pressed', async () => {
    const api = (await import('@/lib/api')).default;
    useAuthStore.setState({
      user: { id: 1, username: 'pupil' },
      accessToken: 'a', refreshToken: 'refresh-1', isAuthenticated: true,
    });
    renderNav();

    await openTheMobileMenu();
    await userEvent.click(screen.getByRole('button', { name: /log ?out|выйти|chiqish/i }));

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    // And on the server, not only in this tab.
    expect(api.post).toHaveBeenCalledWith('/auth/logout/', { refresh: 'refresh-1' });
  });

  it('offers a way to sign in when signed out', async () => {
    renderNav();

    await openTheMobileMenu();

    const links = screen.getAllByRole('link', { name: /log ?in|войти|kirish/i });
    expect(links.length).toBeGreaterThan(0);
  });
});
