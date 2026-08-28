/**
 * Two things the Masalalar screen was handed by the server and did not use.
 *
 * 1. The question, in the reader's language. `ProblemSerializer` sends
 *    `question`, `question_en` and `question_ru` — the same three-field shape
 *    the quiz questions use — and the view rendered `problem.question` flat, so
 *    an English or Russian reader got the Uzbek original. `questionText()` in
 *    lib/questionText.js already did exactly this job for the quiz; there was no
 *    reason for a second way of doing it, and this uses the existing one.
 *
 * 2. The explanation. `POST /courses/problems/<id>/check/` answers
 *    `{ correct, answer, explanation }`, and a wrong answer showed the answer
 *    and dropped the explanation on the floor. The explanation is the teaching
 *    — a child who got it wrong was shown what the answer is and never why.
 *
 * Both are the shape this repository keeps finding: the server sends the field,
 * the client drops it (TopicLesson.content until 24 Aug, TopicLesson.name_en
 * until today).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  slowApi: { post: vi.fn() },
  setupApiAuth: vi.fn(),
}));

let api;
let useUserStore;
let ProblemDetailView;

const PROBLEM = {
  id: 7,
  number: 3,
  question: "Jism 20 m/s tezlik bilan harakatlanmoqda. 5 sekundda qancha yo'l bosadi?",
  question_en: 'A body moves at 20 m/s. How far does it travel in 5 seconds?',
  question_ru: 'Тело движется со скоростью 20 м/с. Какой путь оно пройдёт за 5 секунд?',
  difficulty: 'easy',
};

beforeEach(async () => {
  ({ default: api } = await import('@/lib/api'));
  api.get.mockReset();
  api.post.mockReset();
  api.get.mockResolvedValue({ data: [PROBLEM] });
  ({ useUserStore } = await import('@/store/useUserStore'));
  ({ default: ProblemDetailView } = await import('./ProblemDetailView'));
});

function renderIn(storeLanguage) {
  useUserStore.setState({ language: storeLanguage });
  return render(
    <MemoryRouter initialEntries={['/learn/problems/3']}>
      <Routes>
        <Route path="/learn/problems/:id" element={<ProblemDetailView />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('the question', () => {
  it('is in Russian for a Russian reader', async () => {
    renderIn('RUS');
    expect(await screen.findByText(PROBLEM.question_ru)).toBeInTheDocument();
    expect(screen.queryByText(PROBLEM.question)).toBeNull();
  });

  it('is in English for an English reader', async () => {
    renderIn('ENG');
    expect(await screen.findByText(PROBLEM.question_en)).toBeInTheDocument();
    expect(screen.queryByText(PROBLEM.question)).toBeNull();
  });

  it('is the Uzbek original for an Uzbek reader', async () => {
    renderIn('UZB');
    expect(await screen.findByText(PROBLEM.question)).toBeInTheDocument();
  });

  it('falls back to the Uzbek original when a translation is missing', async () => {
    // Which is every one of the 30 seeded problems today: the exporter writes
    // question_en and question_ru as ''.
    api.get.mockResolvedValue({ data: [{ ...PROBLEM, question_en: '', question_ru: '' }] });
    renderIn('ENG');
    expect(await screen.findByText(PROBLEM.question)).toBeInTheDocument();
  });
});

describe('a wrong answer', () => {
  it('shows the explanation the server sent, not just the answer', async () => {
    api.post.mockResolvedValue({
      data: {
        correct: false,
        answer: '100 m',
        explanation: 'Tekis harakatda s = v · t = 20 · 5 = 100 m.',
      },
    });
    renderIn('UZB');
    await screen.findByText(PROBLEM.question);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '40' } });
    fireEvent.submit(screen.getByRole('textbox').closest('form'));

    await waitFor(() => expect(screen.getByText('100 m')).toBeInTheDocument());
    expect(screen.getByText('Tekis harakatda s = v · t = 20 · 5 = 100 m.')).toBeInTheDocument();
  });

  it('says nothing extra when the problem has no explanation written', async () => {
    api.post.mockResolvedValue({ data: { correct: false, answer: '100 m', explanation: '' } });
    renderIn('UZB');
    await screen.findByText(PROBLEM.question);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '40' } });
    fireEvent.submit(screen.getByRole('textbox').closest('form'));

    await waitFor(() => expect(screen.getByText('100 m')).toBeInTheDocument());
    expect(screen.queryByTestId('problem-explanation')).toBeNull();
  });
});

/**
 * The list screen printed "PROBLEMS", "Masalalar" and "N / M solved" as
 * literals, over the top of `learnViews.problemsTitle` and `problemsDesc` —
 * which have existed in all three locales the whole time and were never read.
 */
describe('the problems list header', () => {
  let ProblemsView;

  beforeEach(async () => {
    ({ default: ProblemsView } = await import('./ProblemsView'));
  });

  const renderList = (storeLanguage) => {
    useUserStore.setState({ language: storeLanguage });
    return render(
      <MemoryRouter initialEntries={['/learn/problems']}>
        <Routes>
          <Route path="/learn/problems" element={<ProblemsView />} />
        </Routes>
      </MemoryRouter>,
    );
  };

  it('is in Russian for a Russian reader', async () => {
    renderList('RUS');
    expect(await screen.findAllByRole('heading', { name: 'Задачи' })).not.toHaveLength(0);
    expect(screen.queryByText('PROBLEMS')).toBeNull();
    expect(screen.queryByText(/solved/i)).toBeNull();
  });

  it('is in Uzbek for an Uzbek reader', async () => {
    renderList('UZB');
    expect(await screen.findAllByRole('heading', { name: 'Masalalar' })).not.toHaveLength(0);
    expect(screen.queryByText(/solved/i)).toBeNull();
  });
});
