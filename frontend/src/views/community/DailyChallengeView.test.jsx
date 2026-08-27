/**
 * Doc item 9, "Daily challange" — the screen half.
 *
 * Five things this covers, all found by driving the real page against a real
 * server on 27 August 2026:
 *
 * - The page rendered every question in Uzbek whatever the reader's language.
 *   `useTranslation()` returns 'ENG' / 'RUS' / 'UZB' and `questionText` wants
 *   'en' / 'ru' / 'uz', so the lookup missed and fell through to the Uzbek
 *   original — on an English page, one day after the translations landed.
 * - Every answer you picked turned red. The green/red branch reads a
 *   `correctAnswers` map that is null until after the submit at the very end,
 *   so the "wrong" styling was the only one that could ever apply. Answering
 *   correctly and being told so in red is worse than no feedback.
 * - Nothing was ever explained. The submit response carried a map of correct
 *   indices, the results screen showed a score, and a child who got two wrong
 *   left knowing exactly what they knew when they arrived.
 * - Every question got 15 seconds, including "the first half of the road at
 *   60 km/h, the second at 40 — find the average speed".
 * - "Already completed" came from localStorage rather than from the server,
 *   which the same response already answers. Clear site data, or open the page
 *   on a second device, and the child replays the whole thing for a 400.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  slowApi: { post: vi.fn() },
  setupApiAuth: vi.fn(),
}));

let api;
let DailyChallengeView;
let useGamificationStore;
let useUserStore;

const QUESTION = {
  id: 11,
  category: 'astronomy',
  difficulty: 'easy',
  question: 'Qaysi sayyora Qizil sayyora deb ataladi?',
  question_en: 'Which planet is known as the Red Planet?',
  question_ru: 'Какую планету называют Красной планетой?',
  options: ['Venera', 'Mars', 'Yupiter', 'Saturn'],
  options_en: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
  options_ru: ['Венера', 'Марс', 'Юпитер', 'Сатурн'],
  time_seconds: 90,
};

const REVIEW = {
  id: 11,
  question: QUESTION.question,
  question_en: QUESTION.question_en,
  question_ru: QUESTION.question_ru,
  options: QUESTION.options,
  options_en: QUESTION.options_en,
  options_ru: QUESTION.options_ru,
  correct_answer: 1,
  explanation: 'Mars temir oksidiga boy chang bilan qoplangan.',
  explanation_en: 'Mars is covered in dust rich in iron oxide — rust.',
  explanation_ru: 'Марс покрыт пылью, богатой оксидом железа.',
  selected: 0,
  is_correct: false,
};

function today(extra = {}) {
  api.get.mockImplementation((url) => {
    if (url.includes('/challenges/today/')) {
      return Promise.resolve({
        data: {
          id: 1, date: '2026-08-27', question_count: 1, time_limit: 15,
          xp_per_correct: 50, xp_completion_bonus: 100, fuel_reward: 20,
          questions: [QUESTION], already_completed: false, ...extra,
        },
      });
    }
    return Promise.resolve({ data: {} });
  });
}

function submitReturns(data) {
  api.post.mockResolvedValue({ data });
}

const RESULT = {
  result: { id: 3, score: 0, total: 1, xp_earned: 100, fuel_earned: 20, time_taken: 9 },
  streak: { current_streak: 1, longest_streak: 1, last_completed: '2026-08-27' },
  review: [REVIEW],
};

beforeEach(async () => {
  ({ default: api } = await import('@/lib/api'));
  ({ useGamificationStore } = await import('@/store/useGamificationStore'));
  ({ useUserStore } = await import('@/store/useUserStore'));
  api.get.mockReset();
  api.post.mockReset();
  today();
  submitReturns(RESULT);
  useGamificationStore.setState({ dailyChallengeCompleted: false, lastPlayDate: null });
  useUserStore.setState({ language: 'ENG' });
  ({ default: DailyChallengeView } = await import('./DailyChallengeView'));
});

const renderView = () => render(<MemoryRouter><DailyChallengeView /></MemoryRouter>);

describe('the reader language', () => {
  it('an English reader gets the English question and the English options', async () => {
    renderView();
    expect(await screen.findByText('Which planet is known as the Red Planet?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jupiter' })).toBeInTheDocument();
    expect(screen.queryByText('Yupiter')).toBeNull();
  });

  it('a Russian reader gets the Russian question and the Russian options', async () => {
    useUserStore.setState({ language: 'RUS' });
    renderView();
    expect(await screen.findByText('Какую планету называют Красной планетой?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Юпитер' })).toBeInTheDocument();
  });
});

describe('the clock', () => {
  it('gives the question the working time the server sent, not a flat 15 seconds', async () => {
    renderView();
    await screen.findByText('Which planet is known as the Red Planet?');

    // Asserting exactly 90 would race the countdown on a slow run. The point
    // is where the number came from: the question's own `time_seconds`, not
    // the 15 the view hardcoded and not the challenge-wide `time_limit`, which
    // this payload also sets to 15.
    const clock = screen.getByText(/^\d+s$/);
    expect(Number.parseInt(clock.textContent, 10)).toBeGreaterThan(60);
  });
});

describe('answering', () => {
  it('does not paint the answer you chose red before anything has been marked', async () => {
    renderView();
    await screen.findByText('Which planet is known as the Red Planet?');

    const mars = screen.getByRole('button', { name: 'Mars' });
    await userEvent.click(mars);

    // Nothing on the page has told the child they were wrong, because nothing
    // on the page knows yet.
    expect(mars.className).not.toMatch(/red/);
  });
});

describe('the results screen', () => {
  it('explains the questions that were got wrong, in the reader language', async () => {
    renderView();
    await screen.findByText('Which planet is known as the Red Planet?');
    await userEvent.click(screen.getByRole('button', { name: 'Venus' }));
    await userEvent.click(screen.getByRole('button', { name: /finish/i }));

    expect(
      await screen.findByText(/Mars is covered in dust rich in iron oxide/),
    ).toBeInTheDocument();
  });

  it('shows the XP the server actually awarded rather than recomputing it', async () => {
    submitReturns({
      ...RESULT,
      result: { ...RESULT.result, score: 1, xp_earned: 275 },
      review: [{ ...REVIEW, selected: 1, is_correct: true }],
    });
    renderView();
    await screen.findByText('Which planet is known as the Red Planet?');
    await userEvent.click(screen.getByRole('button', { name: 'Mars' }));
    await userEvent.click(screen.getByRole('button', { name: /finish/i }));

    expect(await screen.findByText(/275/)).toBeInTheDocument();
    // 1 × 50 + 100 is what the screen used to compute for itself.
    expect(screen.queryByText(/^150$/)).toBeNull();
  });

  it('says so when the score did not save, rather than showing a number that will vanish', async () => {
    api.post.mockRejectedValue(new Error('network'));
    renderView();
    await screen.findByText('Which planet is known as the Red Planet?');
    await userEvent.click(screen.getByRole('button', { name: 'Venus' }));
    await userEvent.click(screen.getByRole('button', { name: /finish/i }));

    expect(await screen.findByText(/could not be saved|не удалось|saqlanmadi/i)).toBeInTheDocument();
  });
});

describe('whether today is already done', () => {
  it('believes the server over the browser', async () => {
    // A second device, or a cleared site data: nothing local says it is done,
    // and the server has already said that it is.
    today({ already_completed: true });
    renderView();

    expect(await screen.findByText(/already completed/i)).toBeInTheDocument();
    expect(screen.queryByText('Which planet is known as the Red Planet?')).toBeNull();
  });

  it('runs the challenge when the server says it is not done, whatever the browser remembers', async () => {
    useGamificationStore.setState({ dailyChallengeCompleted: true });
    renderView();
    expect(await screen.findByText('Which planet is known as the Red Planet?')).toBeInTheDocument();
  });
});

describe('a day with nothing in it', () => {
  it('says so instead of rendering a blank page', async () => {
    today({ questions: [] });
    const { container } = renderView();

    await waitFor(() => expect(container.textContent.trim()).not.toBe(''));
    expect(container.textContent).toMatch(/no questions|нет вопросов|savol yo/i);
  });
});
