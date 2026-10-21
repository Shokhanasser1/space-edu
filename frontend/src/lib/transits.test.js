/**
 * The arithmetic under the Laboratory's exoplanet module.
 *
 * Every number the module prints comes from here, so every one is checked
 * against a figure a reader could look up: Jupiter dims the Sun by about one
 * per cent, Earth by about 84 parts per million, Earth's transit seen from far
 * away lasts about thirteen hours, and a one-year orbit round the Sun is one
 * astronomical unit across.
 */
import { describe, expect, it } from 'vitest';

import {
  AU_KM,
  EARTH_RADIUS_KM,
  JUPITER_RADIUS_KM,
  OBSERVATION,
  REAL_PLANETS,
  STAR_TYPES,
  SUN_RADIUS_KM,
  buildLightCurve,
  earthRadiiFromRatio,
  evaluateMarks,
  measureDepth,
  modelFlux,
  planetClassKey,
  radiusRatio,
  radiusRatioFromJupiters,
  randomPlanet,
  semiMajorAxisKm,
  snapToDip,
  transitCenters,
  transitDepth,
  transitDurationDays,
} from './transits';

/** A hot Jupiter like HD 209458 b, round a Sun-sized star. */
const HOT_JUPITER = { rpOverRs: radiusRatioFromJupiters(1), periodDays: 3.52, epochDays: 1.2, seed: 7 };

describe('how deep a transit is', () => {
  it('is the ratio of the two areas', () => {
    expect(transitDepth(0.1)).toBeCloseTo(0.01, 12);
    expect(transitDepth(0.2) / transitDepth(0.1)).toBeCloseTo(4, 12);
  });

  it('makes Jupiter dim the Sun by about one per cent', () => {
    const depth = transitDepth(JUPITER_RADIUS_KM / SUN_RADIUS_KM);
    expect(depth).toBeGreaterThan(0.0104);
    expect(depth).toBeLessThan(0.0107);
  });

  it('makes Earth dim the Sun by about 84 parts per million', () => {
    const depth = transitDepth(EARTH_RADIUS_KM / SUN_RADIUS_KM);
    expect(depth * 1e6).toBeGreaterThan(83);
    expect(depth * 1e6).toBeLessThan(85);
  });

  it('turns a radius ratio back into Earth radii', () => {
    expect(earthRadiiFromRatio(radiusRatioFromJupiters(1))).toBeCloseTo(JUPITER_RADIUS_KM / EARTH_RADIUS_KM, 9);
  });
});

describe('how long a transit lasts', () => {
  it('puts a one-year orbit one astronomical unit from the Sun', () => {
    expect(semiMajorAxisKm(365.256) / AU_KM).toBeCloseTo(1, 3);
  });

  it('gives Earth crossing the Sun about thirteen hours', () => {
    const hours = transitDurationDays(365.256, EARTH_RADIUS_KM / SUN_RADIUS_KM) * 24;
    expect(hours).toBeGreaterThan(12.5);
    expect(hours).toBeLessThan(13.5);
  });

  it('gives a 3.5-day hot Jupiter about three hours', () => {
    const hours = transitDurationDays(HOT_JUPITER.periodDays, HOT_JUPITER.rpOverRs) * 24;
    expect(hours).toBeGreaterThan(2.5);
    expect(hours).toBeLessThan(3.5);
  });
});

describe('the light curve', () => {
  const duration = transitDurationDays(HOT_JUPITER.periodDays, HOT_JUPITER.rpOverRs);

  it('is full depth at mid-transit and untouched between transits', () => {
    expect(modelFlux(1.2, HOT_JUPITER, duration)).toBeCloseTo(1 - transitDepth(HOT_JUPITER.rpOverRs), 12);
    expect(modelFlux(1.2 + 3.52 * 2, HOT_JUPITER, duration)).toBeCloseTo(1 - transitDepth(HOT_JUPITER.rpOverRs), 9);
    expect(modelFlux(3, HOT_JUPITER, duration)).toBe(1);
  });

  it('ramps in and out rather than stepping', () => {
    const edge = 1.2 + duration / 2 - 0.001;
    const flux = modelFlux(edge, HOT_JUPITER, duration);
    expect(flux).toBeGreaterThan(1 - transitDepth(HOT_JUPITER.rpOverRs));
    expect(flux).toBeLessThan(1);
  });

  it('repeats once a period, and always shows at least two transits', () => {
    const centers = transitCenters(HOT_JUPITER);
    expect(centers.length).toBeGreaterThanOrEqual(2);
    expect(centers[1] - centers[0]).toBeCloseTo(3.52, 9);
  });

  it('draws the same noise for the same planet', () => {
    expect(buildLightCurve(HOT_JUPITER).flux).toEqual(buildLightCurve(HOT_JUPITER).flux);
  });

  it('has the scatter it says it has', () => {
    const quiet = { ...HOT_JUPITER, rpOverRs: 0 };
    const { flux } = buildLightCurve(quiet);
    const mean = flux.reduce((a, b) => a + b, 0) / flux.length;
    const sd = Math.sqrt(flux.reduce((a, b) => a + (b - mean) ** 2, 0) / flux.length);
    expect(sd).toBeGreaterThan(OBSERVATION.noise * 0.9);
    expect(sd).toBeLessThan(OBSERVATION.noise * 1.1);
  });
});

describe('reading a planet off the data', () => {
  const curve = buildLightCurve(HOT_JUPITER);
  const centers = transitCenters(HOT_JUPITER);

  it('moves a tap that missed by two hours onto the dip', () => {
    expect(Math.abs(snapToDip(curve, centers[0] + 0.09) - centers[0])).toBeLessThan(0.02);
  });

  it('measures the depth to within a few per cent', () => {
    const measured = measureDepth(curve, snapToDip(curve, centers[1]));
    const truth = transitDepth(HOT_JUPITER.rpOverRs);
    expect(Math.abs(measured - truth) / truth).toBeLessThan(0.08);
  });

  it('says so when nothing has been marked', () => {
    expect(evaluateMarks([], HOT_JUPITER, curve).status).toBe('empty');
  });

  it('says so when a mark is on noise', () => {
    const result = evaluateMarks([centers[0], 3.0], HOT_JUPITER, curve);
    expect(result).toEqual({ status: 'miss', misses: 1 });
  });

  it('asks for a second transit before it will give a period', () => {
    expect(evaluateMarks([centers[0]], HOT_JUPITER, curve).status).toBe('one');
    // Two marks on the same dip are still one transit.
    expect(evaluateMarks([centers[0], centers[0] + 0.01], HOT_JUPITER, curve).status).toBe('one');
  });

  it('refuses a spacing that skips a transit', () => {
    expect(evaluateMarks([centers[0], centers[2]], HOT_JUPITER, curve).status).toBe('skipped');
  });

  it('gives back the period and the size from neighbouring transits', () => {
    const marks = centers.slice(0, 3).map((t) => snapToDip(curve, t + 0.05));
    const result = evaluateMarks(marks, HOT_JUPITER, curve);
    expect(result.status).toBe('found');
    expect(Math.abs(result.period - 3.52) / 3.52).toBeLessThan(0.02);
    const trueRadius = earthRadiiFromRatio(HOT_JUPITER.rpOverRs);
    expect(Math.abs(result.radiusEarth - trueRadius) / trueRadius).toBeLessThan(0.06);
  });
});

describe('planet size classes', () => {
  it('follows the Kepler boundaries', () => {
    expect(planetClassKey(1.0, 365)).toBe('exoTypeEarth');
    expect(planetClassKey(1.5, 10)).toBe('exoTypeSuperEarth');
    expect(planetClassKey(4, 10)).toBe('exoTypeNeptune');
    expect(planetClassKey(11.2, 3.5)).toBe('exoTypeHotJupiter');
    expect(planetClassKey(11.2, 4333)).toBe('exoTypeJupiter');
  });
});

describe('the mystery star', () => {
  it('is the same star for the same seed', () => {
    expect(randomPlanet(42)).toEqual(randomPlanet(42));
  });

  it('always hides a planet that can be found by eye', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const planet = randomPlanet(seed);
      expect(transitDepth(planet.rpOverRs)).toBeGreaterThan(4 * OBSERVATION.noise);
      expect(transitCenters(planet).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('goes round every kind of star the reader can pick, bar TRAPPIST-1', () => {
    const kinds = new Set();
    for (let seed = 1; seed <= 200; seed += 1) kinds.add(randomPlanet(seed).star.id);
    expect([...kinds].sort()).toEqual(['kdwarf', 'mdwarf', 'sunlike']);
  });

  it('can be found from two taps two hours off, round any of them', () => {
    // A red dwarf's transits last about an hour, a Sun-like star's three; the
    // depth window has to fit both or the short ones read shallow.
    let worst = 0;
    for (let seed = 1; seed <= 150; seed += 1) {
      const planet = randomPlanet(seed);
      const curve = buildLightCurve(planet);
      const marks = transitCenters(planet).slice(0, 2).map((t) => snapToDip(curve, t + 0.08));
      const result = evaluateMarks(marks, planet, curve);
      expect(result.status, `seed ${seed}`).toBe('found');
      const truth = earthRadiiFromRatio(planet.rpOverRs, planet.star);
      worst = Math.max(worst, Math.abs(result.radiusEarth - truth) / truth);
    }
    expect(worst).toBeLessThan(0.15);
  });
});

describe('the host star', () => {
  const earthAround = (star) => transitDepth(radiusRatio(1, star));

  it('makes the same planet a deeper dip round a smaller star', () => {
    const depths = STAR_TYPES.map(earthAround);
    for (let i = 1; i < depths.length; i += 1) expect(depths[i]).toBeGreaterThan(depths[i - 1]);
  });

  it('puts an Earth round TRAPPIST-1 at about half a per cent, sixty times the Sun', () => {
    const trappist = STAR_TYPES.find((s) => s.id === 'trappist');
    expect(earthAround(trappist)).toBeGreaterThan(0.0055);
    expect(earthAround(trappist)).toBeLessThan(0.0062);
    expect(earthAround(trappist) / earthAround(STAR_TYPES[0])).toBeGreaterThan(60);
  });

  it('shows TRAPPIST-1 is barely bigger than Jupiter', () => {
    const trappist = STAR_TYPES.find((s) => s.id === 'trappist');
    const jupitersAcross = (trappist.radiusSun * SUN_RADIUS_KM) / JUPITER_RADIUS_KM;
    expect(jupitersAcross).toBeGreaterThan(1.1);
    expect(jupitersAcross).toBeLessThan(1.25);
  });

  it('reads a planet back to the same radius whatever the star', () => {
    for (const star of STAR_TYPES) expect(earthRadiiFromRatio(radiusRatio(2.5, star), star)).toBeCloseTo(2.5, 9);
  });

  it('shrinks the orbit for a lighter star at the same period', () => {
    expect(semiMajorAxisKm(5, 0.3)).toBeLessThan(semiMajorAxisKm(5, 1));
    // Kepler's third law: a^3 is proportional to M.
    expect((semiMajorAxisKm(5, 0.3) / semiMajorAxisKm(5, 1)) ** 3).toBeCloseTo(0.3, 9);
  });
});

describe('the real planets', () => {
  const planet = (id) => REAL_PLANETS.find((p) => p.id === id);
  const depthOf = (p) => transitDepth(radiusRatio(p.radiusEarth, p.star));

  it('give HD 209458 b its published 1.46 per cent', () => {
    // Torres, Winn & Holman (2008): Rp/Rs = 0.1209.
    expect(depthOf(planet('hd209458b'))).toBeGreaterThan(0.0144);
    expect(depthOf(planet('hd209458b'))).toBeLessThan(0.0148);
  });

  it('give HD 189733 b its published 2.4 per cent', () => {
    expect(depthOf(planet('hd189733b'))).toBeGreaterThan(0.0236);
    expect(depthOf(planet('hd189733b'))).toBeLessThan(0.0242);
  });

  it('give TRAPPIST-1 e about half a per cent, in under an hour', () => {
    const p = planet('trappist1e');
    expect(depthOf(p)).toBeGreaterThan(0.0048);
    expect(depthOf(p)).toBeLessThan(0.0052);
    // Agol et al. (2021): a = 0.02925 au.
    expect(semiMajorAxisKm(p.periodDays, p.star.massSun) / AU_KM).toBeCloseTo(0.0293, 3);
    const hours = transitDurationDays(p.periodDays, radiusRatio(p.radiusEarth, p.star), p.star) * 24;
    expect(hours).toBeGreaterThan(0.8);
    expect(hours).toBeLessThan(1.05);
  });

  it('give 55 Cancri e a dip smaller than one point of noise', () => {
    const depth = depthOf(planet('cnc55e'));
    expect(depth).toBeGreaterThan(0.00031);
    expect(depth).toBeLessThan(0.00035);
    expect(depth).toBeLessThan(OBSERVATION.noise);
  });

  it('all fit at least two transits into the twelve days', () => {
    for (const p of REAL_PLANETS) {
      expect(transitCenters({ epochDays: 1.2, periodDays: p.periodDays }).length, p.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('are classed the way the papers class them', () => {
    expect(planetClassKey(planet('hd209458b').radiusEarth, planet('hd209458b').periodDays)).toBe('exoTypeHotJupiter');
    expect(planetClassKey(planet('cnc55e').radiusEarth, planet('cnc55e').periodDays)).toBe('exoTypeSuperEarth');
    expect(planetClassKey(planet('trappist1e').radiusEarth, planet('trappist1e').periodDays)).toBe('exoTypeEarth');
  });
});
