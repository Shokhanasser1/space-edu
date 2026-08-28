/**
 * 28 Aug 2026: a lesson's body had one language, whatever the reader's was.
 *
 * `TopicLesson.content` reached the screen from 24 August (PR #14 wired the
 * renderer up), but there was exactly one field to put text in. The titles
 * around it are translated three ways — `name`, `name_en`, `name_ru` — so a
 * Russian reader got a Russian heading above an Uzbek lesson, which is worse
 * than either being consistent.
 *
 * `LessonNameLanguage.test.jsx` covers the same thing for the lesson *name*.
 * This covers the body, and it renders rather than reading the source, because
 * the field has to survive the whole path: serializer -> adapter -> view.
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
let useUserStore;
let UniversalLessonView;

beforeEach(async () => {
  ({ default: api } = await import('@/lib/api'));
  api.get.mockReset();
  ({ useUserStore } = await import('@/store/useUserStore'));
  ({ default: UniversalLessonView } = await import('./UniversalLessonView'));
});

const UZ = 'Tezlik — bir sekundda bosib otilgan yol.';
const EN = 'Velocity is the distance covered in one second.';
const RU = 'Скорость — это путь, пройденный за одну секунду.';

/** One lesson written out the way a content author would leave it. */
const tree = (lesson) => ({
  topics: [{
    order: 1, slug: 'physics-kinematics',
    title: 'Kinematika', title_en: 'Kinematics', title_ru: 'Кинематика',
    color: '#00e5ff',
    lessons: [{
      slug: 'physics-kinematics-straight-line-uniform-motion',
      name: "To'g'ri chiziqli tekis harakat",
      name_en: 'Straight-line uniform motion',
      name_ru: 'Прямолинейное равномерное движение',
      content: UZ,
      content_en: EN,
      content_ru: RU,
      children: [],
      ...lesson,
    }],
  }],
});

function renderIn(language, lesson = {}) {
  useUserStore.setState({ language });
  api.get.mockResolvedValue({ data: tree(lesson) });
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

describe('the body of a lesson that has been written', () => {
  it('is in Russian for a Russian reader', async () => {
    renderIn('RUS');
    expect(await screen.findByText(RU)).toBeInTheDocument();
    expect(screen.queryByText(UZ)).toBeNull();
    expect(screen.queryByText(EN)).toBeNull();
  });

  it('is in English for an English reader', async () => {
    renderIn('ENG');
    expect(await screen.findByText(EN)).toBeInTheDocument();
    expect(screen.queryByText(UZ)).toBeNull();
    expect(screen.queryByText(RU)).toBeNull();
  });

  it('is in Uzbek for an Uzbek reader, which is the original the others follow', async () => {
    renderIn('UZB');
    expect(await screen.findByText(UZ)).toBeInTheDocument();
    expect(screen.queryByText(EN)).toBeNull();
    expect(screen.queryByText(RU)).toBeNull();
  });

  it('falls back to the Uzbek original rather than to a blank page', async () => {
    // 464 of the 474 lessons are in this state: nothing written in any
    // language. The ones that have been written must not go blank for a
    // Russian reader merely because the Russian half is still outstanding.
    renderIn('RUS', { content_ru: '' });
    expect(await screen.findByText(UZ)).toBeInTheDocument();
  });
});
