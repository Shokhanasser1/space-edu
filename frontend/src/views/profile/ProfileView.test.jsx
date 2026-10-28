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

/*
 * Audit, 21 Oct 2026: a lesson's score was whatever the lesson page reported
 * about itself (always 100). The server now scores a lesson only from its test,
 * so a lesson read but not tested comes back with score 0 — and printing
 * "Score 0%" beside it would read as a failed lesson.
 */
describe('a finished lesson', () => {
  const lessons = (rows) => {
    api.get.mockImplementation((url) => {
      if (url === '/gamification/profile/full/') {
        return Promise.resolve(fullProfile({ rank: null, total_players: 0 }));
      }
      if (url === '/progress/') return Promise.resolve({ data: { lessons: rows, enrollments: [] } });
      return Promise.resolve({ data: [] });
    });
  };

  it('shows no score until its test has been taken', async () => {
    lessons([{ lesson_slug: 'kin-one', score: 0, is_mastered: false }]);
    show();
    const title = await screen.findByText('kin-one');
    expect(title.parentElement.textContent).not.toMatch(/%/);
  });

  it('shows the test result once there is one', async () => {
    lessons([{ lesson_slug: 'kin-one', score: 80, is_mastered: true }]);
    show();
    const title = await screen.findByText('kin-one');
    expect(title.parentElement.textContent).toMatch(/80%/);
  });
});

/**
 * Audit, 28 October 2026: mission progress was worked out in the browser. A
 * streak mission read 0% until its own button was pressed, and the button
 * stayed disabled until 100% -- no pupil could ever claim one. A daily
 * lesson mission counted lessons ever finished, so it offered a reward the
 * server refused. The page shows the server's number now.
 */
describe('a mission', () => {
  const missions = (rows) => {
    api.get.mockImplementation((url) => {
      if (url === '/gamification/profile/full/') {
        const full = fullProfile({ rank: null, total_players: 0 });
        full.data.missions = rows;
        return Promise.resolve(full);
      }
      if (url === '/progress/') {
        return Promise.resolve({ data: { lessons: [{ lesson_slug: 'old', score: 0 }], enrollments: [] } });
      }
      return Promise.resolve({ data: [] });
    });
  };
  const mission = (overrides) => ({
    mission: {
      id: 1, slug: 'm', title_en: 'Mission', description_en: '', reward_fuel: 10, reward_xp: 0,
      target_value: 3, is_daily: false, mission_type: 'streak', ...overrides,
    },
    is_completed: false,
  });

  it('can be claimed once the server says the streak has reached it', async () => {
    missions([{ ...mission({ title_en: 'Three days running' }), progress: 3 }]);
    show();
    await screen.findByText('Three days running');
    expect(screen.getByRole('button', { name: 'Claim Reward' })).toBeEnabled();
  });

  it('is shown in the reader language, not always in English', async () => {
    const { useUserStore } = await import('@/store/useUserStore');
    useUserStore.getState().setLanguage('RUS');
    missions([{ ...mission({ title_en: 'Three days running', title_ru: 'Три дня подряд' }), progress: 3 }]);
    show();
    expect(await screen.findByText('Три дня подряд')).toBeInTheDocument();
    expect(screen.queryByText('Three days running')).toBeNull();
    useUserStore.getState().setLanguage('ENG');
  });

  it('is not offered for a lesson finished on another day', async () => {
    missions([{
      ...mission({ title_en: 'A lesson today', mission_type: 'lesson', target_value: 1, is_daily: true }),
      progress: 0,
    }]);
    show();
    await screen.findByText('A lesson today');
    expect(screen.queryByRole('button', { name: 'Claim Reward' })).toBeNull();
  });
});
