/**
 * The physics of the "worlds in action" module, against numbers a reader can
 * look up: a Perseid grain of one gram carries the energy of hundreds of grams
 * of TNT; the 2018 Martian dust storm let through only about one fifty-
 * thousandth of the direct sunbeam; a vent on Io throwing gas at 1 km/s builds
 * a plume close to Pele's 300 km, five and a half times what the same throw
 * would reach on Earth.
 */
import { describe, expect, it } from 'vitest';

import {
  EARTH_GRAVITY,
  IO,
  MARS_TAU,
  METEOR_SHOWERS,
  TNT_J_PER_GRAM,
  directSunlight,
  fastestShower,
  grainEnergyJ,
  nextPeak,
  plumeHeightKm,
  soonestShower,
  speedForHeightMs,
} from './worldPhenomena';

describe('meteor showers', () => {
  it('lists each shower once, in calendar order', () => {
    const ids = METEOR_SHOWERS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const days = METEOR_SHOWERS.map(({ peak: [m, d] }) => m * 100 + d);
    expect([...days].sort((a, b) => a - b)).toEqual(days);
  });

  it('finds the next peak, and calls a peak tonight zero days away', () => {
    const orionids = METEOR_SHOWERS.find((s) => s.id === 'orionids');
    expect(nextPeak(orionids, new Date(2026, 9, 21, 22, 0)).days).toBe(0);
    expect(nextPeak(orionids, new Date(2026, 9, 22)).days).toBe(364);
    const perseids = METEOR_SHOWERS.find((s) => s.id === 'perseids');
    expect(nextPeak(perseids, new Date(2026, 7, 1)).days).toBe(11);
  });

  it('knows which shower comes next and which is fastest', () => {
    expect(soonestShower(new Date(2026, 9, 22))).toBe('leonids');
    expect(soonestShower(new Date(2026, 11, 20))).toBe('etaAquariids');
    expect(fastestShower()).toBe('leonids');
  });

  it('gives a one-gram Perseid hundreds of grams of TNT', () => {
    const joules = grainEnergyJ(1, 59);
    expect(joules).toBeCloseTo(1.7405e6, -3);
    const tnt = joules / TNT_J_PER_GRAM;
    expect(tnt).toBeGreaterThan(400);
    expect(tnt).toBeLessThan(430);
  });
});

describe('dust on Mars', () => {
  it('lets most of the sunbeam through on a clear day', () => {
    expect(directSunlight(MARS_TAU.clear)).toBeGreaterThan(0.6);
  });

  it('cut the direct beam about fifty-thousand-fold in the 2018 storm', () => {
    const factor = 1 / directSunlight(MARS_TAU.opportunity);
    expect(factor).toBeGreaterThan(45000);
    expect(factor).toBeLessThan(55000);
  });
});

describe('plumes on Io', () => {
  it('builds a Pele-sized plume from a 1 km/s vent', () => {
    const h = plumeHeightKm(1000);
    expect(h).toBeGreaterThan(250);
    expect(h).toBeLessThan(310);
  });

  it('throws the same vent five and a half times higher than Earth would', () => {
    const ratio = plumeHeightKm(800) / plumeHeightKm(800, EARTH_GRAVITY);
    expect(ratio).toBeCloseTo(EARTH_GRAVITY / IO.gravity, 9);
    expect(ratio).toBeGreaterThan(5.4);
    expect(ratio).toBeLessThan(5.5);
  });

  it('inverts cleanly', () => {
    expect(plumeHeightKm(speedForHeightMs(300))).toBeCloseTo(300, 9);
  });
});
