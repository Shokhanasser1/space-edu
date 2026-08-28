/**
 * 28 Aug 2026: the lesson list stayed in Uzbek whatever language the page was.
 *
 * `TopicLesson.name_en` / `name_ru` have existed since ADR 0001 and are sent by
 * the serializer; the adapter in `lib/learnContent.js` read only `name`, so
 * every translated lesson title a content editor wrote went nowhere. The topic
 * heading above the list *was* translated, which is what hid it: the heading
 * changed language and the rows underneath it did not.
 *
 * `learnContent.test.js` covers the adapter. This covers the half a revert of
 * either the adapter or the views would break — that the translated name
 * actually reaches the screen.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  slowApi: { post: vi.fn() },
  setupApiAuth: vi.fn(),
}));

let api;
let useUserStore;
let PhysicsTopicView;

beforeEach(async () => {
  ({ default: api } = await import('@/lib/api'));
  api.get.mockReset();
  ({ useUserStore } = await import('@/store/useUserStore'));
  ({ default: PhysicsTopicView } = await import('./PhysicsTopicView'));
});

// One lesson, written out in all three languages the way a content editor would.
//
// **None of these three names may appear in `src/data/physicsTopicsData.js`.**
// The view renders the static file first and swaps in the API answer when it
// lands, so a name the two have in common is found by `findByText` against the
// static render — and the assertion then proves nothing about the API at all.
// It also breaks outright: the node found in the first render is detached by
// the second, and `toBeInTheDocument` fails on an element that was really
// there. That is what happened on 28 Aug 2026, when the first ten kinematics
// lessons were written and two of these strings became real content.
const tree = {
  topics: [{
    order: 1, slug: 'physics-kinematics',
    title: 'Kinematika', title_en: 'Kinematics', title_ru: 'Кинематика',
    color: '#00e5ff',
    lessons: [{
      slug: 'physics-uniform-motion',
      name: 'Vagon derazasidan qaralganda',
      name_en: 'Seen from a carriage window',
      name_ru: 'Вид из окна вагона',
      children: [],
    }],
  }],
};

function renderIn(storeLanguage) {
  useUserStore.setState({ language: storeLanguage });
  api.get.mockResolvedValue({ data: tree });
  return render(
    <MemoryRouter initialEntries={['/learn/physics/1']}>
      <Routes>
        <Route path="/learn/physics/:topicId" element={<PhysicsTopicView />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('a lesson row', () => {
  it('is in Russian for a Russian reader', async () => {
    renderIn('RUS');
    expect(await screen.findByText('Вид из окна вагона')).toBeInTheDocument();
    expect(screen.queryByText('Vagon derazasidan qaralganda')).toBeNull();
  });

  it('is in English for an English reader', async () => {
    renderIn('ENG');
    expect(await screen.findByText('Seen from a carriage window')).toBeInTheDocument();
    expect(screen.queryByText('Vagon derazasidan qaralganda')).toBeNull();
  });

  it('is in Uzbek for an Uzbek reader, which is the base the others translate', async () => {
    renderIn('UZB');
    expect(await screen.findByText('Vagon derazasidan qaralganda')).toBeInTheDocument();
    expect(screen.queryByText('Seen from a carriage window')).toBeNull();
  });

  it('shows the base name rather than nothing when a translation is missing', async () => {
    // 464 of the 474 seeded lessons are in this state: name_ru is empty, so
    // Russian has to degrade to something readable rather than to nothing.
    api.get.mockResolvedValue({
      data: {
        topics: [{
          ...tree.topics[0],
          lessons: [{ ...tree.topics[0].lessons[0], name_ru: '' }],
        }],
      },
    });
    useUserStore.setState({ language: 'RUS' });
    render(
      <MemoryRouter initialEntries={['/learn/physics/1']}>
        <Routes>
          <Route path="/learn/physics/:topicId" element={<PhysicsTopicView />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('Vagon derazasidan qaralganda')).toBeInTheDocument();
  });
});
