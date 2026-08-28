/**
 * The site has to build and run without a Google client id.
 *
 * CI builds it with only VITE_API_URL set, and so does anybody who has not set
 * one up in Google Cloud Console. If this component reached for the identity
 * script anyway, the sign-in screen would carry a broken button, a request to a
 * third-party host, and a console full of errors — for a feature that is simply
 * not configured. It renders nothing instead.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  slowApi: { post: vi.fn() },
  setupApiAuth: vi.fn(),
}));

let GoogleSignInButton;

async function load() {
  vi.resetModules();
  ({ default: GoogleSignInButton } = await import('./GoogleSignInButton'));
}

function scriptTags() {
  return document.querySelectorAll('script[src*="accounts.google.com"]');
}

describe('without a client id', () => {
  beforeEach(async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    await load();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders nothing at all', () => {
    const { container } = render(
      <MemoryRouter>
        <GoogleSignInButton />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('does not reach for anything on accounts.google.com', () => {
    render(
      <MemoryRouter>
        <GoogleSignInButton />
      </MemoryRouter>,
    );
    expect(scriptTags()).toHaveLength(0);
  });

  it('leaves no divider or label behind either', () => {
    render(
      <MemoryRouter>
        <GoogleSignInButton />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/continue with|davom|продолжить/i)).not.toBeInTheDocument();
  });
});

describe('with a client id', () => {
  beforeEach(async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-id.apps.googleusercontent.com');
    await load();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    document.head.querySelectorAll('script[src*="accounts.google.com"]').forEach((s) => s.remove());
  });

  it('renders the divider and a place for Google to draw its button', () => {
    const { container } = render(
      <MemoryRouter>
        <GoogleSignInButton />
      </MemoryRouter>,
    );
    expect(container).not.toBeEmptyDOMElement();
    expect(screen.getByText(/continue with|davom|продолжить/i)).toBeInTheDocument();
  });
});

import { waitFor } from '@testing-library/react';

describe('with a client id', () => {
  beforeEach(async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com');
    vi.doMock('@/lib/googleAuth', () => ({
      isGoogleEnabled: () => true,
      renderGoogleButton: vi.fn().mockResolvedValue(() => {}),
    }));
    await load();
  });

  afterEach(() => {
    vi.doUnmock('@/lib/googleAuth');
    vi.unstubAllEnvs();
  });

  // Found in a browser, 28 Aug 2026: `onDone` is an inline arrow in both
  // callers and `t` is a new function every render, and both were in the
  // effect's dependency list — so every keystroke in the form beside the
  // button tore Google's iframe down and rendered it again, one request to
  // accounts.google.com per character typed.
  it('renders Google\'s button once, not once per keystroke in the form beside it', async () => {
    const { renderGoogleButton } = await import('@/lib/googleAuth');
    const view = (
      <MemoryRouter>
        <GoogleSignInButton onDone={() => {}} />
      </MemoryRouter>
    );
    const { rerender } = render(view);
    // What typing does: the parent re-renders with a fresh inline callback.
    rerender(
      <MemoryRouter>
        <GoogleSignInButton onDone={() => {}} />
      </MemoryRouter>,
    );
    rerender(
      <MemoryRouter>
        <GoogleSignInButton onDone={() => {}} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(renderGoogleButton).toHaveBeenCalled());
    expect(renderGoogleButton).toHaveBeenCalledTimes(1);
  });

  it('asks Google for the button in the site\'s language', async () => {
    const { renderGoogleButton } = await import('@/lib/googleAuth');
    const { useUserStore } = await import('@/store/useUserStore');
    useUserStore.setState({ language: 'RUS' });
    render(
      <MemoryRouter>
        <GoogleSignInButton />
      </MemoryRouter>,
    );
    await waitFor(() => expect(renderGoogleButton).toHaveBeenCalled());
    expect(renderGoogleButton.mock.calls[0][1]).toMatchObject({ locale: 'ru' });
    useUserStore.setState({ language: 'ENG' });
  });
});
