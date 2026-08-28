/**
 * 28 Aug 2026: the "Lab" button on a lesson row opened the lecture.
 *
 * The same defect `TopicTestButton.test.jsx` pinned for the "Test" button was
 * still live on the one beside it, in all three screens that draw it:
 *
 *   PhysicsTopicView  the Lab pill was handed the row's own `onClick`
 *   SubTopicView      both pills were handed the row's own `onClick`
 *   AstronomyTopicView the Lab button had no handler at all, so the click
 *                     bubbled to the row — the exact shape of the Test bug
 *
 * A pupil pressing "Lab" got the lecture they were already looking at. There is
 * no per-lesson laboratory to send them to, so the button goes to `/lab`, the
 * laboratory that exists. Sending them somewhere real is the fix; inventing a
 * lesson-specific lab is not this ticket's job.
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
let SubTopicView;

beforeEach(async () => {
  ({ default: api } = await import('@/lib/api'));
  api.get.mockReset();
  ({ default: PhysicsTopicView } = await import('./PhysicsTopicView'));
  ({ default: AstronomyTopicView } = await import('./AstronomyTopicView'));
  ({ default: SubTopicView } = await import('./SubTopicView'));
});

function Probe() {
  const { pathname } = useLocation();
  return <div data-testid="where">{pathname}</div>;
}

/** The Lab pill, in whichever of the three languages the store came up in. */
const labButtons = () => screen.getAllByRole('button', { name: /^(lab|лаб)$/i });

// One lesson, no children — what a physics or astronomy topic row is.
const flatTree = (sphere) => ({
  topics: [{
    order: 1, slug: `${sphere}-topic`, title: 'Topic', color: '#0ff',
    lessons: [{ name: 'Lesson one', slug: `${sphere}-lesson-one`, children: [] }],
  }],
});

// One lesson with parts — what SubTopicView lists.
const nestedTree = {
  topics: [{
    order: 1, slug: 'astronomy-topic', title: 'Topic', color: '#0ff',
    lessons: [{
      name: 'Lesson one', slug: 'astronomy-lesson-one',
      children: [{ name: 'Part one', slug: 'astronomy-part-one', children: [] }],
    }],
  }],
};

describe.each([
  ['physics', () => PhysicsTopicView, '/learn/physics/1'],
  ['astronomy', () => AstronomyTopicView, '/learn/astronomy/1'],
])('%s: the Lab button', (subject, view, entry) => {
  it('opens the laboratory, not the lecture', async () => {
    api.get.mockResolvedValue({ data: flatTree(subject) });
    render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path={`/learn/${subject}/:topicId`} element={createElement(view())} />
          <Route path="/lab" element={<Probe />} />
          <Route path="*" element={<div data-testid="elsewhere"><Probe /></div>} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText('Lesson one');

    fireEvent.click(labButtons()[0]);

    expect(screen.getByTestId('where')).toHaveTextContent('/lab');
    expect(screen.queryByTestId('elsewhere')).toBeNull();
  });
});

describe('the lesson-part screen: the Lab button', () => {
  it('opens the laboratory, not the part it sits next to', async () => {
    api.get.mockResolvedValue({ data: nestedTree });
    render(
      <MemoryRouter initialEntries={['/learn/astronomy/1/sub/0']}>
        <Routes>
          <Route path="/learn/:subject/:topicId/sub/:subIdx" element={<SubTopicView />} />
          <Route path="/lab" element={<Probe />} />
          <Route path="*" element={<div data-testid="elsewhere"><Probe /></div>} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText('Part one');

    fireEvent.click(labButtons()[0]);

    expect(screen.getByTestId('where')).toHaveTextContent('/lab');
    expect(screen.queryByTestId('elsewhere')).toBeNull();
  });
});
