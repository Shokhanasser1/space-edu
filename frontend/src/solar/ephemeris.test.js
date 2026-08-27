import { describe, expect, it } from 'vitest';
import { BODY_BY_ID, MOONS } from './catalog';
import { bodyOrientation, distanceAU, eqjToEcliptic, helioPositionAU, moonOffsetAU } from './ephemeris';
import { keplerPosition, meanMotionDegPerDay, solveKepler } from './kepler';
import { upcomingEvents } from './events';

/**
 * Reference values are JPL Horizons vectors, heliocentric ecliptic J2000, au,
 * for 2026-Aug-27 00:00 TDB (fetched 2026-08-28). The old view was a full
 * day behind Horizons for the Earth; these keep it within an arcminute.
 */
const T0 = Date.UTC(2026, 7, 27, 0, 0, 0);
const HORIZONS = {
  earth: [9.034253769074524e-1, -4.525304755406013e-1, 2.230128718714825e-5],
  mars: [5.828285336659919e-1, 1.396614997640624, 1.497681913111784e-2],
};

const longitude = (p) => ((Math.atan2(p[1], p[0]) * 180) / Math.PI + 360) % 360;

describe('helioPositionAU against JPL Horizons', () => {
  it.each(Object.keys(HORIZONS))('%s is within 0.02° and 0.0005 au', (id) => {
    const p = helioPositionAU(BODY_BY_ID.get(id), T0);
    const ref = HORIZONS[id];
    expect(distanceAU(p, ref)).toBeLessThan(5e-4);
    expect(Math.abs(longitude(p) - longitude(ref))).toBeLessThan(0.02);
  });

  it('puts the Sun at the origin', () => {
    expect(helioPositionAU(BODY_BY_ID.get('sun'), T0)).toEqual([0, 0, 0]);
  });

  it('places the dwarf planets at sensible distances', () => {
    const r = (id) => Math.hypot(...helioPositionAU(BODY_BY_ID.get(id), T0));
    expect(r('ceres')).toBeGreaterThan(2.5);
    expect(r('ceres')).toBeLessThan(3.0);
    expect(r('eris')).toBeGreaterThan(90);
    expect(r('pluto')).toBeGreaterThan(30);
  });
});

describe('moonOffsetAU', () => {
  it('keeps the Moon 356 000–407 000 km from the Earth', () => {
    const km = Math.hypot(...moonOffsetAU(BODY_BY_ID.get('moon'), BODY_BY_ID.get('earth'), T0)) * 149597870.7;
    expect(km).toBeGreaterThan(356000);
    expect(km).toBeLessThan(407000);
  });

  it('orders the Galilean moons Io < Europa < Ganymede < Callisto', () => {
    const jupiter = BODY_BY_ID.get('jupiter');
    const r = (id) => Math.hypot(...moonOffsetAU(BODY_BY_ID.get(id), jupiter, T0));
    expect(r('io')).toBeLessThan(r('europa'));
    expect(r('europa')).toBeLessThan(r('ganymede'));
    expect(r('ganymede')).toBeLessThan(r('callisto'));
    // Io's semi-major axis is 421 800 km ≈ 0.00282 au.
    expect(r('io')).toBeGreaterThan(0.0027);
    expect(r('io')).toBeLessThan(0.0030);
  });

  it('keeps a circular-orbit moon at its semi-major axis and in the equatorial plane', () => {
    const titan = MOONS.find((m) => m.id === 'titan');
    const saturn = BODY_BY_ID.get('saturn');
    const off = moonOffsetAU(titan, saturn, T0);
    expect(Math.hypot(...off) * 149597870.7).toBeCloseTo(titan.aKm, -2);
    const { north } = bodyOrientation(saturn, T0);
    const dot = off[0] * north[0] + off[1] * north[1] + off[2] * north[2];
    expect(Math.abs(dot)).toBeLessThan(1e-9);
  });
});

describe('bodyOrientation', () => {
  it('tilts the Earth 23.4° from the ecliptic pole and keeps Q on the equator', () => {
    const { north, node } = bodyOrientation(BODY_BY_ID.get('earth'), T0);
    const tiltDeg = (Math.acos(north[2]) * 180) / Math.PI;
    expect(tiltDeg).toBeCloseTo(23.44, 1);
    const dot = north[0] * node[0] + north[1] * node[1] + north[2] * node[2];
    expect(Math.abs(dot)).toBeLessThan(1e-6);
  });

  it('spins the Earth 360.99° per day (sidereal), not the same rate as everything else', () => {
    const a = bodyOrientation(BODY_BY_ID.get('earth'), T0).spinDeg;
    const b = bodyOrientation(BODY_BY_ID.get('earth'), T0 + 86_400_000).spinDeg;
    expect(((b - a) % 360 + 360) % 360).toBeCloseTo(0.9856, 2);
    const j1 = bodyOrientation(BODY_BY_ID.get('jupiter'), T0).spinDeg;
    const j2 = bodyOrientation(BODY_BY_ID.get('jupiter'), T0 + 3_600_000).spinDeg;
    expect(((j2 - j1) % 360 + 360) % 360).toBeCloseTo(36.27, 0);
  });

  it('turns Venus backwards', () => {
    const v1 = bodyOrientation(BODY_BY_ID.get('venus'), T0).spinDeg;
    const v2 = bodyOrientation(BODY_BY_ID.get('venus'), T0 + 86_400_000).spinDeg;
    let d = (v2 - v1) % 360;
    if (d > 180) d -= 360;
    expect(d).toBeLessThan(0);
  });
});

describe('frames', () => {
  it('rotates the J2000 equatorial pole onto the ecliptic pole', () => {
    const p = eqjToEcliptic([0, 0, 1]);
    expect(p[2]).toBeCloseTo(Math.cos((23.4392911 * Math.PI) / 180), 6);
    expect(p[1]).toBeCloseTo(Math.sin((23.4392911 * Math.PI) / 180), 6);
  });
});

describe('kepler', () => {
  it('solves Kepler’s equation', () => {
    for (const e of [0, 0.1, 0.5, 0.9, 0.97]) {
      for (const M of [0.1, 1, 2.5, 4, 6]) {
        const E = solveKepler(M, e);
        expect(E - e * Math.sin(E)).toBeCloseTo(M, 8);
      }
    }
  });

  it('keeps the distance between perihelion and aphelion for a full orbit', () => {
    const el = { a: 2.766, e: 0.0797, i: 10.59, om: 80.25, w: 73.29, ma: 274.42, epochJd: 2461200.5 };
    const period = 360 / meanMotionDegPerDay(el.a);
    for (let k = 0; k <= 20; k++) {
      const r = Math.hypot(...keplerPosition(el, el.epochJd + (period * k) / 20));
      expect(r).toBeGreaterThanOrEqual(el.a * (1 - el.e) - 1e-9);
      expect(r).toBeLessThanOrEqual(el.a * (1 + el.e) + 1e-9);
    }
  });
});

describe('upcomingEvents', () => {
  it('finds a full moon, a new moon and the eclipses after a date, sorted', () => {
    const events = upcomingEvents(T0);
    const keys = events.map((e) => e.key);
    expect(keys).toContain('fullMoon');
    expect(keys).toContain('newMoon');
    expect(keys).toContain('lunarEclipse');
    expect(keys).toContain('solarEclipse');
    expect(events.filter((e) => e.key === 'opposition')).toHaveLength(3);
    for (const e of events) expect(e.ms).toBeGreaterThan(T0);
    for (let i = 1; i < events.length; i++) expect(events[i].ms).toBeGreaterThanOrEqual(events[i - 1].ms);
    // The next full moon after 27 Aug 2026 is the one on 28 Aug 2026.
    const full = events.find((e) => e.key === 'fullMoon');
    expect(new Date(full.ms).toISOString().slice(0, 10)).toBe('2026-08-28');
  });
});
