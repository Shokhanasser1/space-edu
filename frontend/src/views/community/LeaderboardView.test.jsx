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
import { act, fireEvent, render, screen } from '@testing-library/react';
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

// Exactly the shape the endpoint returns — see apps/gamification/leaderboard.py.
// `rank` is the server's, not the row's position: tied players share one.
const entry = (display_name, xp, level = 1, extra = {}) => ({
  display_name, xp, level, rank: 1, is_you: false, ...extra,
});

beforeEach(async () => {
  ({ default: api } = await import('@/lib/api'));
  api.get.mockReset();
  ({ default: LeaderboardView } = await import('./LeaderboardView'));
  ({ useAuthStore } = await import('@/store/useAuthStore'));
  ({ useGamificationStore } = await import('@/store/useGamificationStore'));
  useAuthStore.setState({ user: null, isAuthenticated: false });
  useGamificationStore.setState({ xp: 0, level: 1 });
});

const serve = (leaderboard, extra = {}) =>
  api.get.mockResolvedValue({
    data: {
      leaderboard: leaderboard.map((row, i) => ({ ...row, rank: row.rank ?? i + 1 })),
      total_players: leaderboard.length,
      board_size: 100,
      poll_after_seconds: 30,
      ...extra,
    },
  });

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

/**
 * The board showed you a place you were not in, and then stopped.
 *
 * Two separate problems, both about the same missing habit of reading what the
 * server sends. `GET /gamification/leaderboard/` has always returned `my_rank`,
 * `my_xp` and `my_level`; this view ignored all three and instead pushed a row
 * built out of the browser's own persisted XP into the list, sorted it in, and
 * printed the array index beside it. A player ranked five thousandth was shown
 * sitting just under the last visible name — with whatever XP localStorage
 * happened to hold, which is optimistic by design and is never the truth.
 *
 * And the fetch ran once, on mount, so "live table" meant reloading the page.
 */
describe('the leaderboard shows your real place, and keeps itself current', () => {
  it('prints the place the server gives each row, not its position', async () => {
    // Three players level on 500 points are all first. Counting rows says
    // first, second and third, and disagrees with all three profile pages.
    serve([
      entry('Ayaz', 500, 3, { rank: 1 }),
      entry('Bek', 500, 3, { rank: 1 }),
      entry('Dilnoza', 500, 3, { rank: 1 }),
      entry('Kamola', 400, 3, { rank: 4 }),
    ]);
    const { container } = await renderBoard();
    await screen.findByText('Ayaz');

    expect(container.textContent).toContain('#1');
    expect(container.textContent).not.toContain('#2');
    expect(container.textContent).not.toContain('#3');
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('tells you your own place when you are past the last visible row', async () => {
    useAuthStore.setState({
      user: { username: 'kamola', astronaut_name: 'Kamola' },
      isAuthenticated: true,
    });
    serve([entry('Ayaz', 9000), entry('Bek', 8000)], {
      my_rank: 4951, my_xp: 120, my_level: 2, total_players: 9975,
    });
    await renderBoard();
    await screen.findByText('Ayaz');

    expect(screen.getByText(/4[\s,]?951/)).toBeInTheDocument();
    expect(screen.getByText(/9[\s,]?975/)).toBeInTheDocument();
  });

  it('never invents a row out of the number in the browser', async () => {
    // The store is optimistic and persisted; it is not the server's answer.
    useAuthStore.setState({
      user: { username: 'kamola', astronaut_name: 'Kamola' },
      isAuthenticated: true,
    });
    useGamificationStore.setState({ xp: 999999, level: 99 });
    serve([entry('Ayaz', 9000), entry('Bek', 8000)], {
      my_rank: 4951, my_xp: 120, my_level: 2, total_players: 9975,
    });
    const { container } = await renderBoard();
    await screen.findByText('Ayaz');

    expect(screen.queryByText('Kamola')).not.toBeInTheDocument();
    expect(container.textContent).not.toContain('999,999');
    expect(container.textContent).not.toContain('999999');
  });

  it('says nothing about a place for a player who has not scored yet', async () => {
    useAuthStore.setState({
      user: { username: 'kamola', astronaut_name: 'Kamola' },
      isAuthenticated: true,
    });
    serve([entry('Ayaz', 9000)], { my_rank: null, my_xp: 0, my_level: 1, total_players: 1 });
    const { container } = await renderBoard();
    await screen.findByText('Ayaz');

    expect(container.textContent).not.toMatch(/#null|#undefined|#NaN/);
    expect(screen.getByText(/join the rankings/i)).toBeInTheDocument();
  });

  it('highlights the row the server says is yours, not your namesake', async () => {
    // Two children may choose the same astronaut name. Matching on the name
    // put the highlight on both of them.
    useAuthStore.setState({
      user: { username: 'nebula2', astronaut_name: 'Nebula' },
      isAuthenticated: true,
    });
    serve([
      entry('Cosmo', 900, 4, { rank: 1 }),
      entry('Nebula', 800, 4, { rank: 2 }),
      entry('Vega', 700, 3, { rank: 3 }),
      entry('Nebula', 600, 3, { rank: 4, is_you: true }),
    ]);
    const { container } = await renderBoard();
    await screen.findAllByText('Nebula');

    const mine = [...container.querySelectorAll('[aria-current="true"]')];
    expect(mine).toHaveLength(1);
    expect(mine[0].textContent).toContain('4');
  });

  it('asks again on its own, at the interval the server sets', async () => {
    serve([entry('Ayaz', 900)], { poll_after_seconds: 30 });
    const started = vi.spyOn(globalThis, 'setInterval');
    await renderBoard();
    await screen.findByText('Ayaz');

    const scheduled = started.mock.calls.filter(([, delay]) => delay >= 30000);
    expect(scheduled.length).toBeGreaterThan(0);

    api.get.mockClear();
    await act(async () => {
      scheduled.at(-1)[0]();
    });
    expect(api.get).toHaveBeenCalledWith('/gamification/leaderboard/');
    started.mockRestore();
  });

  it('does not poll a tab nobody is looking at', async () => {
    // Ten thousand pages left open in background tabs are ten thousand
    // requests a minute for something nobody is reading.
    serve([entry('Ayaz', 900)]);
    const started = vi.spyOn(globalThis, 'setInterval');
    await renderBoard();
    await screen.findByText('Ayaz');

    const tick = started.mock.calls.filter(([, delay]) => delay >= 30000).at(-1)[0];
    const visibility = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    api.get.mockClear();
    await act(async () => { tick(); });

    expect(api.get).not.toHaveBeenCalled();
    Object.defineProperty(document, 'visibilityState', visibility ?? { value: 'visible', configurable: true });
    started.mockRestore();
  });

  it('stops asking when the page is left', async () => {
    serve([entry('Ayaz', 900)]);
    const started = vi.spyOn(globalThis, 'setInterval');
    const stopped = vi.spyOn(globalThis, 'clearInterval');
    const { unmount } = await renderBoard();
    await screen.findByText('Ayaz');

    const index = started.mock.calls.findIndex(([, delay]) => delay >= 30000);
    const handle = started.mock.results[index].value;
    unmount();

    expect(stopped.mock.calls.flat()).toContain(handle);
    started.mockRestore();
    stopped.mockRestore();
  });

  it('says the board could not be loaded rather than showing an empty one', async () => {
    // The failure was swallowed by an empty catch (C-10) and the page then
    // claimed there were no players.
    api.get.mockRejectedValue(new Error('502'));
    const { container } = await renderBoard();

    await vi.waitFor(() =>
      expect(container.textContent).not.toMatch(/Syncing|Sinxron|Синхрон/i),
    );
    expect(container.textContent).toMatch(/rankings/i);
  });
});


/**
 * The second board: accuracy, not XP.
 *
 * `GET /gamification/leaderboard/quiz/` ranked on the mean of a child's quiz
 * scores with no minimum number of attempts, so one lucky quiz at 100% stood
 * above fifty at 96 — and nothing in this front end called it at all, so the
 * board nobody could see was also the board nobody was fixing. The server now
 * applies the floor and sends `min_quizzes`, and this page shows the board and
 * says what the floor is.
 */
describe('the accuracy board', () => {
  const quizRow = (display_name, avg_percentage, total_quizzes, extra = {}) => ({
    display_name, avg_percentage, total_quizzes,
    best_percentage: avg_percentage, total_xp: 0, is_you: false, rank: 1, ...extra,
  });

  const serveBoth = (quiz) => {
    api.get.mockImplementation((url) => {
      if (url === '/gamification/leaderboard/quiz/') {
        return Promise.resolve({
          data: { category: 'all', board_size: 100, min_quizzes: 5, ...quiz },
        });
      }
      return Promise.resolve({
        data: {
          leaderboard: [{ ...entry('Ayaz', 900), rank: 1 }],
          total_players: 1, board_size: 100, poll_after_seconds: 30,
        },
      });
    });
  };

  const openIt = async () => {
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /accuracy/i }));
    });
  };

  it('is not fetched until the reader opens it', async () => {
    // Most readers never open this tab, and it is an aggregate over every quiz
    // session on the platform.
    serveBoth({ leaderboard: [], total_players: 0 });
    await renderBoard();
    expect(api.get).not.toHaveBeenCalledWith('/gamification/leaderboard/quiz/');

    await openIt();
    expect(api.get).toHaveBeenCalledWith('/gamification/leaderboard/quiz/');
  });

  it('shows the child who did the work, and the place the server gave them', async () => {
    serveBoth({
      leaderboard: [
        quizRow('Mehnatkash', 96.0, 50, { rank: 1 }),
        quizRow('Dilnoza', 96.0, 12, { rank: 1 }),
        quizRow('Bek', 80.0, 7, { rank: 3 }),
      ],
      total_players: 3,
    });
    await renderBoard();
    await openIt();

    expect(await screen.findByText('Mehnatkash')).toBeInTheDocument();
    // Tied children share a place, exactly as they do on the XP board — the
    // rank printed is the server's, not the row's position in the array.
    const places = [...document.querySelectorAll('.col-span-1')]
      .map((el) => el.textContent).filter((text) => /^\d+$/.test(text));
    expect(places).toEqual(['1', '1', '3']);
  });

  it('tells a child who is not on it why, in the number the server applies', async () => {
    serveBoth({ leaderboard: [], total_players: 0, min_quizzes: 5 });
    await renderBoard();
    await openIt();

    expect(await screen.findByText(/5/)).toBeInTheDocument();
    expect(screen.getByText(/5 quizzes/i)).toBeInTheDocument();
  });

  it('does not go blank and silent when the request fails', async () => {
    // C-10: an empty board reads as "nobody has taken a quiz", which is a
    // different claim from "we could not ask".
    api.get.mockImplementation((url) => (
      url === '/gamification/leaderboard/quiz/'
        ? Promise.reject(new Error('502'))
        : Promise.resolve({
          data: {
            leaderboard: [{ ...entry('Ayaz', 900), rank: 1 }],
            total_players: 1, board_size: 100, poll_after_seconds: 30,
          },
        })
    ));
    await renderBoard();
    await openIt();

    expect(await screen.findByText(/could not be loaded/i)).toBeInTheDocument();
  });

  it('stops polling the XP board while the reader is on this one', async () => {
    serveBoth({ leaderboard: [], total_players: 0 });
    const started = vi.spyOn(globalThis, 'setInterval');
    await renderBoard();
    await openIt();

    const tick = started.mock.calls.filter(([, delay]) => delay >= 30000).at(-1)[0];
    api.get.mockClear();
    await act(async () => { tick(); });
    expect(api.get).not.toHaveBeenCalledWith('/gamification/leaderboard/');
    started.mockRestore();
  });
});
