/**
 * 27 Aug 2026: the "Test" button on a lesson row opened the lecture.
 *
 * In PhysicsTopicView it shared the row's onClick; in AstronomyTopicView it had
 * no handler at all and the click bubbled up to the row. The lesson quiz
 * (`/quiz/:category?lesson=<slug>`) existed the whole time — nothing linked to
 * it. This pins the button to the quiz, with the category pool as the
 * destination when the lesson comes from the static file and has no slug.
 */
import { createElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  slowApi: { post: vi.fn() },
  setupApiAuth: vi.fn(),
}));

let api;
let PhysicsTopicView;
let AstronomyTopicView;

beforeEach(async () => {
  ({ default: api } = await import('@/lib/api'));
  api.get.mockReset();
  ({ default: PhysicsTopicView } = await import('./PhysicsTopicView'));
  ({ default: AstronomyTopicView } = await import('./AstronomyTopicView'));
});

function Probe() {
  const { pathname, search } = useLocation();
  return <div data-testid="where">{pathname + search}</div>;
}

const tree = (sphere, lessonSlug) => ({
  topics: [{
    order: 1, slug: `${sphere}-topic`, title: 'Topic', color: '#0ff',
    lessons: [{ name: 'Lesson one', slug: lessonSlug, children: [] }],
  }],
});

function renderAt(subject, View) {
  return render(
    <MemoryRouter initialEntries={[`/learn/${subject}/1`]}>
      <Routes>
        <Route path={`/learn/${subject}/:topicId`} element={createElement(View)} />
        <Route path="/quiz/:category" element={<Probe />} />
        <Route path="*" element={<div data-testid="elsewhere"><Probe /></div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const testButtons = () => screen.getAllByRole('button', { name: /^(test|тест)$/i });

// The third value is the index of a lesson in the subject's static topic 1 that
// is still a bare title. `physics-kinematics` lessons 0-9 were written on
// 28 Aug 2026 and carry an explicit slug, so they have one even with the API
// down — which is the point of the two cases below being separate.
describe.each([
  ['physics', () => PhysicsTopicView, 10],
  ['astronomy', () => AstronomyTopicView, 0],
])('%s: the Test button', (subject, view, unwritten) => {
  it('opens the quiz for that lesson, not the lecture', async () => {
    api.get.mockResolvedValue({ data: tree(subject, `${subject}-lesson-one`) });
    renderAt(subject, view());
    await screen.findByText('Lesson one');

    fireEvent.click(testButtons()[0]);

    expect(screen.getByTestId('where')).toHaveTextContent(
      `/quiz/${subject}?lesson=${subject}-lesson-one`,
    );
    expect(screen.queryByTestId('elsewhere')).toBeNull();
  });

  it('falls back to the subject pool when the static lesson has no slug', async () => {
    api.get.mockRejectedValue(new Error('offline'));
    renderAt(subject, view());

    fireEvent.click(testButtons()[unwritten]);

    expect(screen.getByTestId('where')).toHaveTextContent(`/quiz/${subject}`);
    expect(screen.getByTestId('where')).not.toHaveTextContent('lesson=');
  });
});

describe('a written lesson with the API down', () => {
  it('still opens its own quiz, because the static file now carries its slug', async () => {
    // A lesson written in `src/data/*TopicsData.js` pins the slug it already
    // had, so the offline copy names the same row the server does.
    api.get.mockRejectedValue(new Error('offline'));
    renderAt('physics', PhysicsTopicView);

    fireEvent.click(testButtons()[0]);

    expect(screen.getByTestId('where')).toHaveTextContent(
      '/quiz/physics?lesson=physics-kinematics-basic-concepts-in-mechanics',
    );
  });
});
