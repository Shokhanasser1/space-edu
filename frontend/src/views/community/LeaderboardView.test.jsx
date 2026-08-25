/**
 * The leaderboard rendered nameless players and listed you twice.
 *
 * `GET /gamification/leaderboard/` deliberately returns `display_name`, `xp`
 * and `level` and nothing else — no username, no real name, no avatar URL.
 * That is the fix for "the public leaderboard published children's real names
 * and photos" (docs/HANDOVER.md). This view was never updated to match: it
 * still read `username`, `first_name` and `avatar_url`, all of which are
 * absent, so every row rendered with an undefined name, an undefined React key
 * — the "unique key prop" warning — and an `isCurrentUser` that could never be
 * true. That last one is why the signed-in player was pushed in as an extra
 * row and appeared on the board twice.
 *
 * These tests pin the contract, not the markup: what the server sends is what
 * the board must read, and the withheld fields must stay withheld.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  slowApi: { post: vi.fn() },
  setupApiAuth: vi.fn(),
}));

let api;
let LeaderboardView;
let useAuthStore;
let useGamificationStore;

// Exactly the shape the endpoint returns — see LeaderboardSerializer.
const entry = (display_name, xp, level = 1) => ({ display_name, xp, level });

beforeEach(async () => {
  ({ default: api } = await import('@/lib/api'));
  api.get.mockReset();
  ({ default: LeaderboardView } = await import('./LeaderboardView'));
  ({ useAuthStore } = await import('@/store/useAuthStore'));
  ({ useGamificationStore } = await import('@/store/useGamificationStore'));
  useAuthStore.setState({ user: null, isAuthenticated: false });
  useGamificationStore.setState({ xp: 0, level: 1 });
});

const serve = (leaderboard) =>
  api.get.mockResolvedValue({ data: { leaderboard, total_players: leaderboard.length } });

async function renderBoard() {
  const view = render(
    <MemoryRouter>
      <LeaderboardView />
    </MemoryRouter>,
  );
  // The board is behind a loading flag set in a .finally().
  await screen.findByAltText('Nebula', {}, { timeout: 2000 }).catch(() => {});
  return view;
}

describe('the leaderboard reads what the server actually sends', () => {
  it('shows each player by display_name', async () => {
    serve([entry('Nebula', 300), entry('Quasar', 200)]);
    await renderBoard();

    expect(await screen.findByText('Nebula')).toBeInTheDocument();
    expect(screen.getByText('Quasar')).toBeInTheDocument();
  });

  it('never prints "undefined" where a name belongs', async () => {
    serve([entry('Nebula', 300), entry('Quasar', 200)]);
    const { container } = await renderBoard();
    await screen.findByText('Nebula');

    expect(container.textContent).not.toMatch(/undefined/i);
  });

  it('lists the signed-in player once, not twice', async () => {
    // The board already contains this player. Before the fix `isCurrentUser`
    // compared `e.username` — undefined — against the user's, never matched,
    // and a second row was appended for them.
    useAuthStore.setState({
      user: { username: 'nebula@cosmos.uz', astronaut_name: 'Nebula' },
      isAuthenticated: true,
    });
    serve([entry('Nebula', 300), entry('Quasar', 200)]);
    await renderBoard();
    await screen.findByText('Nebula');

    expect(screen.getAllByText('Nebula')).toHaveLength(1);
  });

  it('falls back to username when the player set no astronaut name', async () => {
    // The server's own fallback is `astronaut_name or username`; the client
    // has to mirror it or the highlight misses.
    useAuthStore.setState({
      user: { username: 'quasar', astronaut_name: '' },
      isAuthenticated: true,
    });
    serve([entry('quasar', 200)]);
    await renderBoard();

    expect(await screen.findByText('quasar')).toBeInTheDocument();
    expect(screen.getAllByText('quasar')).toHaveLength(1);
  });

  it('shows a board of two rather than claiming nobody is here', async () => {
    // The empty state was gated on `all.length < 3`, which only ever passed
    // because the duplicate row padded the count.
    serve([entry('Nebula', 300), entry('Quasar', 200)]);
    await renderBoard();

    expect(await screen.findByText('Nebula')).toBeInTheDocument();
  });

  it('still says the board is empty when it is', async () => {
    serve([]);
    const { container } = await renderBoard();

    await vi.waitFor(() => expect(container.textContent).not.toMatch(/Nebula/));
    expect(screen.queryByText('Nebula')).not.toBeInTheDocument();
  });

  it('asks the avatar service for a seed, never for a stored photo', async () => {
    // The endpoint sends no avatar URL on purpose. If this view ever renders
    // one again, children's photographs are back on a public page.
    serve([entry('Nebula', 300)]);
    const { container } = await renderBoard();
    await screen.findByText('Nebula');

    const images = [...container.querySelectorAll('img')];
    expect(images.length).toBeGreaterThan(0);
    for (const img of images) {
      expect(img.getAttribute('src')).toContain('dicebear');
      expect(img.getAttribute('src')).not.toMatch(/undefined/);
    }
  });
});
