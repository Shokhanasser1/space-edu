/**
 * An account that came through Google could not finish itself.
 *
 * Audit, 21 Oct 2026. Google gives no date of birth and no password. The panel
 * offered "change password" — which asks for a current one the account never
 * had — and nowhere to add the date of birth, while the password-reset screen
 * that could set one refuses anybody signed in. These cover the two cards that
 * close that: set a password by e-mail code, and add the date of birth.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  slowApi: { post: vi.fn() },
  setupApiAuth: vi.fn(),
}));

let api;
let SecurityPanel;
let useAuthStore;

const GOOGLE_USER = {
  id: 7, email: 'pupil@gmail.com', email_verified: true, has_password: false, date_of_birth: null,
};

beforeEach(async () => {
  vi.resetModules();
  ({ default: api } = await import('@/lib/api'));
  api.get.mockReset();
  api.post.mockReset();
  api.patch.mockReset();
  ({ default: SecurityPanel } = await import('./SecurityPanel'));
  ({ useAuthStore } = await import('@/store/useAuthStore'));
});

function show(user) {
  useAuthStore.setState({ user, accessToken: 'a1', refreshToken: 'r1', isAuthenticated: true });
  render(
    <MemoryRouter>
      <SecurityPanel />
    </MemoryRouter>,
  );
}

describe('an account with no password', () => {
  it('is offered a password to set, not one to change', () => {
    show(GOOGLE_USER);
    expect(screen.getByRole('button', { name: /pupil@gmail\.com/ })).toBeInTheDocument();
    // Neither card asks for a current password the account never had: moving
    // the address needs one too, so that card says to set it first.
    expect(screen.queryByLabelText(/current password/i)).not.toBeInTheDocument();
  });

  it('sets one with a code from its own address, and keeps the session', async () => {
    api.post.mockImplementation((url) => {
      if (url === '/auth/login/') {
        return Promise.resolve({
          data: { user: { ...GOOGLE_USER, has_password: true }, access: 'a2', refresh: 'r2' },
        });
      }
      return Promise.resolve({ data: {} });
    });
    show(GOOGLE_USER);

    await userEvent.click(screen.getByRole('button', { name: /pupil@gmail\.com/ }));
    expect(api.post).toHaveBeenCalledWith('/auth/password/reset/request/', { email: 'pupil@gmail.com' });

    await userEvent.type(await screen.findByLabelText(/code/i), '123456');
    await userEvent.type(screen.getByLabelText(/^new password$/i), 'Orbit-Lander-2026');
    await userEvent.type(screen.getByLabelText(/new password again/i), 'Orbit-Lander-2026');
    await userEvent.click(screen.getByRole('button', { name: /set a password/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/password/reset/confirm/', {
        email: 'pupil@gmail.com', code: '123456',
        password: 'Orbit-Lander-2026', password2: 'Orbit-Lander-2026',
      });
    });
    // The reset revoked every refresh token, this tab's too: signing in again
    // with the new password is what keeps it from being signed out later.
    await waitFor(() => expect(useAuthStore.getState().refreshToken).toBe('r2'));
    expect(useAuthStore.getState().user.has_password).toBe(true);
  });
});

describe('arriving from a Google sign-in', () => {
  it('scrolls to the panel, which sits at the foot of the profile', () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    useAuthStore.setState({ user: GOOGLE_USER, isAuthenticated: true });
    render(
      <MemoryRouter initialEntries={['/profile#account']}>
        <SecurityPanel />
      </MemoryRouter>,
    );
    expect(scrolled).toHaveBeenCalled();
  });
});

describe('an account with a password', () => {
  it('still changes it the usual way', () => {
    show({ ...GOOGLE_USER, has_password: true, date_of_birth: '2012-05-01' });
    // One for the password, one for moving the address.
    expect(screen.getAllByLabelText(/current password/i)).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /pupil@gmail\.com/ })).not.toBeInTheDocument();
  });
});

describe('the date of birth', () => {
  it('is asked for when the account has none, and saved', async () => {
    api.patch.mockResolvedValue({ data: { ...GOOGLE_USER, date_of_birth: '2012-05-01' } });
    show(GOOGLE_USER);

    await userEvent.type(screen.getByLabelText(/date of birth/i), '2012-05-01');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/auth/me/', { date_of_birth: '2012-05-01' });
    });
    await waitFor(() => expect(useAuthStore.getState().user.date_of_birth).toBe('2012-05-01'));
  });

  it('is not asked for once there is one', () => {
    show({ ...GOOGLE_USER, date_of_birth: '2012-05-01' });
    expect(screen.queryByLabelText(/date of birth/i)).not.toBeInTheDocument();
  });
});
