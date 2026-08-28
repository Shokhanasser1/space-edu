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

/**
 * A lesson that has a video should not start playing it by itself.
 *
 * The pool is gone, but the embed a lesson's *own* video was given still
 * carried `autoplay=1&mute=0`. That is wrong twice over: thirty children
 * opening a lesson in one room is thirty soundtracks, and Chrome and Safari
 * refuse an unmuted autoplay anyway — so the flag bought a video that usually
 * did not play, and sometimes one that did, loudly.
 */
async function srcForLessonWithVideo(videoUrl) {
  api.get.mockResolvedValue({ data: treeWith(videoUrl) });
  renderLesson();
  await screen.findAllByText("Coulomb's law");
  return document.querySelector('iframe').getAttribute('src');
}

describe('a lesson video waits to be asked', () => {
  it('does not autoplay the lesson\'s own video', async () => {
    const src = await srcForLessonWithVideo('https://www.youtube.com/embed/abc123');

    expect(src).not.toMatch(/autoplay=1/);
    expect(src).not.toMatch(/mute=0/);
  });

  it('still keeps YouTube from offering unrelated videos afterwards', async () => {
    const src = await srcForLessonWithVideo('https://www.youtube.com/embed/abc123');

    expect(src).toMatch(/rel=0/);
  });

  it('still turns a watch link into an embed link', async () => {
    const src = await srcForLessonWithVideo('https://www.youtube.com/watch?v=abc123');

    expect(src).toMatch(/\/embed\/abc123/);
    expect(src).not.toMatch(/watch\?v=/);
  });
});

/**
 * A borrowed video has to say whose it is.
 *
 * 28 Aug 2026, the other half of the same problem: the slots are being filled
 * with Khan Academy's Uzbek lessons. They are somebody else's work, and a page
 * that plays them under this platform's heading and name is claiming them.
 * `TopicLesson` has no field for a channel, so the credit comes from the
 * checked-in map in `src/data/videoCredits.js` — and a video the map does not
 * know prints nothing rather than a guess.
 */
describe('the credit under the player', () => {
  it('names the channel that made the video', async () => {
    api.get.mockResolvedValue({
      data: treeWith('https://www.youtube.com/embed/l6k62nsjfFo'),
    });
    renderLesson();
    await screen.findAllByText("Coulomb's law");

    expect(screen.getByTestId('video-credit')).toHaveTextContent('Khan Academy Uzbek');
  });

  it('says nothing at all about a video it cannot identify', async () => {
    api.get.mockResolvedValue({
      data: treeWith('https://www.youtube.com/embed/abc123'),
    });
    renderLesson();
    await screen.findAllByText("Coulomb's law");

    expect(document.querySelector('iframe')).not.toBeNull();
    expect(screen.queryByTestId('video-credit')).toBeNull();
  });

  it('leaves the empty slot alone when there is no video to credit', async () => {
    api.get.mockResolvedValue({ data: treeWith('') });
    renderLesson();
    await screen.findAllByText("Coulomb's law");

    expect(screen.getByTestId('video-pending')).toBeInTheDocument();
    expect(screen.queryByTestId('video-credit')).toBeNull();
  });
});
