/**
 * 28 Aug 2026: every lesson without a video was given somebody else's.
 *
 * `UniversalLessonView` held a pool of ten YouTube ids and picked one with
 * `(lessonIdx + partIdx + subIdx) % 10` whenever a lesson had no `videoUrl` of
 * its own. All 144 physics lessons are bare titles, so all 144 opened an
 * unrelated third-party video — autoplaying, unmuted — under the heading
 * "Video Lesson" and the lesson's name. The same ten clips also sat hard-coded
 * across ~400 sub-lessons in `src/data/*TopicsData.js`, so one clip was
 * simultaneously the lesson for "The Sun's Life Cycle", "The Goldilocks Zone"
 * and "Understanding Black holes".
 *
 * The animated videos are produced by UzCosmos and OIS. Until one exists for a
 * lesson, the slot says so. It does not borrow one.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  slowApi: { post: vi.fn() },
  setupApiAuth: vi.fn(),
}));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

let api;
let UniversalLessonView;

beforeEach(async () => {
  ({ default: api } = await import('@/lib/api'));
  api.get.mockReset();
  ({ default: UniversalLessonView } = await import('./UniversalLessonView'));
});

const treeWith = (videoUrl) => ({
  topics: [{
    order: 1, slug: 'physics-topic', title: 'Topic', color: '#0ff',
    lessons: [{
      name: "Coulomb's law", slug: 'physics-coulombs-law',
      video_url: videoUrl, content: '', children: [],
    }],
  }],
});

function renderLesson() {
  return render(
    <MemoryRouter initialEntries={['/learn/physics/1/lesson/0']}>
      <Routes>
        <Route
          path="/learn/:subject/:topicId/lesson/:lessonIdx"
          element={<UniversalLessonView />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('a lesson with no video of its own', () => {
  it('shows an empty labelled slot rather than an unrelated video', async () => {
    api.get.mockResolvedValue({ data: treeWith('') });
    renderLesson();
    await screen.findAllByText("Coulomb's law");

    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.getByTestId('video-pending')).toBeInTheDocument();
  });

  it('does not promise a video in the lesson blurb either', async () => {
    // `lessonDescription` says "the visualizations in the video will help you".
    // With no video that sentence is describing something that is not there.
    api.get.mockResolvedValue({ data: treeWith('') });
    renderLesson();
    await screen.findAllByText("Coulomb's law");

    expect(screen.queryByText(/in the video/i)).toBeNull();
  });
});

describe('a lesson that has a video', () => {
  it('still plays it', async () => {
    api.get.mockResolvedValue({
      data: treeWith('https://www.youtube.com/embed/REAL_VIDEO_ID'),
    });
    renderLesson();
    await screen.findAllByText("Coulomb's law");

    const frame = document.querySelector('iframe');
    expect(frame).not.toBeNull();
    expect(frame.getAttribute('src')).toContain('REAL_VIDEO_ID');
    expect(screen.queryByTestId('video-pending')).toBeNull();
  });
});

describe('the source', () => {
  it('carries no pool of borrowed video ids', async () => {
    // The pin: this is the line a revert would bring back, and nothing else in
    // the suite would notice it had.
    const src = await import('./UniversalLessonView.jsx?raw').then((m) => m.default);
    expect(src).not.toMatch(/videoPool/);
    expect(src).not.toMatch(/libKVRa01L8/);
  });
});
