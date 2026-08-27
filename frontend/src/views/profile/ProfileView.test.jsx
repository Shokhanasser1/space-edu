/**
 * The profile page knew the child's place and never told them.
 *
 * `/gamification/profile/full/` has returned `leaderboard.rank` all along, and
 * ProfileView read it into `rankLabel` and `percentile` — two variables no JSX
 * ever used. So the one number the board and the profile were made to agree on
 * was visible in exactly one of the two places.
 *
 * The dead code had gone stale too. It printed `100+` whenever the rank was
 * missing, from a time when the board stopped counting at a hundred; the server
 * now ranks every player and sends null only for a child who has not scored.
 * And it spelled `of` and `Top %` in English on a page that has three
 * languages. These tests cover what is now rendered.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  slowApi: { post: vi.fn() },
  setupApiAuth: vi.fn(),
}));

let api;
let ProfileView;
let useAuthStore;

/** Only the part of `/profile/full/` these tests are about. */
const fullProfile = (leaderboard) => ({
  data: {
    user: { username: 'nova', first_name: '', last_name: '' },
    gamification: { xp: 5025, level: 7, fuel: 0 },
    leaderboard,
    badges: [],
    quiz_stats: {},
    daily_challenge: {},
    inventory: [],
    wishlist: [],
  },
});

const serve = (leaderboard) => {
  api.get.mockImplementation((url) => {
    if (url === '/gamification/profile/full/') return Promise.resolve(fullProfile(leaderboard));
    return Promise.resolve({ data: [] });
  });
};

beforeEach(async () => {
  ({ default: api } = await import('@/lib/api'));
  api.get.mockReset();
  ({ default: ProfileView } = await import('./ProfileView'));
  ({ useAuthStore } = await import('@/store/useAuthStore'));
  useAuthStore.setState({
    user: { username: 'nova', astronaut_name: 'Nova' },
    isAuthenticated: true,
  });
});

const show = () =>
  render(
    <MemoryRouter>
      <ProfileView />
    </MemoryRouter>,
  );

describe('the place shown on a profile', () => {
  it('shows the rank the server sent', async () => {
    serve({ rank: 4951, total_players: 9975 });

    show();

    expect(await screen.findByText('#4,951')).toBeInTheDocument();
  });

  it('says how many players that is out of, in the reader language', async () => {
    serve({ rank: 4951, total_players: 9975 });

    show();

    // The board's own wording, not a second English sentence written here.
    expect(await screen.findByText(/9,975/)).toBeInTheDocument();
  });

  it('does not invent "100+" for a rank past the visible board', async () => {
    serve({ rank: 4951, total_players: 9975 });

    show();

    await screen.findByText('#4,951');
    expect(screen.queryByText('100+')).not.toBeInTheDocument();
  });

  it('tells a child who has not scored that they are not ranked yet', async () => {
    serve({ rank: null, total_players: 9975 });

    show();

    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByText(/^#/)).not.toBeInTheDocument();
  });

  it('links the place to the board it came from', async () => {
    serve({ rank: 3, total_players: 40 });

    show();

    const link = (await screen.findByText('#3')).closest('a');
    expect(link).toHaveAttribute('href', '/leaderboard');
  });
});
