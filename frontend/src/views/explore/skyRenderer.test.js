/**
 * The drawing half of the sky view.
 *
 * jsdom has no canvas, and `vitest.setup.js` installs a stub whose methods do
 * nothing, so these tests hand the renderer their own recording context and
 * assert on the calls it makes. That is not a substitute for looking at it --
 * nothing is -- but it catches the three things that are invisible when you
 * do look: a star drawn below the horizon, a star drawn that the child's sky
 * is too bright to show, and a label attached to the wrong star.
 */
import { describe, expect, it } from 'vitest';

import { drawSky, skyPositionsFor, starAt } from './skyRenderer';

/** A canvas context that remembers what it was asked to do. */
function recordingContext() {
  const calls = [];
  const record = (name) => (...args) => calls.push({ name, args });
  return {
    calls,
    canvas: { width: 800, height: 600 },
    save: record('save'), restore: record('restore'),
    beginPath: record('beginPath'), closePath: record('closePath'),
    moveTo: record('moveTo'), lineTo: record('lineTo'), arc: record('arc'),
    fill: record('fill'), stroke: record('stroke'),
    fillRect: record('fillRect'), clearRect: record('clearRect'),
    fillText: record('fillText'), setLineDash: record('setLineDash'),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    measureText: (t) => ({ width: String(t).length * 6 }),
    arcs() { return this.calls.filter((c) => c.name === 'arc'); },
    texts() { return this.calls.filter((c) => c.name === 'fillText').map((c) => c.args[0]); },
  };
}

const VIEWPORT = { width: 800, height: 600 };
const VIEW = { centreAltitudeDeg: 45, centreAzimuthDeg: 180, fieldOfViewDeg: 120 };

const star = (over) => ({
  hr: 1, ra: 0, dec: 0, vmag: 1, bv: 0, constellation: 'Xxx',
  greek: null, name: null, distanceLy: null, spectralType: null,
  altitudeDeg: 45, azimuthDeg: 180, ...over,
});

const baseScene = (over) => ({
  viewport: VIEWPORT,
  view: VIEW,
  stars: [],
  figures: [],
  limitingMagnitude: 5.3,
  showFigures: false,
  labelFor: (s) => s.name,
  cardinals: { n: 'N', e: 'E', s: 'S', w: 'W' },
  ...over,
});

describe('turning the catalogue into positions in your sky', () => {
  it('gives every star an altitude and an azimuth', () => {
    const out = skyPositionsFor([star({ ra: 101.2871, dec: -16.7161 })], 41.3, 100);
    expect(out).toHaveLength(1);
    expect(Number.isFinite(out[0].altitudeDeg)).toBe(true);
    expect(Number.isFinite(out[0].azimuthDeg)).toBe(true);
  });

  it('keeps the catalogue fields alongside, so nothing has to look them up again', () => {
    const out = skyPositionsFor([star({ hr: 2491, name: 'Sirius' })], 41.3, 100);
    expect(out[0].hr).toBe(2491);
    expect(out[0].name).toBe('Sirius');
  });
});

describe('what gets drawn', () => {
  it('draws a star that is up', () => {
    const ctx = recordingContext();
    drawSky(ctx, baseScene({ stars: [star({ altitudeDeg: 45, azimuthDeg: 180 })] }));
    expect(ctx.arcs().length).toBeGreaterThan(0);
  });

  it('draws nothing for a star below the horizon', () => {
    // The one mistake a child can catch and we cannot: they go outside, and
    // the thing the screen promised is under their feet.
    const ctx = recordingContext();
    drawSky(ctx, baseScene({ stars: [star({ altitudeDeg: -20, azimuthDeg: 180 })] }));
    expect(ctx.arcs()).toHaveLength(0);
  });

  it('draws nothing for a star too faint for the sky the child is under', () => {
    const ctx = recordingContext();
    drawSky(ctx, baseScene({
      stars: [star({ vmag: 5.2 })],
      limitingMagnitude: 4,
    }));
    expect(ctx.arcs()).toHaveLength(0);
  });

  it('draws the same star once the sky is dark enough for it', () => {
    const ctx = recordingContext();
    drawSky(ctx, baseScene({
      stars: [star({ vmag: 5.2 })],
      limitingMagnitude: 6,
    }));
    expect(ctx.arcs().length).toBeGreaterThan(0);
  });

  it('marks the four cardinal directions so the child knows which way to turn', () => {
    const ctx = recordingContext();
    drawSky(ctx, baseScene());
    expect(ctx.texts()).toContain('S');
  });

  it('names a star that has a name', () => {
    const ctx = recordingContext();
    drawSky(ctx, baseScene({ stars: [star({ name: 'Sirius', vmag: -1.46 })] }));
    expect(ctx.texts()).toContain('Sirius');
  });

  it('uses the name the caller hands it, not the catalogue English', () => {
    // The label goes through `labelFor` precisely so a Russian reader sees
    // Cyrillic. If the renderer ever reads `star.name` directly, this fails.
    const ctx = recordingContext();
    drawSky(ctx, baseScene({
      stars: [star({ name: 'Sirius', vmag: -1.46 })],
      labelFor: () => 'Сириус',
    }));
    expect(ctx.texts()).toContain('Сириус');
    expect(ctx.texts()).not.toContain('Sirius');
  });

  it('leaves the faint majority unlabelled, or the sky is a wall of text', () => {
    const ctx = recordingContext();
    drawSky(ctx, baseScene({
      stars: [star({ name: 'Faint thing', vmag: 4.9 })],
    }));
    expect(ctx.texts()).not.toContain('Faint thing');
  });

  it('joins a constellation up only when it is asked to', () => {
    const a = star({ hr: 1, altitudeDeg: 40, azimuthDeg: 175 });
    const b = star({ hr: 2, altitudeDeg: 50, azimuthDeg: 185 });
    const figures = [{ abbreviation: 'Xxx', links: [[a, b]] }];

    const off = recordingContext();
    drawSky(off, baseScene({ stars: [a, b], figures, showFigures: false }));
    const on = recordingContext();
    drawSky(on, baseScene({ stars: [a, b], figures, showFigures: true }));

    expect(on.calls.filter((c) => c.name === 'lineTo').length)
      .toBeGreaterThan(off.calls.filter((c) => c.name === 'lineTo').length);
  });

  it('does not join a constellation across the horizon', () => {
    // Half of Orion is up and half is not; drawing the line anyway puts a
    // stick figure through the ground.
    const up = star({ hr: 1, altitudeDeg: 40, azimuthDeg: 175 });
    const down = star({ hr: 2, altitudeDeg: -30, azimuthDeg: 185 });
    const scene = { stars: [up, down], showFigures: true };

    // The horizon is itself a polyline, so counting `lineTo` calls alone
    // proves nothing -- compare against the same scene with no figure in it.
    const withLink = recordingContext();
    drawSky(withLink, baseScene({
      ...scene, figures: [{ abbreviation: 'Xxx', links: [[up, down]] }],
    }));
    const withoutLink = recordingContext();
    drawSky(withoutLink, baseScene({ ...scene, figures: [] }));

    const lines = (c) => c.calls.filter((call) => call.name === 'lineTo').length;
    expect(lines(withLink)).toBe(lines(withoutLink));
  });
});

describe('tapping the sky', () => {
  const sirius = star({ hr: 2491, name: 'Sirius', vmag: -1.46, altitudeDeg: 45, azimuthDeg: 180 });

  it('finds the star under the finger', () => {
    const hit = starAt(400, 300, [sirius], VIEW, VIEWPORT);
    expect(hit?.hr).toBe(2491);
  });

  it('finds nothing in empty sky', () => {
    expect(starAt(50, 50, [sirius], VIEW, VIEWPORT)).toBeNull();
  });

  it('prefers the brighter star when two are close together', () => {
    // A child aiming at Mizar with a fingertip is aiming at Alcor too. The one
    // they meant is the one they can see.
    const faint = star({ hr: 9, vmag: 4.9, altitudeDeg: 45.3, azimuthDeg: 180.3 });
    expect(starAt(400, 300, [faint, sirius], VIEW, VIEWPORT)?.hr).toBe(2491);
  });

  it('ignores a star that is below the horizon', () => {
    const under = star({ hr: 7, altitudeDeg: -45, azimuthDeg: 0 });
    expect(starAt(400, 300, [under], VIEW, VIEWPORT)).toBeNull();
  });
});
