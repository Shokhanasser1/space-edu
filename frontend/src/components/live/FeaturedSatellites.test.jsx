/**
 * Samarkand-2028 is real, in orbit, and has no published orbit.
 *
 * Uzbekistan's Ministry of Digital Technologies announced it, four independent
 * outlets reported the 5 August 2026 launch, and it returned a picture of
 * Athens within hours. CelesTrak has no element set for it under any name it
 * might carry, and the objects catalogued from that launch are unnamed and
 * attributed to the PRC — so there is nothing we can honestly draw on a globe.
 *
 * The card therefore has to do something unusual: show the mission, show the
 * gaps *as* gaps, and say plainly that we cannot show a position. These tests
 * hold that behaviour. The failure they exist to prevent is the tidy-looking
 * one — a card with every field filled in, where some of the values were
 * guessed.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  slowApi: { post: vi.fn() },
  setupApiAuth: vi.fn(),
}));

let api;
let FeaturedSatellites;
let useUserStore;

// Exactly the shape `GET /satellites/` returns — see
// apps/satellites/serializers.py and the response-shape test beside it.
const samarkand = {
  slug: 'samarkand-2028',
  catalog_name: 'SAMARKAND-2028',
  norad_id: null,
  is_trackable: false,
  name_en: 'Samarkand-2028',
  name_uz: 'Samarqand-2028',
  name_ru: 'Самарканд-2028',
  description_en: 'A hyperspectral Earth-observation satellite.',
  description_uz: "Giperspektral Yer kuzatuv sun'iy yo'ldoshi.",
  description_ru: 'Гиперспектральный спутник наблюдения Земли.',
  mission_type: 'earth_obs',
  operator: 'Uzbekcosmos / STAR.VISION',
  country: 'Uzbekistan',
  launch_date: '2026-08-05',
  launch_site: 'Sea platform off Shandong, China',
  launch_vehicle: '',
  source_url: 'https://gov.uz/en/digital/news/view/201507',
  source_name: 'Ministry of Digital Technologies',
  is_featured: true,
};

const iss = {
  ...samarkand,
  slug: 'iss',
  catalog_name: 'ISS (ZARYA)',
  norad_id: 25544,
  is_trackable: true,
  name_en: 'International Space Station',
  name_uz: 'Xalqaro kosmik stansiya',
  name_ru: 'Международная космическая станция',
  mission_type: 'station',
  country: 'International',
  launch_vehicle: 'Proton-K',
};

beforeEach(async () => {
  ({ default: api } = await import('@/lib/api'));
  api.get.mockReset();
  ({ default: FeaturedSatellites } = await import('./FeaturedSatellites'));
  ({ useUserStore } = await import('@/store/useUserStore'));
  useUserStore.setState({ language: 'ENG' });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('a satellite with no published orbit', () => {
  it('is still shown, with the facts that were published', async () => {
    api.get.mockResolvedValue({ data: [samarkand] });
    render(<FeaturedSatellites />);

    expect(await screen.findByText('Samarkand-2028')).toBeInTheDocument();
    expect(screen.getByText('2026-08-05')).toBeInTheDocument();
    expect(screen.getByText('Uzbekcosmos / STAR.VISION')).toBeInTheDocument();
  });

  it('says the orbit is unpublished rather than drawing one', async () => {
    api.get.mockResolvedValue({ data: [samarkand] });
    render(<FeaturedSatellites />);

    expect(await screen.findByText(/No orbital data published/i)).toBeInTheDocument();
    expect(screen.getByText(/we cannot show you where it is/i)).toBeInTheDocument();
  });

  it('marks an unpublished field as unannounced instead of hiding it', async () => {
    // The launch vehicle is the live example: two specialist catalogues record
    // a Jielong-3 Y12 that day, but neither names this satellite, so it is
    // inference and stays off the page.
    api.get.mockResolvedValue({ data: [samarkand] });
    render(<FeaturedSatellites />);

    expect(await screen.findByText(/Launch vehicle/i)).toBeInTheDocument();
    expect(screen.getByText(/Not announced yet/i)).toBeInTheDocument();
  });

  it('names where its facts came from', async () => {
    api.get.mockResolvedValue({ data: [samarkand] });
    render(<FeaturedSatellites />);

    const link = await screen.findByRole('link');
    expect(link).toHaveAttribute('href', 'https://gov.uz/en/digital/news/view/201507');
  });
});

describe('a satellite we do track', () => {
  it('is marked as tracked rather than as missing', async () => {
    api.get.mockResolvedValue({ data: [iss] });
    render(<FeaturedSatellites />);

    expect(await screen.findByText(/Tracked live/i)).toBeInTheDocument();
    expect(screen.queryByText(/No orbital data published/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/we cannot show you where it is/i)).not.toBeInTheDocument();
  });
});

describe('the difference between "unannounced" and "unsourced"', () => {
  it('does not claim a 1990 launch was never announced', async () => {
    // "Not announced yet" is a claim about the world. Printing it against a
    // satellite that flew decades ago would be false — a blank there means we
    // have not sourced it for this page, which is our gap, not the world's.
    const hubble = {
      ...iss,
      slug: 'hubble',
      name_en: 'Hubble Space Telescope',
      launch_date: '1990-04-24',
      launch_vehicle: '',
    };
    api.get.mockResolvedValue({ data: [hubble] });
    render(<FeaturedSatellites />);

    expect(await screen.findByText('1990-04-24')).toBeInTheDocument();
    expect(screen.queryByText(/Not announced yet/i)).not.toBeInTheDocument();
    // The row is left out entirely rather than filled with a false statement.
    expect(screen.queryByText(/Launch vehicle/i)).not.toBeInTheDocument();
  });

  it('still says "not announced" where nobody has announced it', async () => {
    api.get.mockResolvedValue({ data: [samarkand] });
    render(<FeaturedSatellites />);

    expect(await screen.findByText(/Launch vehicle/i)).toBeInTheDocument();
    expect(screen.getByText(/Not announced yet/i)).toBeInTheDocument();
  });
});

describe('language', () => {
  it('shows the Uzbek name and description to an Uzbek reader', async () => {
    useUserStore.setState({ language: 'UZB' });
    api.get.mockResolvedValue({ data: [samarkand] });
    render(<FeaturedSatellites />);

    expect(await screen.findByText('Samarqand-2028')).toBeInTheDocument();
    expect(screen.getByText(/Giperspektral Yer kuzatuv/)).toBeInTheDocument();
    expect(screen.getByText(/Hali e'lon qilinmagan/)).toBeInTheDocument();
  });

  it('shows the Russian name and description to a Russian reader', async () => {
    useUserStore.setState({ language: 'RUS' });
    api.get.mockResolvedValue({ data: [samarkand] });
    render(<FeaturedSatellites />);

    expect(await screen.findByText('Самарканд-2028')).toBeInTheDocument();
    expect(screen.getByText(/Пока не объявлено/)).toBeInTheDocument();
  });
});

describe('when the satellite list cannot be loaded', () => {
  it('says so rather than rendering an empty grid', async () => {
    api.get.mockRejectedValue(new Error('network is down'));
    render(<FeaturedSatellites />);

    await waitFor(() => {
      expect(screen.getByText(/could not load the satellite list/i)).toBeInTheDocument();
    });
  });
});
