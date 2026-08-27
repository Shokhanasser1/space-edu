/**
 * /login and /register were reachable while somebody was signed in.
 *
 * On a shared school computer that is how one child ends up looking at another
 * child's account: the second one opens the sign-in page, the first one's
 * session is still in localStorage, and whatever they do next happens under a
 * name that is not theirs. "Forgot password" reached the same way sends a code
 * for an address they are not looking at.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  slowApi: { post: vi.fn() },
  setupApiAuth: vi.fn(),
}));

let GuestRoute;
let useAuthStore;

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  ({ useAuthStore } = await import('@/store/useAuthStore'));
  ({ default: GuestRoute } = await import('./GuestRoute'));
});

function showSignInPage() {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<p>the sign-in form</p>} />
        </Route>
        <Route path="/" element={<p>the home page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('the sign-in screens', () => {
  it('are there for somebody who is signed out', () => {
    showSignInPage();
    expect(screen.getByText('the sign-in form')).toBeInTheDocument();
  });

  it('send a signed-in visitor home instead', () => {
    useAuthStore.setState({
      user: { id: 1, username: 'aziz' },
      accessToken: 'a',
      refreshToken: 'r',
      isAuthenticated: true,
    });

    showSignInPage();

    expect(screen.getByText('the home page')).toBeInTheDocument();
    expect(screen.queryByText('the sign-in form')).not.toBeInTheDocument();
  });
});
