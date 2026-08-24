/**
 * Third-pass finding, 24 Aug 2026: a rate-limited sign-in was reported to the
 * child as a wrong password.
 *
 * The backend half of this is in `apps/accounts/throttles.py` — the throttle
 * counted successful sign-ins and keyed on the address alone, so the eleventh
 * pupil in a school got 429 having typed nothing wrong. This half is what they
 * were told when it happened: DRF's English `detail`, or "Invalid email or
 * password", which sends them off to reset a password that is fine.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  slowApi: { post: vi.fn() },
  setupApiAuth: vi.fn(),
}));

let api;
let LoginView;

beforeEach(async () => {
  ({ default: api } = await import('@/lib/api'));
  api.get.mockReset();
  api.post.mockReset();
  api.get.mockResolvedValue({ data: {} });
  ({ default: LoginView } = await import('./LoginView'));
});

async function signIn() {
  render(
    <MemoryRouter>
      <LoginView />
    </MemoryRouter>,
  );
  await userEvent.type(screen.getByRole('textbox'), 'pupil@school.uz');
  await userEvent.type(document.querySelector('input[type="password"]'), 'whatever');
  await userEvent.click(screen.getByRole('button', { name: /launch|kirish|войти|sign/i }));
}

describe('a rate-limited sign-in', () => {
  it('says it is a rate limit, in the reader\'s language, with the wait', async () => {
    api.post.mockRejectedValue({
      response: {
        status: 429,
        headers: { 'retry-after': '600' },
        data: { detail: 'Request was throttled. Expected available in 600 seconds.' },
      },
    });

    await signIn();

    await waitFor(() => {
      expect(screen.getByText(/too many wrong passwords/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/10 min/)).toBeInTheDocument();
    // The English DRF sentence must not reach the screen.
    expect(screen.queryByText(/Request was throttled/)).not.toBeInTheDocument();
    // Nor may it be reported as a credentials problem.
    expect(screen.queryByText(/invalid email or password/i)).not.toBeInTheDocument();
  });

  it('still calls a wrong password a wrong password', async () => {
    api.post.mockRejectedValue({
      response: { status: 401, headers: {}, data: { detail: 'Invalid credentials.' } },
    });

    await signIn();

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/too many wrong passwords/i)).not.toBeInTheDocument();
  });
});
