/**
 * Orbital mechanics, checked against figures a reader can look up.
 *
 * The ISS goes round about every 92 minutes, about 16 times a day; GPS
 * satellites circle twice a day at about 20 200 km (GPS.gov); a geostationary
 * satellite at 35 786 km keeps pace with one sidereal day. The new helpers for
 * the Laboratory's satellite module are held to the same standard.
 */
import { describe, expect, it } from 'vitest';

import {
  EARTH_RADIUS_KM,
  GEO_ALTITUDE_KM,
  SIDEREAL_DAY_MINUTES,
  altitudeForPeriodMinutes,
  altitudeFromSlider,
  eclipseFraction,
  greatCircleKm,
  labOrbitClass,
  orbitType,
  orbitalPeriodMinutes,
  orbitalSpeedKms,
  sliderFromAltitude,
  visibleSurfaceFraction,
} from './orbits';

describe('periods and speeds of real orbits', () => {
  it('puts the ISS (about 400 km) at about 92 minutes and 7.7 km/s', () => {
    expect(orbitalPeriodMinutes(400)).toBeGreaterThan(92);
    expect(orbitalPeriodMinutes(400)).toBeLessThan(93);
    expect(orbitalSpeedKms(400)).toBeCloseTo(7.67, 1);
    expect(1440 / orbitalPeriodMinutes(400)).toBeCloseTo(15.6, 1);
  });

  it('has GPS (about 20 200 km) going round twice a sidereal day', () => {
    expect(Math.abs(orbitalPeriodMinutes(20200) - SIDEREAL_DAY_MINUTES / 2)).toBeLessThan(2);
  });

  it('makes 35 786 km geostationary', () => {
    expect(orbitalPeriodMinutes(GEO_ALTITUDE_KM)).toBeCloseTo(SIDEREAL_DAY_MINUTES, 1);
    expect(altitudeForPeriodMinutes(SIDEREAL_DAY_MINUTES)).toBeCloseTo(GEO_ALTITUDE_KM, 0);
  });

  it('inverts the period formula exactly', () => {
    for (const h of [200, 1000, 20200, 39000]) {
      expect(altitudeForPeriodMinutes(orbitalPeriodMinutes(h))).toBeCloseTo(h, 6);
    }
  });

  it('is slower the higher it goes', () => {
    expect(orbitalSpeedKms(20200)).toBeLessThan(orbitalSpeedKms(400));
    expect(orbitalSpeedKms(GEO_ALTITUDE_KM)).toBeCloseTo(3.07, 2);
  });
});

describe("time in the Earth's shadow", () => {
  it('is about 36 minutes of an ISS orbit when the Sun is in the orbit plane', () => {
    const minutes = eclipseFraction(400, 0) * orbitalPeriodMinutes(400);
    expect(minutes).toBeGreaterThan(34);
    expect(minutes).toBeLessThan(38);
  });

  it('is at most about 70 minutes a day at geostationary height', () => {
    const minutes = eclipseFraction(GEO_ALTITUDE_KM, 0) * orbitalPeriodMinutes(GEO_ALTITUDE_KM);
    expect(minutes).toBeGreaterThan(65);
    expect(minutes).toBeLessThan(72);
  });

  it('vanishes once the Sun is far enough out of the orbit plane', () => {
    // asin(Re / a) at geostationary height is about 8.7 degrees.
    expect(eclipseFraction(GEO_ALTITUDE_KM, 9)).toBe(0);
    expect(eclipseFraction(GEO_ALTITUDE_KM, 8)).toBeGreaterThan(0);
    // and shrinks as the angle grows, below that
    expect(eclipseFraction(400, 40)).toBeLessThan(eclipseFraction(400, 0));
  });
});

describe('how much of the Earth is in view', () => {
  it('is about 3 % from the ISS and 42 % from geostationary height', () => {
    expect(visibleSurfaceFraction(400)).toBeCloseTo(0.03, 2);
    expect(visibleSurfaceFraction(GEO_ALTITUDE_KM)).toBeCloseTo(0.424, 3);
  });

  it('never reaches half the planet', () => {
    expect(visibleSurfaceFraction(1e9)).toBeLessThan(0.5);
  });
});

describe('the classification the sliders show', () => {
  it('calls 35 786 km over the equator geostationary, and inclined geosynchronous', () => {
    expect(labOrbitClass(GEO_ALTITUDE_KM, 0).id).toBe('geo');
    expect(labOrbitClass(GEO_ALTITUDE_KM, 30).id).toBe('geosync');
  });

  it('puts low, medium and high orbits where they belong', () => {
    expect(labOrbitClass(400, 51.6).id).toBe('leo');
    expect(labOrbitClass(20200, 55).id).toBe('meo');
    expect(labOrbitClass(30000, 0).id).toBe('meo');
    expect(labOrbitClass(39000, 0).id).toBe('high');
  });

  it('leaves the old altitude-only classifier as it was', () => {
    expect(orbitType(400).id).toBe('leo');
    expect(orbitType(20200).id).toBe('meo');
    expect(orbitType(GEO_ALTITUDE_KM).id).toBe('geo');
  });
});

describe('the logarithmic altitude slider', () => {
  it('round-trips and spans its range', () => {
    expect(altitudeFromSlider(0, 200, 40000)).toBeCloseTo(200, 6);
    expect(altitudeFromSlider(1, 200, 40000)).toBeCloseTo(40000, 6);
    expect(altitudeFromSlider(sliderFromAltitude(20200, 200, 40000), 200, 40000)).toBeCloseTo(20200, 6);
  });

  it('gives low orbits room: the ISS is not squeezed into the first pixel', () => {
    expect(sliderFromAltitude(400, 200, 40000)).toBeGreaterThan(0.1);
    expect(sliderFromAltitude(GEO_ALTITUDE_KM, 200, 40000)).toBeLessThan(1);
  });
});

describe('distances on the ground', () => {
  it('puts Tashkent and Samarkand about 267 km apart', () => {
    const km = greatCircleKm(41.2995, 69.2401, 39.627, 66.975);
    expect(km).toBeGreaterThan(260);
    expect(km).toBeLessThan(275);
  });

  it('measures a quarter of the equator as a quarter of the circumference', () => {
    expect(greatCircleKm(0, 0, 0, 90)).toBeCloseTo((Math.PI / 2) * 6371.0088, 3);
  });

  it('uses a radius close to, but not the same as, the equatorial one', () => {
    expect(6371.0088).toBeLessThan(EARTH_RADIUS_KM);
  });
});
