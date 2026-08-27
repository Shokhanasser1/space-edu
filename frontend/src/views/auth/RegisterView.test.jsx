/**
 * The registration form had no test and no client-side checking at all.
 *
 * Two passwords that differ were posted to the server so it could say so, which
 * is a round trip nobody needed and, on a school connection, a visible wait for
 * an answer the page already had. The rest of the checking stays on the server,
 * where it belongs.
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
let RegisterView;

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  ({ default: api } = await import('@/lib/api'));
  api.get.mockReset();
  api.post.mockReset();
  api.get.mockResolvedValue({ data: {} });
  ({ default: RegisterView } = await import('./RegisterView'));
});

async function fillIn({ password, password2 }) {
  render(
    <MemoryRouter>
      <RegisterView />
    </MemoryRouter>,
  );

  const boxes = document.querySelectorAll('input');
  await userEvent.type(boxes[0], 'Aziz');
  await userEvent.type(boxes[1], 'Karimov');
  await userEvent.type(document.querySelector('input[type="email"]'), 'aziz@school.uz');

  const passwords = document.querySelectorAll('input[type="password"]');
  await userEvent.type(passwords[0], password);
  await userEvent.type(passwords[1], password2);

  await userEvent.click(screen.getByRole('button', { name: /initialize|yaratish|создать/i }));
}

describe('two passwords that differ', () => {
  it('are caught here rather than at the server', async () => {
    await fillIn({ password: 'Str0ngPassw0rd!x', password2: 'SomethingElse!99' });

    await waitFor(() => {
      expect(screen.getByText(/not the same|bir xil emas|не совпадают/i)).toBeInTheDocument();
    });
    expect(api.post).not.toHaveBeenCalled();
  });
});

describe('what the server says', () => {
  it('is shown against the field it is about', async () => {
    api.post.mockRejectedValue({
      response: {
        status: 400,
        headers: {},
        data: { email: ['This email is already registered.'] },
      },
    });

    await fillIn({ password: 'Str0ngPassw0rd!x', password2: 'Str0ngPassw0rd!x' });

    await waitFor(() => {
      expect(screen.getByText(/already registered/i)).toBeInTheDocument();
    });
  });

  it('reports a rate limit as a wait and not as a mistake', async () => {
    api.post.mockRejectedValue({
      response: {
        status: 429,
        headers: { 'retry-after': '600' },
        data: { detail: 'Request was throttled. Expected available in 600 seconds.' },
      },
    });

    await fillIn({ password: 'Str0ngPassw0rd!x', password2: 'Str0ngPassw0rd!x' });

    await waitFor(() => {
      expect(screen.getByText(/10/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Request was throttled/)).not.toBeInTheDocument();
  });
});
