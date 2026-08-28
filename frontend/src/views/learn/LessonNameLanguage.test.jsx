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
const tree = {
  topics: [{
    order: 1, slug: 'physics-kinematics',
    title: 'Kinematika', title_en: 'Kinematics', title_ru: 'Кинематика',
    color: '#00e5ff',
    lessons: [{
      slug: 'physics-uniform-motion',
      name: "To'g'ri chiziqli tekis harakat",
      name_en: 'Motion at constant velocity',
      name_ru: 'Прямолинейное равномерное движение',
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
    expect(await screen.findByText('Прямолинейное равномерное движение')).toBeInTheDocument();
    expect(screen.queryByText("To'g'ri chiziqli tekis harakat")).toBeNull();
  });

  it('is in English for an English reader', async () => {
    renderIn('ENG');
    expect(await screen.findByText('Motion at constant velocity')).toBeInTheDocument();
    expect(screen.queryByText("To'g'ri chiziqli tekis harakat")).toBeNull();
  });

  it('is in Uzbek for an Uzbek reader, which is the base the others translate', async () => {
    renderIn('UZB');
    expect(await screen.findByText("To'g'ri chiziqli tekis harakat")).toBeInTheDocument();
    expect(screen.queryByText('Motion at constant velocity')).toBeNull();
  });

  it('shows the base name rather than nothing when a translation is missing', async () => {
    // Every one of the 474 seeded lessons is in this state today: name_ru is ''
    // for all of them, so Russian has to degrade to something readable.
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
    expect(await screen.findByText("To'g'ri chiziqli tekis harakat")).toBeInTheDocument();
  });
});
