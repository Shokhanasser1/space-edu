/**
 * The admin panel had a guard and no door.
 *
 * StaffRoute refused everyone who was not staff — signed-out visitors to the
 * pupils' /login, signed-in pupils silently to "/" — and nothing on the site
 * linked to /admin-panel. These pin the door that was added: staff get in, a
 * valid account without staff rights does not, and its session is not kept.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  slowApi: { post: vi.fn() },
  setupApiAuth: vi.fn(),
}));

let api;
let AdminLoginView;
let StaffRoute;
let useAuthStore;

beforeEach(async () => {
  localStorage.clear();
  ({ default: api } = await import('@/lib/api'));
  api.get.mockReset();
  api.post.mockReset();
  api.get.mockResolvedValue({ data: {} });
  api.post.mockResolvedValue({ data: {} });
  ({ default: AdminLoginView } = await import('./AdminLoginView'));
  ({ default: StaffRoute } = await import('@/components/StaffRoute'));
  ({ useAuthStore } = await import('@/store/useAuthStore'));
  useAuthStore.setState({
    user: null, accessToken: null, refreshToken: null, isAuthenticated: false,
  });
});

/** The real arrangement from App.jsx: the sign-in outside the guard, the panel inside it. */
function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin-panel/login" element={<AdminLoginView />} />
        <Route element={<StaffRoute />}>
          <Route path="/admin-panel" element={<p>the panel</p>} />
        </Route>
        <Route path="/" element={<p>the home page</p>} />
        <Route path="/login" element={<p>the pupils' sign-in</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function signIn(identifier = 'admin@uzcosmos.uz', password = 'secret') {
  await userEvent.type(screen.getByRole('textbox'), identifier);
  await userEvent.type(document.querySelector('input[type="password"]'), password);
  await userEvent.click(screen.getByRole('button', { name: /sign in|panelga|войти в панель/i }));
}

describe('the admin sign-in', () => {
  it('is where the panel sends somebody who is signed out', () => {
    renderAt('/admin-panel');

    expect(document.querySelector('input[type="password"]')).toBeInTheDocument();
    expect(screen.queryByText("the pupils' sign-in")).not.toBeInTheDocument();
  });

  it('lets a member of staff in, and back to the panel', async () => {
    api.post.mockResolvedValue({
      data: { user: { id: 1, username: 'admin', is_staff: true }, access: 'a', refresh: 'r' },
    });
    renderAt('/admin-panel');

    await signIn();

    await waitFor(() => expect(screen.getByText('the panel')).toBeInTheDocument());
    expect(api.post).toHaveBeenCalledWith('/auth/login/', { email: 'admin@uzcosmos.uz', password: 'secret' });
    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: true, accessToken: 'a' });
  });

  it('refuses a valid account that is not staff, and does not keep its session', async () => {
    api.post.mockResolvedValueOnce({
      data: { user: { id: 2, username: 'pupil', is_staff: false }, access: 'a2', refresh: 'r2' },
    });
    renderAt('/admin-panel/login');

    await signIn('pupil@school.uz');

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/admin/i));
    // Not signed in to the site by a screen that said no…
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
    // …and the tokens the server issued are revoked, not left to run.
    expect(api.post).toHaveBeenCalledWith('/auth/logout/', { refresh: 'r2' });
    expect(screen.queryByText('the panel')).not.toBeInTheDocument();
  });

  it('calls a wrong password a wrong password', async () => {
    api.post.mockRejectedValue({
      response: { status: 401, headers: {}, data: { detail: 'Invalid credentials.' } },
    });
    renderAt('/admin-panel/login');

    await signIn();

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('sends a member of staff who is already signed in straight to the panel', () => {
    useAuthStore.setState({
      user: { id: 1, username: 'admin', is_staff: true },
      accessToken: 'a', refreshToken: 'r', isAuthenticated: true,
    });
    renderAt('/admin-panel/login');

    expect(screen.getByText('the panel')).toBeInTheDocument();
  });

  it('tells a signed-in pupil why the panel will not open, instead of bouncing them home', () => {
    useAuthStore.setState({
      user: { id: 2, username: 'pupil', email: 'pupil@school.uz', is_staff: false },
      accessToken: 'a', refreshToken: 'r', isAuthenticated: true,
    });
    renderAt('/admin-panel');

    expect(screen.queryByText('the home page')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('pupil@school.uz');
    // No form over the top of somebody else's session.
    expect(document.querySelector('input[type="password"]')).not.toBeInTheDocument();
  });

  it('offers the form once that pupil has signed out', async () => {
    useAuthStore.setState({
      user: { id: 2, username: 'pupil', is_staff: false },
      accessToken: 'a', refreshToken: 'r', isAuthenticated: true,
    });
    renderAt('/admin-panel/login');

    await userEvent.click(screen.getByRole('button', { name: /sign out|chiqish|выйти/i }));

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(document.querySelector('input[type="password"]')).toBeInTheDocument();
  });
});
