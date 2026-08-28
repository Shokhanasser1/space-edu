/**
 * The intro: Start goes to registration, Skip goes home, both remember that
 * the intro has been seen, and the keyboard works. jsdom has no WebGL, so
 * the still is what renders here — the scene is never imported.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  slowApi: { post: vi.fn() },
  setupApiAuth: vi.fn(),
}));

let IntroView;
let hasSeenIntro;

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  ({ hasSeenIntro } = await import('./introSeen'));
  ({ default: IntroView } = await import('./IntroView'));
});

function openIntro() {
  render(
    <MemoryRouter initialEntries={['/welcome']}>
      <Routes>
        <Route path="/welcome" element={<IntroView />} />
        <Route path="/register" element={<p>the registration form</p>} />
        <Route path="/" element={<p>the home page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('the intro', () => {
  it('names both partners and offers Start and Skip', () => {
    openIntro();
    expect(screen.getByText('UZ COSMOS')).toBeInTheDocument();
    expect(screen.getByText('Oxford International School')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^start|boshlash|начать/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /skip|o'tkazib|пропустить/i })).toBeInTheDocument();
  });

  it('Start remembers the intro and opens registration', async () => {
    openIntro();
    expect(hasSeenIntro()).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: /^start|boshlash|начать/i }));
    expect(screen.getByText('the registration form')).toBeInTheDocument();
    expect(hasSeenIntro()).toBe(true);
  });

  it('Skip remembers the intro and goes home', async () => {
    openIntro();
    await userEvent.click(screen.getByRole('button', { name: /skip|o'tkazib|пропустить/i }));
    expect(screen.getByText('the home page')).toBeInTheDocument();
    expect(hasSeenIntro()).toBe(true);
  });

  it('Escape skips, from anywhere on the page', async () => {
    openIntro();
    document.body.focus();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByText('the home page')).toBeInTheDocument();
  });

  it('puts the keyboard on Start, so Enter starts', async () => {
    openIntro();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^start|boshlash|начать/i }));
    await userEvent.keyboard('{Enter}');
    expect(screen.getByText('the registration form')).toBeInTheDocument();
  });
});
