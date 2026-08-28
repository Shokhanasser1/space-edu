/**
 * The News page invented news, in the same shape the Live page did.
 *
 * What was there before 28 August 2026:
 *
 * 1. `NewsView` answered *any* failure from `/news/` — and an empty list —
 *    with seven hard-coded "articles" from `src/data/mockData.js`, drawn in
 *    exactly the same cards as real ones. "James Webb Space Telescope Reveals
 *    New Exoplanet Atmosphere Data", dated 30 April 2026, complete with a
 *    source and a photograph. Nothing on the card said it was made up.
 *
 * 2. Those photographs came from `picsum.photos` — a random-stock-image host —
 *    fetched by every reader's browser. That is the pattern commit `b8d1ac2`
 *    removed from the home page's Earth and `caa16d0` removed from the Live
 *    page: a third-party host, called directly, on a school network that may
 *    well block it, illustrating an article that never happened.
 *
 * 3. The category chips printed the raw database value — "exploration" — in
 *    all three languages, "Read Full Story" was English in the JSX with a
 *    perfectly good `news.readFull` key sitting unused beside it, and the
 *    Daily Fact panel held ten English sentences on a page whose 1 500 other
 *    strings are translated.
 *
 * These tests pin the rules rather than the markup: when we do not have
 * something, the page says so; when we do, it comes from our own server; and
 * every word a child reads comes out of the locale files.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  slowApi: { post: vi.fn() },
  setupApiAuth: vi.fn(),
}));

const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const readSource = (specifier) =>
  import(/* @vite-ignore */ specifier).then((m) => stripComments(m.default));

let api;

beforeEach(async () => {
  ({ default: api } = await import('@/lib/api'));
  api.get.mockReset();
  // The components log the rejection they handle; keep the run readable.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('when the news cannot be loaded', () => {
  it('says so instead of inventing articles', async () => {
    api.get.mockRejectedValue(new Error('network is down'));
    const { default: NewsView } = await import('./NewsView');
    render(<NewsView />);

    await waitFor(() => {
      expect(screen.getByText(/could not load the news/i)).toBeInTheDocument();
    });
    for (const invented of [
      /James Webb Space Telescope Reveals/i,
      /Perseverance Rover Completes Delta/i,
      /Starship/i,
    ]) {
      expect(screen.queryByText(invented)).not.toBeInTheDocument();
    }
  });

  it('shows an honest empty state when the list is simply empty', async () => {
    api.get.mockResolvedValue({ data: [] });
    const { default: NewsView } = await import('./NewsView');
    render(<NewsView />);

    await waitFor(() => {
      expect(screen.getByText(/no news here yet/i)).toBeInTheDocument();
    });
  });

  it('ships no hard-coded article manifest anywhere', async () => {
    for (const file of [
      './NewsView.jsx?raw',
      '@/components/news/NewsCard.jsx?raw',
      '@/data/mockData.js?raw',
    ]) {
      const code = await readSource(file);
      expect(code, file).not.toMatch(/newsData/);
      expect(code, file).not.toMatch(/title_en:\s*['"]/);
      expect(code, file).not.toMatch(/summary_en:\s*['"]/);
    }
  });
});

describe('the News page and third-party hosts', () => {
  it('makes no automatic request to one', async () => {
    for (const file of [
      './NewsView.jsx?raw',
      '@/components/news/NewsCard.jsx?raw',
      '@/components/news/OnThisDay.jsx?raw',
      '@/components/news/TelegramFeed.jsx?raw',
    ]) {
      const code = await readSource(file);
      expect(code, file).not.toMatch(/fetch\(\s*[`'"]https?:\/\//);
      expect(code, file).not.toMatch(/api\.get\(\s*[`'"]https?:\/\//);
      expect(code, file).not.toMatch(/picsum\.photos/);
      expect(code, file).not.toMatch(/telesco\.pe/);
      // Not even the channel's own host: `apps.news` fetches it server-side
      // and the link a reader may click comes down in the response.
      expect(code, file).not.toMatch(/t\.me/);
    }
  });

  it('asks our own API for the channel rather than reading it in the browser', async () => {
    const code = await readSource('@/components/news/TelegramFeed.jsx?raw');
    expect(code).toMatch(/\/news\/telegram\//);
  });
});

describe('nothing a child reads is hard-coded English', () => {
  it('has no list of English sentences left in the page', async () => {
    const code = await readSource('./NewsView.jsx?raw');
    expect(code).not.toMatch(/SPACE_FACTS/);
    expect(code).not.toMatch(/A day on Venus/);
    expect(code).not.toMatch(/Read Full Story/);
  });

  it('translates the category chips instead of printing the database value', async () => {
    const code = await readSource('@/components/news/NewsCard.jsx?raw');
    // `{article.category}` in the JSX is the bug: it renders "exploration" to
    // an Uzbek reader. The label has to go through `t`.
    expect(code).not.toMatch(/\{\s*article\.category\s*\}/);
    expect(code).toMatch(/categories\.\$\{category\}|categories\./);
  });
});

describe('"on this day"', () => {
  const day = (entries, extra = {}) => ({
    data: {
      month: 8, day: 28, is_today: true, date: '2026-08-28',
      entries,
      previous: { month: 8, day: 27 },
      next: { month: 8, day: 29 },
      coverage: { days_covered: 200, days_in_year: 366, entries: 300 },
      ...extra,
    },
  });

  const entry = {
    id: 'sputnik-1', month: 10, day: 4, year: 1957, kind: 'launch', region: 'central_asia',
    title_en: 'Sputnik 1', title_uz: 'Sputnik 1', title_ru: 'Спутник-1',
    text_en: 'The first artificial satellite.', text_uz: 'Birinchi sun\'iy yo\'ldosh.',
    text_ru: 'Первый искусственный спутник.',
    source: 'NASA', source_url: 'https://science.nasa.gov/mission/sputnik-1/',
    years_ago: 69,
  };

  const serve = (payload) => {
    api.get.mockImplementation((url) => (url === '/news/on-this-day/'
      ? Promise.resolve(payload)
      : Promise.reject(new Error('not this endpoint'))));
  };

  it('says the day is unwritten rather than showing another day', async () => {
    serve(day([]));
    const { default: OnThisDay } = await import('@/components/news/OnThisDay');
    render(<OnThisDay />);

    await waitFor(() => {
      expect(screen.getByText(/have not written this day yet/i)).toBeInTheDocument();
    });
    // Nothing from the neighbouring days may be on the screen. The whole
    // point of the empty state is that a reader is not shown the 27th under
    // a heading that says today.
    expect(screen.queryByText('Sputnik 1')).not.toBeInTheDocument();
  });

  it('puts the source of every entry on the card', async () => {
    serve(day([entry]));
    const { default: OnThisDay } = await import('@/components/news/OnThisDay');
    render(<OnThisDay />);

    await waitFor(() => {
      expect(screen.getByText('Sputnik 1')).toBeInTheDocument();
    });
    const link = screen.getByRole('link', { name: /NASA/ });
    expect(link).toHaveAttribute('href', 'https://science.nasa.gov/mission/sputnik-1/');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('publishes how much of the year is actually written', async () => {
    serve(day([entry]));
    const { default: OnThisDay } = await import('@/components/news/OnThisDay');
    render(<OnThisDay />);

    await waitFor(() => {
      expect(screen.getByText(/366/)).toBeInTheDocument();
    });
  });

  it('says it could not load rather than showing nothing at all', async () => {
    api.get.mockRejectedValue(new Error('network is down'));
    const { default: OnThisDay } = await import('@/components/news/OnThisDay');
    render(<OnThisDay />);

    await waitFor(() => {
      expect(screen.getByText(/could not load this day/i)).toBeInTheDocument();
    });
    // "Could not load" and "we have not written this day" are different
    // claims and must never be swapped for one another.
    expect(screen.queryByText(/have not written this day yet/i)).not.toBeInTheDocument();
  });

  it('takes the day from the server, never from the browser clock', async () => {
    const code = await readSource('@/components/news/OnThisDay.jsx?raw');
    // A laptop in a school computer room with a wrong clock, or a reader
    // abroad, must see the same day as the classroom. The server decides.
    expect(code).not.toMatch(/new Date\(\)\.getMonth/);
    expect(code).not.toMatch(/new Date\(\)\.getDate/);
  });
});

describe('the Telegram panel', () => {
  it('says the channel is unreachable rather than "no posts"', async () => {
    const failure = new Error('unavailable');
    failure.response = { status: 503, data: { channel_url: 'https://t.me/uzcosmos_official' } };
    api.get.mockRejectedValue(failure);

    const { default: TelegramFeed } = await import('@/components/news/TelegramFeed');
    render(<TelegramFeed />);

    await waitFor(() => {
      expect(screen.getByText(/could not reach the channel/i)).toBeInTheDocument();
    });
    // The link still works even when the fetch did not, because it is the one
    // useful thing left to offer.
    expect(screen.getByRole('link', { name: /open the channel/i }))
      .toHaveAttribute('href', 'https://t.me/uzcosmos_official');
  });

  it('renders a post as text, with its own link, and no image element', async () => {
    api.get.mockResolvedValue({
      data: {
        channel: 'uzcosmos_official',
        channel_url: 'https://t.me/uzcosmos_official',
        fetched_at: '2026-08-28T06:00:00Z',
        stale: false,
        posts: [{
          id: 2726,
          url: 'https://t.me/uzcosmos_official/2726',
          text: 'Uzcosmos jamoasi Space Camp Türkiye’da!',
          truncated: false,
          published_at: '2026-08-26T12:59:25+00:00',
          has_media: true,
        }],
      },
    });

    const { default: TelegramFeed } = await import('@/components/news/TelegramFeed');
    const { container } = render(<TelegramFeed />);

    await waitFor(() => {
      expect(screen.getByText(/Space Camp Türkiye/)).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /open this post/i }))
      .toHaveAttribute('href', 'https://t.me/uzcosmos_official/2726');
    // A post's pictures live on cdn4.telesco.pe. Rendering one would be the
    // browser fetching a third-party host on every page load.
    expect(container.querySelector('img')).toBeNull();
  });

  it('says a copy is old rather than passing it off as current', async () => {
    api.get.mockResolvedValue({
      data: {
        channel: 'uzcosmos_official',
        channel_url: 'https://t.me/uzcosmos_official',
        fetched_at: '2026-08-20T06:00:00Z',
        stale: true,
        posts: [{
          id: 1, url: 'https://t.me/uzcosmos_official/1', text: 'Eski post',
          truncated: false, published_at: '2026-08-20T06:00:00+00:00', has_media: false,
        }],
      },
    });

    const { default: TelegramFeed } = await import('@/components/news/TelegramFeed');
    render(<TelegramFeed />);

    await waitFor(() => {
      expect(screen.getByText(/last copy we have/i)).toBeInTheDocument();
    });
  });
});
