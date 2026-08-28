/**
 * Second-pass finding, 22 Aug 2026.
 *
 * The /learn landing cards carried hand-written lesson counts, and every one
 * was wrong by a factor of three to six: physics advertised 24 lessons against
 * 144 real ones, astronomy 32 against 126. The page also claimed "229 lessons"
 * and "6 courses" over five sections.
 *
 * They were the fifth copy of content metadata in the project. ADR 0001 removed
 * three; this removes the last one that faces a student.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  slowApi: { post: vi.fn() },
  setupApiAuth: vi.fn(),
}));

let api;
let LearnView;

beforeEach(async () => {
  ({ default: api } = await import('@/lib/api'));
  api.get.mockReset();
  ({ default: LearnView } = await import('./LearnView'));
});

const sphere = (slug, lessons) => ({
  id: slug, slug, order: 1, title: slug, title_en: slug, title_ru: slug,
  description: '', description_en: '', color: '#fff', icon: 'Atom',
  link: `/learn/${slug}`, lessons_count: lessons, is_active: true,
  topic_count: 1, problem_count: 0,
});

function renderPage() {
  return render(<MemoryRouter><LearnView /></MemoryRouter>);
}

describe('LearnView lesson counts', () => {
  it('shows the number the server computed, not a hand-written one', async () => {
    api.get.mockResolvedValue({
      data: [sphere('physics', 144), sphere('astronomy', 126)],
    });

    renderPage();
    await waitFor(async () => {
      expect(await screen.findAllByText('144')).not.toHaveLength(0);
    });
    expect(await screen.findAllByText('126')).not.toHaveLength(0);
  });

  it('reflects an edit made in the admin panel', async () => {
    // The whole point of ADR 0001: editing content changes what students see.
    api.get.mockResolvedValue({ data: [sphere('physics', 999)] });

    renderPage();
    expect(await screen.findAllByText('999')).not.toHaveLength(0);
  });

  it('accepts a paginated list as well as a bare one', async () => {
    api.get.mockResolvedValue({ data: { results: [sphere('physics', 144)], next: null } });

    renderPage();
    expect(await screen.findAllByText('144')).not.toHaveLength(0);
  });

  it('falls back to its own numbers when the API is unreachable', async () => {
    api.get.mockRejectedValue(new Error('offline'));

    const { container } = renderPage();
    await waitFor(() => expect(container.firstChild).toBeTruthy());
    // The fallbacks are seeded from the real content, so they are the true
    // counts too — the point is that the page still renders a number.
    expect(await screen.findAllByText('144')).not.toHaveLength(0);
  });

  it('counts the courses it actually renders', async () => {
    api.get.mockResolvedValue({ data: [] });
    renderPage();
    // Five sections, not the "6" that was written down.
    expect(await screen.findAllByText('5')).not.toHaveLength(0);
  });

  it('totals the lessons rather than repeating a stale 229', async () => {
    api.get.mockResolvedValue({
      data: [sphere('physics', 100), sphere('astronomy', 100)],
    });
    renderPage();
    // 100 + 100 from the API, plus the fallbacks for the three the API did not
    // mention (problems 145, creativity 57, interviews 63).
    expect(await screen.findAllByText('465')).not.toHaveLength(0);
  });
});

/**
 * 28 Aug 2026: the landing page of the whole Learn section was not translated.
 *
 * Each card printed `section.titleEn` as its heading and `section.title` as the
 * subtitle — English over Uzbek, in every language, so a Russian reader met the
 * section with no Russian on it at all. The description and the four topic
 * pills under it were Uzbek string literals in the component.
 *
 * Nothing needed translating to fix it. `learnPage` in all three locale files
 * already held the title, the description and all four pills for each of the
 * five sections — 35 keys per language, written and reviewed, and never read.
 */
describe('the landing cards', () => {
  let useUserStore;

  beforeEach(async () => {
    ({ useUserStore } = await import('@/store/useUserStore'));
    api.get.mockResolvedValue({ data: [] });
  });

  const renderIn = (storeLanguage) => {
    useUserStore.setState({ language: storeLanguage });
    return renderPage();
  };

  it('speaks Russian to a Russian reader', async () => {
    renderIn('RUS');
    expect(await screen.findAllByText('Физика')).not.toHaveLength(0);
    expect(await screen.findAllByText('Основы космической механики, гравитации и энергии'))
      .not.toHaveLength(0);
    expect(await screen.findAllByText('Законы Ньютона')).not.toHaveLength(0);
  });

  it('does not fall back to the Uzbek copy for a Russian reader', async () => {
    renderIn('RUS');
    await screen.findAllByText('Физика');
    expect(screen.queryByText('Kosmik mexanika, gravitatsiya va energiya asoslari')).toBeNull();
    expect(screen.queryByText('Nyuton qonunlari')).toBeNull();
  });

  it('speaks English to an English reader', async () => {
    renderIn('ENG');
    expect(await screen.findAllByText('Foundations of cosmic mechanics, gravity, and energy'))
      .not.toHaveLength(0);
    expect(await screen.findAllByText("Newton's Laws")).not.toHaveLength(0);
  });

  it('speaks Uzbek to an Uzbek reader', async () => {
    renderIn('UZB');
    expect(await screen.findAllByText('Kosmik mexanika, gravitatsiya va energiya asoslari'))
      .not.toHaveLength(0);
    expect(await screen.findAllByText('Nyuton qonunlari')).not.toHaveLength(0);
  });
});

/**
 * The hero heading over those cards was the same defect one level up: a
 * hardcoded "KOINOTNI O'RGAN" in two spans, while `learnPage.headerTitle` and
 * `headerHighlight` sat translated and unread in all three locale files. The
 * subtitle under it was already reading its key, so an English reader met an
 * Uzbek headline over an English sentence.
 */
describe('the section heading', () => {
  let useUserStore;

  beforeEach(async () => {
    ({ useUserStore } = await import('@/store/useUserStore'));
    api.get.mockResolvedValue({ data: [] });
  });

  it.each([
    ['ENG', 'Cosmic', 'Academy'],
    ['UZB', 'Koinot', 'Akademiyasi'],
    ['RUS', 'Космическая', 'Академия'],
  ])('is in the reader\'s language (%s)', async (language, title, highlight) => {
    useUserStore.setState({ language });
    renderPage();
    expect(await screen.findAllByText(title, { exact: false })).not.toHaveLength(0);
    expect(await screen.findAllByText(highlight, { exact: false })).not.toHaveLength(0);
    expect(screen.queryByText(/KOINOTNI/)).toBeNull();
  });
});
