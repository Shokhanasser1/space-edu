/**
 * The arithmetic under the Laboratory's habitable-zone module.
 *
 * Checked against figures a reader can look up: the Sun's zone runs from about
 * 0.95 to 1.68 au (Kopparapu et al. 2013/2014), Earth's equilibrium temperature
 * is about 255 K, and Earth sits in the zone while Venus does not.
 */
import { describe, expect, it } from 'vitest';

import {
  SOLAR_PLANETS,
  STAR_TYPES,
  SYSTEMS,
  TEFF_RANGE,
  edgeFlux,
  equilibriumTemperatureK,
  habitableZone,
  isExtrapolated,
  starlight,
  viewSpanAu,
  waterState,
} from './habitableZone';

const SUN = habitableZone(5780, 1);

describe('the Sun’s habitable zone', () => {
  it('starts at about 0.95 au', () => {
    expect(SUN.inner).toBeGreaterThan(0.94);
    expect(SUN.inner).toBeLessThan(0.96);
  });

  it('ends at about 1.68 au', () => {
    expect(SUN.outer).toBeGreaterThan(1.66);
    expect(SUN.outer).toBeLessThan(1.7);
  });

  it('holds Earth and Mars but not Venus', () => {
    const at = (key) => SOLAR_PLANETS.find((p) => p.key === key).au;
    expect(waterState(at('earth'), SUN)).toBe('liquid');
    expect(waterState(at('venus'), SUN)).toBe('hot');
    // Mars is inside the zone by this definition; it is frozen because its
    // atmosphere is too thin to warm it, which the page says.
    expect(waterState(at('mars'), SUN)).toBe('liquid');
    expect(waterState(2.5, SUN)).toBe('frozen');
  });
});

describe('the zone moves with the star', () => {
  it('scales as the square root of luminosity', () => {
    const bright = habitableZone(5780, 4);
    expect(bright.inner / SUN.inner).toBeCloseTo(2, 9);
    expect(bright.outer / SUN.outer).toBeCloseTo(2, 9);
  });

  it('sits much closer to a red dwarf than to the Sun, and further from an F star', () => {
    const zoneOf = (type) => habitableZone(STAR_TYPES[type].teff, STAR_TYPES[type].luminosity);
    expect(zoneOf('M').outer).toBeLessThan(0.35);
    expect(zoneOf('M').outer).toBeLessThan(zoneOf('K').inner);
    expect(zoneOf('F').inner).toBeGreaterThan(SUN.inner);
    for (const type of Object.keys(STAR_TYPES)) {
      const { inner, outer } = zoneOf(type);
      expect(inner).toBeLessThan(outer);
    }
  });

  it('only offers stars the fit is valid for', () => {
    for (const { teff } of Object.values(STAR_TYPES)) {
      expect(teff).toBeGreaterThanOrEqual(TEFF_RANGE[0]);
      expect(teff).toBeLessThanOrEqual(TEFF_RANGE[1]);
    }
  });

  it('clamps a temperature outside the fit to its edge', () => {
    expect(edgeFlux('runawayGreenhouse', 2000)).toBe(edgeFlux('runawayGreenhouse', 2600));
    expect(edgeFlux('maximumGreenhouse', 9000)).toBe(edgeFlux('maximumGreenhouse', 7200));
  });
});

describe('a planet’s temperature', () => {
  it('gives Earth about 255 K without a greenhouse effect', () => {
    const t = equilibriumTemperatureK(1, 1);
    expect(t).toBeGreaterThan(253);
    expect(t).toBeLessThan(257);
  });

  it('halves at four times the distance', () => {
    expect(equilibriumTemperatureK(1, 4)).toBeCloseTo(equilibriumTemperatureK(1, 1) / 2, 9);
  });

  it('is 278.6 K for a black body at 1 au', () => {
    expect(equilibriumTemperatureK(1, 1, 0)).toBeCloseTo(278.6, 9);
  });
});

describe('the drawing scale', () => {
  it('always shows the whole zone with room to spare', () => {
    for (const { teff, luminosity } of Object.values(STAR_TYPES)) {
      const zone = habitableZone(teff, luminosity);
      const span = viewSpanAu(zone);
      expect(span).toBeGreaterThanOrEqual(zone.outer * 1.25);
      expect(span).toBeLessThan(zone.outer * 2.5);
    }
    expect(viewSpanAu(SUN)).toBe(2.5);
  });
});

describe('real systems', () => {
  const zoneOf = (id) => habitableZone(SYSTEMS[id].teff, SYSTEMS[id].luminosity);
  const statesOf = (id) =>
    Object.fromEntries(SYSTEMS[id].planets.map((p) => [p.key, waterState(p.au, zoneOf(id))]));

  it('puts TRAPPIST-1 e, f and g in the zone, as Gillon et al. (2017) found', () => {
    const states = statesOf('trappist1');
    const inside = Object.keys(states).filter((k) => states[k] === 'liquid');
    expect(inside).toEqual(['e', 'f', 'g']);
    expect(states.b).toBe('hot');
    expect(states.h).toBe('frozen');
  });

  it('says TRAPPIST-1 is cooler than the fit was made for, and the Sun is not', () => {
    expect(isExtrapolated(SYSTEMS.trappist1.teff)).toBe(true);
    expect(isExtrapolated(SYSTEMS.sun.teff)).toBe(false);
    expect(isExtrapolated(SYSTEMS.proxima.teff)).toBe(false);
  });

  it('puts Proxima b and Kepler-452b in their stars’ zones', () => {
    expect(statesOf('proxima').b).toBe('liquid');
    expect(statesOf('kepler452').b).toBe('liquid');
  });

  it('opens every system on a planet it has, inside the view', () => {
    for (const [id, system] of Object.entries(SYSTEMS)) {
      const home = system.planets.find((p) => p.key === system.home);
      expect(home, id).toBeTruthy();
      for (const planet of system.planets) expect(planet.au).toBeLessThan(viewSpanAu(zoneOf(id)));
      expect(['M', 'K', 'G', 'F']).toContain(system.starClass);
    }
  });
});

describe('starlight', () => {
  it('is 1 at Earth, about 1.9 at Venus and about 0.43 at Mars', () => {
    const at = (key) => SOLAR_PLANETS.find((p) => p.key === key).au;
    expect(starlight(1, 1)).toBe(1);
    expect(starlight(1, at('venus'))).toBeCloseTo(1.91, 2);
    expect(starlight(1, at('mars'))).toBeCloseTo(0.43, 2);
  });

  it('falls with the square of distance', () => {
    expect(starlight(1, 2)).toBeCloseTo(0.25, 12);
  });
});
