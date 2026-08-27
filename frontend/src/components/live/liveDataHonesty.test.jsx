/**
 * The Live page invented data and presented it as live.
 *
 * Four separate places, all found by reading the page against what the APIs it
 * called actually return:
 *
 * 1. `UpcomingLaunches` answered every failure with five hard-coded launches —
 *    "Falcon 9 — Starlink Group 12-5" from Cape Canaveral, cleared to fly, two
 *    days out — drawn in exactly the same rows as real ones. The countdown was
 *    `Date.now() + 2 days`, so it read "2d" however long you looked at it. The
 *    third-party API is rate-limited per address, so for a school sharing one
 *    connection the invented rows were the usual case, not the rare one.
 *
 * 2. `NasaApod` did the same with a fixed 2023 photograph of the Carina Nebula
 *    — and captioned it `new Date()`, so a three-year-old picture was
 *    presented as today's under the words "Picture of the Day". It
 *    authenticated with `DEMO_KEY`, which NASA limits to 30 requests an hour
 *    per address; one classroom exhausts that before the lesson does.
 *
 * 3. `LiveSpaceView` fell back to an ISS element set hard-coded in the source:
 *    the sample TLE from satellite.js's own documentation, epoch 20 September
 *    2008. Propagated to the day this was written that is 6 551 days old and
 *    puts the station 13 006 km from where it is — very nearly the far side of
 *    the planet — while the panel showed altitude to a tenth of a kilometre
 *    and latitude to a hundredth of a degree, refreshed every 700 ms, under a
 *    badge reading "Fallback TLE mode" in English only.
 *
 * 4. Both components ran every string through `translate.googleapis.com`'s
 *    undocumented `translate_a/single` endpoint at render time, so the text
 *    children read was unreviewed machine output from a third-party host.
 *
 * These tests pin the rule rather than the markup: when we do not have the
 * data, the page says so. It never makes something up that looks like data.
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
  api.get.mockRejectedValue(new Error('network is down'));
  // The components log the rejection they handle; keep the run readable.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('when the launch data cannot be reached', () => {
  it('says so instead of inventing launches', async () => {
    const { default: UpcomingLaunches } = await import('./UpcomingLaunches');
    render(<UpcomingLaunches />);

    await waitFor(() => {
      expect(screen.queryByText(/Starlink Group 12-5/)).not.toBeInTheDocument();
    });
    for (const invented of ['Progress MS-29', 'SPADEX', 'Wentian', 'NROL-199']) {
      expect(screen.queryByText(new RegExp(invented))).not.toBeInTheDocument();
    }
    // Nothing may claim a launch is cleared to fly.
    expect(screen.queryByText(/^Go$/)).not.toBeInTheDocument();
  });

  it('does not ship a hard-coded launch manifest at all', async () => {
    const code = await readSource('./UpcomingLaunches.jsx?raw');
    expect(code).not.toMatch(/Starlink Group/);
    expect(code).not.toMatch(/Cape Canaveral/);
    expect(code).not.toMatch(/Baikonur/);
    // A countdown measured from "now" is the tell: a real launch has a date.
    expect(code).not.toMatch(/Date\.now\(\)\s*\+\s*86400000/);
  });
});

describe('when the picture of the day cannot be reached', () => {
  it('does not show a stand-in photograph', async () => {
    const { default: NasaApod } = await import('./NasaApod');
    render(<NasaApod />);
    await waitFor(() => {
      expect(screen.queryByText(/Carina Nebula/i)).not.toBeInTheDocument();
    });
    expect(document.querySelector('img')).toBeNull();
  });

  it('never stamps today onto a picture it did not fetch', async () => {
    const code = await readSource('./NasaApod.jsx?raw');
    expect(code).not.toMatch(/Carina/);
    expect(code).not.toMatch(/date:\s*new Date\(\)/);
  });
});

describe('the live panels', () => {
  it('never machine-translate what a child reads', async () => {
    for (const file of ['./UpcomingLaunches.jsx?raw', './NasaApod.jsx?raw']) {
      const code = await readSource(file);
      expect(code).not.toMatch(/translate\.googleapis\.com/);
      expect(code).not.toMatch(/translate_a\/single/);
    }
  });

  it('make no automatic request to any third-party host', async () => {
    // Swept across the whole section on 28 August 2026. What used to be here:
    // celestrak.org (twice), ll.thespacedevs.com, api.nasa.gov with DEMO_KEY,
    // translate.googleapis.com in two components, and a YouTube iframe with
    // autoplay=1 that opened on page load. All of them now go through
    // apps.space or are gone.
    //
    // Two absolute URLs remain and neither is a request the page makes on its
    // own: the NASA TV link a reader can click, and the YouTube embed, which
    // is rendered only after somebody presses play.
    const files = [
      './UpcomingLaunches.jsx?raw',
      './NasaApod.jsx?raw',
      './FeaturedSatellites.jsx?raw',
      './OrbitGlobe.jsx?raw',
      '@/views/community/LiveSpaceView.jsx?raw',
    ];
    for (const file of files) {
      const code = await readSource(file);
      // No fetch, axios call or asset load may name an outside host.
      expect(code).not.toMatch(/fetch\(\s*[`'"]https?:\/\//);
      expect(code).not.toMatch(/api\.get\(\s*[`'"]https?:\/\//);
      expect(code).not.toMatch(/translate\.googleapis\.com/);
      expect(code).not.toMatch(/celestrak\.org/);
      expect(code).not.toMatch(/api\.nasa\.gov/);
      expect(code).not.toMatch(/thespacedevs\.com/);
      expect(code).not.toMatch(/DEMO_KEY/);
    }
  });

  it('load the video embed only when somebody asks for it', async () => {
    // It carried `autoplay=1` and rendered unconditionally, so arriving on the
    // page opened a connection to YouTube and set its cookies for every child.
    const code = await readSource('@/views/community/LiveSpaceView.jsx?raw');
    expect(code).toMatch(/streamOpen \?/);
    expect(code).toMatch(/youtube-nocookie\.com/);
    expect(code).not.toMatch(/www\.youtube\.com\/embed/);
  });

  it('ask our own server, not a third-party host', async () => {
    // Same rule commit b8d1ac2 applied to the home page's Earth. A key in the
    // bundle is a public key, and a rate limit shared with every other reader
    // of it is not a limit we control.
    for (const file of ['./UpcomingLaunches.jsx?raw', './NasaApod.jsx?raw']) {
      const code = await readSource(file);
      expect(code).not.toMatch(/https?:\/\//);
      expect(code).not.toMatch(/DEMO_KEY/);
    }
  });
});

describe('the satellite tracker', () => {
  it('carries no hard-coded element set to fall back on', async () => {
    const code = await readSource('@/views/community/LiveSpaceView.jsx?raw');
    // TLE line 1 begins "1 " then the five-digit catalogue number and its
    // classification; line 2 begins "2 " and the same number. Either one in
    // the source is a fixed orbit that starts going wrong the day it lands.
    expect(code).not.toMatch(/'1 \d{5}[UCS]/);
    expect(code).not.toMatch(/'2 \d{5}\s/);
  });

  it('asks our own server for elements, never CelesTrak directly', async () => {
    // The page made two direct calls to celestrak.org from the browser: the
    // element groups, and a per-satellite SATCAT lookup. Thirty browsers in
    // one classroom doing that is what CelesTrak's usage policy firewalls an
    // address for, which is why apps.space exists.
    const code = await readSource('@/views/community/LiveSpaceView.jsx?raw');
    expect(code).not.toMatch(/celestrak\.org/);
    expect(code).toMatch(/\/api\/v1\/space\/gp\//);
  });

  it('reads the field names CelesTrak actually sends', async () => {
    const code = await readSource('@/views/community/LiveSpaceView.jsx?raw');
    // Checked against a live response on 28 August 2026:
    //   https://celestrak.org/satcat/records.php?CATNR=25544&FORMAT=JSON
    //   {"OBJECT_NAME","OBJECT_ID","NORAD_CAT_ID","OBJECT_TYPE",
    //    "OPS_STATUS_CODE","OWNER","LAUNCH_DATE","LAUNCH_SITE","DECAY_DATE",
    //    "PERIOD","INCLINATION","APOGEE","PERIGEE","RCS", ...}
    // The page read INTLDES, LAUNCH, SITE, COUNTRY and OPS_STATUS — none of
    // which exist — plus LAUNCH_PIECE and LAUNCH_VEHICLE, which SATCAT has
    // never had. Five of the seven "Launch + Mission" rows and one of the five
    // "Identity" rows therefore read "Unknown" on every satellite, for ever,
    // even when the request succeeded.
    for (const absent of ['INTLDES', 'LAUNCH_PIECE', 'LAUNCH_VEHICLE']) {
      expect(code).not.toMatch(new RegExp(`\\.${absent}\\b`));
    }
    expect(code).not.toMatch(/\.LAUNCH\b(?!_DATE|_SITE)/);
    expect(code).not.toMatch(/\.SITE\b/);
    expect(code).not.toMatch(/\.COUNTRY\b/);
    expect(code).not.toMatch(/\.OPS_STATUS\b(?!_CODE)/);
  });
});
