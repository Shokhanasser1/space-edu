/**
 * Who sees the intro: a signed-out visitor who has not seen it. Nobody else.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  slowApi: { post: vi.fn() },
  setupApiAuth: vi.fn(),
}));

let IntroGate;
let useAuthStore;
let markIntroSeen;

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  ({ useAuthStore } = await import('@/store/useAuthStore'));
  ({ markIntroSeen } = await import('@/views/intro/introSeen'));
  ({ default: IntroGate } = await import('./IntroGate'));
});

function openHome() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<IntroGate><p>the home page</p></IntroGate>} />
        <Route path="/welcome" element={<p>the intro</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('the front door', () => {
  it('shows a first-time visitor the intro', () => {
    openHome();
    expect(screen.getByText('the intro')).toBeInTheDocument();
    expect(screen.queryByText('the home page')).not.toBeInTheDocument();
  });

  it('shows the home page to somebody who has seen it', () => {
    markIntroSeen();
    openHome();
    expect(screen.getByText('the home page')).toBeInTheDocument();
  });

  it('never shows the intro to somebody signed in', () => {
    useAuthStore.setState({
      user: { id: 1, username: 'aziz' },
      accessToken: 'a',
      refreshToken: 'r',
      isAuthenticated: true,
    });
    openHome();
    expect(screen.getByText('the home page')).toBeInTheDocument();
  });
});
