/**
 * The registration form had no test and no client-side checking at all.
 *
 * Two passwords that differ were posted to the server so it could say so, which
 * is a round trip nobody needed and, on a school connection, a visible wait for
 * an answer the page already had. The rest of the checking stays on the server,
 * where it belongs.
 *
 * 28 Aug 2026: the form became two steps. The request is the same six-field
 * POST; the tests below walk both steps to send it.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

function renderView() {
  return render(
    <MemoryRouter>
      <RegisterView />
    </MemoryRouter>,
  );
}

const nextButton = () => screen.getByRole('button', { name: /continue|davom|продолжить/i });
const submitButton = () => screen.getByRole('button', { name: /initialize|yaratish|создать/i });

async function fillStepOne() {
  const boxes = document.querySelectorAll('input');
  await userEvent.type(boxes[0], 'Aziz');
  await userEvent.type(boxes[1], 'Karimov');
  fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: '2012-05-01' } });
  await userEvent.click(nextButton());
  await waitFor(() => expect(document.querySelector('input[type="email"]')).toBeInTheDocument());
}

async function fillIn({ password, password2 }) {
  renderView();
  await fillStepOne();
  await userEvent.type(document.querySelector('input[type="email"]'), 'aziz@school.uz');

  const passwords = document.querySelectorAll('input[type="password"]');
  await userEvent.type(passwords[0], password);
  await userEvent.type(passwords[1], password2);

  await userEvent.click(submitButton());
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

  it('goes back to step one when the complaint is about a step-one field', async () => {
    api.post.mockRejectedValue({
      response: {
        status: 400,
        headers: {},
        data: { date_of_birth: ['Date of birth must be in the past.'] },
      },
    });

    await fillIn({ password: 'Str0ngPassw0rd!x', password2: 'Str0ngPassw0rd!x' });

    await waitFor(() => {
      expect(screen.getByText(/must be in the past/i)).toBeInTheDocument();
    });
    expect(document.querySelector('input[type="date"]')).toBeInTheDocument();
    expect(document.querySelector('input[type="email"]')).not.toBeInTheDocument();
  });
});

describe('the first step', () => {
  it('does not move on with empty boxes, and says which', async () => {
    renderView();
    await userEvent.click(nextButton());

    expect(await screen.findAllByText(/required|to'ldiring|заполните/i)).not.toHaveLength(0);
    expect(document.querySelector('input[type="email"]')).not.toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('refuses a date of birth in the future', async () => {
    renderView();
    const boxes = document.querySelectorAll('input');
    await userEvent.type(boxes[0], 'Aziz');
    await userEvent.type(boxes[1], 'Karimov');
    fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: '2099-01-01' } });
    await userEvent.click(nextButton());

    expect(await screen.findByText(/in the past|o'tmishda|в прошлом/i)).toBeInTheDocument();
    expect(document.querySelector('input[type="email"]')).not.toBeInTheDocument();
  });
});

describe('the request', () => {
  it('is the same six-field POST the server always received', async () => {
    api.post.mockResolvedValue({ data: { user: { id: 1, email: 'aziz@school.uz' }, access: 'a', refresh: 'r' } });

    await fillIn({ password: 'Str0ngPassw0rd!x', password2: 'Str0ngPassw0rd!x' });

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post).toHaveBeenCalledWith('/auth/register/', {
      first_name: 'Aziz',
      last_name: 'Karimov',
      date_of_birth: '2012-05-01',
      email: 'aziz@school.uz',
      password: 'Str0ngPassw0rd!x',
      password2: 'Str0ngPassw0rd!x',
    });
  });

  it('warns about a password of digits alone before sending anything', async () => {
    await fillIn({ password: '12345678', password2: '12345678' });

    expect(await screen.findByText(/digits alone|raqamlarni|одни цифры/i)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });
});

describe('what the server says, to a Russian reader', () => {
  // Found in a browser, 28 Aug 2026: "This email is already registered." on a
  // page where every other word was Russian. The sentence is now looked up in
  // lib/serverErrors.js and said in the reader's language.
  it('is said in Russian against the field it is about', async () => {
    const { useUserStore } = await import('@/store/useUserStore');
    useUserStore.setState({ language: 'RUS' });
    api.post.mockRejectedValue({
      response: {
        status: 400,
        headers: {},
        data: { email: ['This email is already registered.'] },
      },
    });

    await fillIn({ password: 'Str0ngPassw0rd!x', password2: 'Str0ngPassw0rd!x' });

    await waitFor(() => {
      expect(screen.getByText(/уже зарегистрирован/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/already registered/i)).not.toBeInTheDocument();
    useUserStore.setState({ language: 'ENG' });
  });

  it('never puts an unknown English sentence in the general box', async () => {
    const { useUserStore } = await import('@/store/useUserStore');
    useUserStore.setState({ language: 'RUS' });
    api.post.mockRejectedValue({
      response: { status: 400, headers: {}, data: { detail: 'A sentence nobody translated.' } },
    });

    await fillIn({ password: 'Str0ngPassw0rd!x', password2: 'Str0ngPassw0rd!x' });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.queryByText(/nobody translated/)).not.toBeInTheDocument();
    useUserStore.setState({ language: 'ENG' });
  });
});

describe('the caret', () => {
  // Found in a browser, 28 Aug 2026: after "Continue" the focus was on <body>.
  // With `AnimatePresence mode="wait"` the second step is mounted only after
  // the first has slid out, so the focus effect ran against nothing.
  it('lands on the e-mail box when the second step opens', async () => {
    renderView();
    await fillStepOne();
    await waitFor(() => {
      expect(document.activeElement?.id).toBe('reg-email');
    });
  });
});
