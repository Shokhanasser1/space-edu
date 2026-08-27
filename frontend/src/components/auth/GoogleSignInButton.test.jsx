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
