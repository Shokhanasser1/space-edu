/**
 * The screen that did not exist: a forgotten password was a lost account.
 *
 * Two things are worth holding here. The first step's answer must not say
 * whether there is an account for that address — the API is careful about that
 * and a screen that says "we sent it to you" gives away what the API refused
 * to. The second is that a rate limit is not a wrong code, and telling a child
 * to try again when trying again cannot work is how they conclude the site is
 * broken.
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
let ForgotPasswordView;

beforeEach(async () => {
  vi.resetModules();
  ({ default: api } = await import('@/lib/api'));
  api.get.mockReset();
  api.post.mockReset();
  ({ default: ForgotPasswordView } = await import('./ForgotPasswordView'));
});

function show() {
  render(
    <MemoryRouter>
      <ForgotPasswordView />
    </MemoryRouter>,
  );
}

async function askForACode(address = 'pupil@school.uz') {
  await userEvent.type(screen.getByRole('textbox'), address);
  await userEvent.click(screen.getByRole('button', { name: /send|yuborish|отправить/i }));
}

describe('asking for a code', () => {
  it('says the same thing whether or not the account exists', async () => {
    api.post.mockResolvedValue({
      data: { detail: 'If an account exists for that address, a code has been sent.' },
    });

    show();
    await askForACode('nobody@nowhere.uz');

    await waitFor(() => {
      expect(screen.getByText(/if there is an account/i)).toBeInTheDocument();
    });
    // Not "we sent it to you", which would answer the question the API will not.
    expect(screen.queryByText(/we sent it to nobody@nowhere\.uz/i)).not.toBeInTheDocument();
  });

  it('moves on to the code and the new password', async () => {
    api.post.mockResolvedValue({ data: {} });

    show();
    await askForACode();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('123456')).toBeInTheDocument();
    });
    expect(document.querySelectorAll('input[type="password"]').length).toBe(2);
  });
});

describe('using the code', () => {
  async function reachSecondStep() {
    api.post.mockResolvedValue({ data: {} });
    show();
    await askForACode();
    await waitFor(() => expect(screen.getByPlaceholderText('123456')).toBeInTheDocument());
    api.post.mockReset();
  }

  it('does not send two different passwords to the server', async () => {
    await reachSecondStep();

    await userEvent.type(screen.getByPlaceholderText('123456'), '123456');
    const [first, second] = document.querySelectorAll('input[type="password"]');
    await userEvent.type(first, 'An0therG00dOne!42');
    await userEvent.type(second, 'SomethingElse!99');
    await userEvent.click(screen.getByRole('button', { name: /set|o‘rnat|установить/i }));

    await waitFor(() => {
      expect(screen.getByText(/not the same|bir xil emas|не совпадают/i)).toBeInTheDocument();
    });
    expect(api.post).not.toHaveBeenCalled();
  });

  it('calls a rate limit a rate limit, with the wait', async () => {
    await reachSecondStep();
    api.post.mockRejectedValue({
      response: {
        status: 429,
        headers: { 'retry-after': '600' },
        data: { detail: 'Request was throttled. Expected available in 600 seconds.' },
      },
    });

    await userEvent.type(screen.getByPlaceholderText('123456'), '123456');
    const [first, second] = document.querySelectorAll('input[type="password"]');
    await userEvent.type(first, 'An0therG00dOne!42');
    await userEvent.type(second, 'An0therG00dOne!42');
    await userEvent.click(screen.getByRole('button', { name: /set|o‘rnat|установить/i }));

    await waitFor(() => {
      expect(screen.getByText(/10 min/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Request was throttled/)).not.toBeInTheDocument();
  });

  it('shows what the server said was wrong with the password', async () => {
    await reachSecondStep();
    api.post.mockRejectedValue({
      response: {
        status: 400,
        headers: {},
        data: { password: ['This password is too common.'] },
      },
    });

    await userEvent.type(screen.getByPlaceholderText('123456'), '123456');
    const [first, second] = document.querySelectorAll('input[type="password"]');
    await userEvent.type(first, 'password1234');
    await userEvent.type(second, 'password1234');
    await userEvent.click(screen.getByRole('button', { name: /set|o‘rnat|установить/i }));

    await waitFor(() => {
      expect(screen.getByText(/too common/i)).toBeInTheDocument();
    });
  });
});
