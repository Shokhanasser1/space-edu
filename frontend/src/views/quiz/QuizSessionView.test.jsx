/**
 * The quiz runs on the server now.
 *
 * Two findings, one old and one from the second pass:
 *
 * - The category guard was `if (!quizData[category] || questions.length === 0)`.
 *   For `/quiz/constructor` that reads Object.prototype.constructor — truthy,
 *   with `.length` 1 rather than 0 — so both halves passed and the component
 *   went on to render `currentQ.text` on `undefined`. Fixed once with
 *   `Object.hasOwn`; the category is now checked against a fixed list on the
 *   server, which removes the object-lookup entirely.
 * - `quizData.js` carried the correct answer to all 24 questions into the
 *   browser bundle, and the score was computed here from that key. The XP it
 *   showed was never persisted: `addXp` is a local optimistic update, so the
 *   number went up and the next profile fetch wiped it.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  slowApi: { post: vi.fn() },
  setupApiAuth: vi.fn(),
}));

let api;
let QuizSessionView;

const question = (id, text) => ({
  id, category: 'physics', difficulty: 'easy',
  question: text, question_en: text, question_ru: text,
  options: ['A', 'B', 'C', 'D'], time_seconds: 60,
});

beforeEach(async () => {
  ({ default: api } = await import('@/lib/api'));
  api.get.mockReset();
  api.post.mockReset();
  api.get.mockResolvedValue({ data: {} });
  ({ default: QuizSessionView } = await import('./QuizSessionView'));
});

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/quiz/:category" element={<QuizSessionView />} />
      </Routes>
    </MemoryRouter>,
  );
}

function startsWith(questions) {
  api.post.mockImplementation((url) => {
    if (url.includes('/quiz/start/')) {
      return Promise.resolve({
        data: { session_id: 7, category: 'physics', total: questions.length, questions },
      });
    }
    return Promise.resolve({ data: { score: 1, total: 1, percentage: 100, xp_earned: 70 } });
  });
}

describe('the answer key does not reach the browser', () => {
  it('the question payload carries no correct answer', async () => {
    startsWith([question(1, 'Tezlik nima?')]);
    renderAt('/quiz/physics');

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [, body] = api.post.mock.calls[0];
    expect(body).not.toHaveProperty('answers');

    // Whatever the view renders, it never had an answer to render.
    const payload = await api.post.mock.results[0].value;
    for (const q of payload.data.questions) {
      expect(q).not.toHaveProperty('correct_answer');
      expect(q).not.toHaveProperty('correctAnswer');
    }
  });

  it('the static answer files are gone from the tree', () => {
    // Vite resolves imports at transform time, so importing a deleted module is
    // a build error rather than a rejected promise — check the filesystem.
    expect(existsSync(resolve(__dirname, '../../data/quizData.js'))).toBe(false);
    expect(existsSync(resolve(__dirname, '../../data/problemsData.js'))).toBe(false);
  });
});

describe('category handling', () => {
  // The old hole: these are Object.prototype members, so a lookup on a plain
  // object returns something truthy for every one of them.
  const PROTOTYPE_KEYS = [
    'constructor', 'hasOwnProperty', 'isPrototypeOf',
    'propertyIsEnumerable', 'toString', 'valueOf', '__proto__',
  ];

  it.each(PROTOTYPE_KEYS)('does not crash on /quiz/%s', async (key) => {
    api.post.mockRejectedValue({ response: { status: 400 } });
    expect(() => renderAt(`/quiz/${key}`)).not.toThrow();
    expect(await screen.findByText(/not found or empty/i)).toBeInTheDocument();
  });

  it('an unknown category shows the empty screen rather than throwing', async () => {
    api.post.mockRejectedValue({ response: { status: 400 } });
    renderAt('/quiz/astrology');
    expect(await screen.findByText(/not found or empty/i)).toBeInTheDocument();
  });

  it('a category with no questions shows the empty screen', async () => {
    api.post.mockResolvedValue({ data: { session_id: 1, questions: [] } });
    renderAt('/quiz/physics');
    expect(await screen.findByText(/not found or empty/i)).toBeInTheDocument();
  });

  it('a real category renders its first question', async () => {
    startsWith([question(1, 'Tezlik nima?')]);
    renderAt('/quiz/physics');
    expect(await screen.findByText('Tezlik nima?')).toBeInTheDocument();
  });
});

describe('lesson quizzes', () => {
  it('a ?lesson= parameter asks for that lesson, not the category', async () => {
    startsWith([question(1, 'Tezlik nima?')]);
    renderAt('/quiz/physics?lesson=kin-one');

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith('/challenges/quiz/start/', { lesson: 'kin-one' });
  });

  it('without it, the category is what is asked for', async () => {
    startsWith([question(1, 'Tezlik nima?')]);
    renderAt('/quiz/physics');

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith(
      '/challenges/quiz/start/', { category: 'physics', count: 10 },
    );
  });
});

describe('a lesson with no questions yet', () => {
  // 27 Aug 2026: the "Test" button on every lesson row links to
  // `?lesson=<slug>`, and no lesson has questions attached yet — that is
  // admin-panel work. Until it is done, the button must still open a test:
  // the subject's pool, labelled as such rather than as the lesson's quiz.
  const lessonMissingThenPool = () => {
    api.post.mockImplementation((url, body) => {
      if (url.includes('/quiz/start/') && body.lesson) {
        return Promise.reject({ response: { status: 404, data: { detail: 'This lesson has no questions yet.' } } });
      }
      if (url.includes('/quiz/start/')) {
        return Promise.resolve({
          data: { session_id: 8, category: body.category, total: 1, questions: [question(1, 'Tezlik nima?')] },
        });
      }
      return Promise.resolve({ data: {} });
    });
  };

  it('falls back to the subject pool and says so', async () => {
    lessonMissingThenPool();
    renderAt('/quiz/physics?lesson=physics-kinematics-basic-concepts-in-mechanics');

    expect(await screen.findByText('Tezlik nima?')).toBeInTheDocument();
    expect(screen.queryByText(/lesson quiz|квиз по уроку/i)).toBeNull();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/physics|физика/i);

    const bodies = api.post.mock.calls.map(([, body]) => body);
    expect(bodies[0]).toEqual({ lesson: 'physics-kinematics-basic-concepts-in-mechanics' });
    expect(bodies[1]).toEqual({ category: 'physics', count: 10 });
  });

  /*
   * 28 Aug 2026, doc item 4 — "testlar ham ishlashi shart".
   *
   * Swapping the subject pool in was half of it. The other half is saying so:
   * the child pressed Test on one lesson and got ten questions about the whole
   * of physics, under a heading reading "Physics" and nothing to explain it.
   * That teaches them the lesson's test covers anything at all, which is worse
   * than an empty screen — an empty screen is at least true.
   */
  it("tells the reader the questions are not this lesson's own", async () => {
    lessonMissingThenPool();
    renderAt('/quiz/physics?lesson=physics-kinematics-basic-concepts-in-mechanics');

    expect(await screen.findByText('Tezlik nima?')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/no test of its own yet/i);
  });

  it('says nothing of the sort when the lesson does have its own test', async () => {
    startsWith([question(1, 'Tezlik nima?')]);
    renderAt('/quiz/physics?lesson=physics-dynamics-newtons-second-law');

    expect(await screen.findByText('Tezlik nima?')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it.each([
    ['RUS', /собственного теста/i],
    ['UZB', /o'z testi yo'q/i],
  ])('%s reads the notice in their own language', async (language, expected) => {
    const { useUserStore } = await import('@/store/useUserStore');
    useUserStore.setState({ language });
    try {
      lessonMissingThenPool();
      renderAt('/quiz/physics?lesson=physics-kinematics-basic-concepts-in-mechanics');

      expect(await screen.findByText('Tezlik nima?')).toBeInTheDocument();
      // Not the English string falling through the translation helper.
      expect(screen.getByRole('status')).toHaveTextContent(expected);
    } finally {
      useUserStore.setState({ language: 'ENG' });
    }
  });

  it('names the lesson, not the category, when there is nothing to fall back to', async () => {
    // The subject pool can fail too — an unreachable server, or a subject that
    // is not one of the server's quiz categories. "Category not found or empty"
    // then answers a question the child never asked: they pressed Test on a
    // lesson, and the lesson is what the screen has to talk about.
    api.post.mockRejectedValue({ response: { status: 404 } });
    renderAt('/quiz/physics?lesson=physics-optics-lenses');

    expect(await screen.findByText(/this lesson has no test yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/category not found/i)).toBeNull();
  });
});

describe('a Russian reader', () => {
  it('sees the answers in Russian, not only the question', async () => {
    const { useUserStore } = await import('@/store/useUserStore');
    useUserStore.setState({ language: 'RUS' });
    try {
      startsWith([{
        ...question(1, 'Tezlik nima?'), question_ru: 'Что такое скорость?',
        options_ru: ['Один', 'Два', 'Три', 'Четыре'],
      }]);
      renderAt('/quiz/physics');

      expect(await screen.findByText('Что такое скорость?')).toBeInTheDocument();
      expect(screen.getByText('Четыре')).toBeInTheDocument();
      expect(screen.queryByText('D')).not.toBeNull();
      expect(screen.queryByText(/^A$/)).not.toBeNull();
    } finally {
      useUserStore.setState({ language: 'ENG' });
    }
  });
});
