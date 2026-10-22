/**
 * The geometry under the Laboratory's observatory module.
 *
 * Checked against figures a reader can look up: from a 1 km mountain the
 * horizon lies about one degree down; Eratosthenes' 1/50 of a circle over
 * about 800 km gives the familiar 40 000 km; and the noon Sun at Samarkand on
 * the two solstices gives back the tilt and latitude it was computed from.
 */
import { describe, expect, it } from 'vitest';

import {
  BIRUNI_RADIUS_KM,
  CITIES,
  EARTH_MEAN_CIRCUMFERENCE_KM,
  EARTH_MEAN_RADIUS_KM,
  ERATOSTHENES_ANGLE_DEG,
  OBLIQUITY_DEG,
  SAMARKAND_LATITUDE_DEG,
  STADION_M,
  SYENE_ALEXANDRIA_STADIA,
  VIEWPOINTS,
  arcminuteSensitivity,
  dipAngleDeg,
  eratosthenes,
  fromSolsticeAltitudes,
  horizonDistanceKm,
  noonAltitudeDeg,
  radiusFromDip,
  relativeError,
  shadowAngleDeg,
  shadowLength,
  solsticeAltitudes,
  stadiaToKm,
} from './earthMeasure';

describe("Biruni's dip of the horizon", () => {
  it('is about one degree from a 1 km mountain', () => {
    expect(dipAngleDeg(1)).toBeCloseTo(1.015, 3);
  });

  it('grows with the mountain, roughly as its square root', () => {
    expect(dipAngleDeg(4) / dipAngleDeg(1)).toBeCloseTo(2, 2);
  });

  it('gives back the radius it was computed from', () => {
    for (const h of [0.1, 0.32, 1, 3]) {
      expect(radiusFromDip(h, dipAngleDeg(h))).toBeCloseTo(EARTH_MEAN_RADIUS_KM, 6);
    }
  });

  it('never meets the ground without a dip', () => {
    expect(radiusFromDip(1, 0)).toBe(Infinity);
    expect(radiusFromDip(1, -0.5)).toBe(Infinity);
  });

  it('turns a one-per-cent angle error into about two per cent of radius', () => {
    const alpha = dipAngleDeg(1);
    const error = relativeError(radiusFromDip(1, alpha * 1.01), EARTH_MEAN_RADIUS_KM);
    expect(error).toBeLessThan(-0.019);
    expect(error).toBeGreaterThan(-0.021);
  });

  it('makes one arcminute matter: a few per cent at 1 km', () => {
    const s = arcminuteSensitivity(1, dipAngleDeg(1));
    expect(s).toBeLessThan(-0.03);
    expect(s).toBeGreaterThan(-0.04);
  });

  it("puts Biruni's own figure within half a per cent of today's", () => {
    expect(Math.abs(relativeError(BIRUNI_RADIUS_KM, EARTH_MEAN_RADIUS_KM))).toBeLessThan(0.005);
  });
});

describe('Eratosthenes', () => {
  it('uses one fiftieth of a circle', () => {
    expect(ERATOSTHENES_ANGLE_DEG).toBeCloseTo(7.2, 12);
  });

  it('gets 40 000 km from 7.2 degrees over 800 km', () => {
    const { circumferenceKm, radiusKm } = eratosthenes(7.2, 800);
    expect(circumferenceKm).toBeCloseTo(40000, 6);
    expect(radiusKm).toBeCloseTo(40000 / (2 * Math.PI), 6);
  });
});

describe("Ulugh Beg's meridian readings", () => {
  it('puts the noon Sun where the textbook formula does', () => {
    expect(noonAltitudeDeg(41.3, 23.44)).toBeCloseTo(72.14, 2);
    expect(noonAltitudeDeg(0, 0)).toBe(90);
  });

  it('gives Samarkand a high summer Sun and a low winter one', () => {
    const { summer, winter } = solsticeAltitudes();
    expect(summer).toBeCloseTo(73.79, 2);
    expect(winter).toBeCloseTo(26.91, 2);
  });

  it('returns the tilt and latitude the readings came from', () => {
    const { summer, winter } = solsticeAltitudes(SAMARKAND_LATITUDE_DEG, OBLIQUITY_DEG);
    const { tiltDeg, latitudeDeg } = fromSolsticeAltitudes(summer, winter);
    expect(tiltDeg).toBeCloseTo(OBLIQUITY_DEG, 10);
    expect(latitudeDeg).toBeCloseTo(SAMARKAND_LATITUDE_DEG, 10);
  });
});

describe('real places to stand', () => {
  it('see the horizon about 113 km away from a 1 km mountain', () => {
    expect(horizonDistanceKm(1)).toBeCloseTo(112.9, 1);
  });

  it('see about 336 km from Everest, and under 5 km from a beach', () => {
    expect(horizonDistanceKm(8.849)).toBeCloseTo(335.9, 0);
    expect(horizonDistanceKm(0.0017)).toBeGreaterThan(4.5);
    expect(horizonDistanceKm(0.0017)).toBeLessThan(4.8);
  });

  it('are listed from lowest to highest, inside the 9 km slider', () => {
    const heights = VIEWPOINTS.map((v) => v.heightKm);
    expect([...heights].sort((a, b) => a - b)).toEqual(heights);
    expect(Math.max(...heights)).toBeLessThanOrEqual(9);
  });

  it('lose less to one arcminute the higher they are: about 5 % to about 1 %', () => {
    const cost = VIEWPOINTS.map((v) => Math.abs(arcminuteSensitivity(v.heightKm, dipAngleDeg(v.heightKm))));
    for (let i = 1; i < cost.length; i += 1) expect(cost[i]).toBeLessThan(cost[i - 1]);
    expect(cost[0]).toBeGreaterThan(0.045);
    expect(cost[0]).toBeLessThan(0.055);
    expect(cost[cost.length - 1]).toBeGreaterThan(0.009);
    expect(cost[cost.length - 1]).toBeLessThan(0.012);
  });
});

describe("Eratosthenes' stick", () => {
  it('casts a 12.6 cm shadow from 1 m with the Sun 7.2 degrees from the zenith', () => {
    expect(shadowLength(100, ERATOSTHENES_ANGLE_DEG)).toBeCloseTo(12.63, 2);
  });

  it('turns a shadow back into the angle it came from', () => {
    expect(shadowAngleDeg(shadowLength(100, 7.2), 100)).toBeCloseTo(7.2, 10);
    expect(shadowAngleDeg(0, 100)).toBe(0);
  });

  it('puts the two stadion lengths 1.6 % low and about 16 % high', () => {
    const low = eratosthenes(7.2, stadiaToKm(SYENE_ALEXANDRIA_STADIA, STADION_M.egyptian));
    const high = eratosthenes(7.2, stadiaToKm(SYENE_ALEXANDRIA_STADIA, STADION_M.attic));
    expect(stadiaToKm(SYENE_ALEXANDRIA_STADIA, STADION_M.egyptian)).toBeCloseTo(787.5, 10);
    expect(relativeError(low.circumferenceKm, EARTH_MEAN_CIRCUMFERENCE_KM)).toBeCloseTo(-0.016, 3);
    expect(relativeError(high.circumferenceKm, EARTH_MEAN_CIRCUMFERENCE_KM)).toBeGreaterThan(0.15);
    expect(relativeError(high.circumferenceKm, EARTH_MEAN_CIRCUMFERENCE_KM)).toBeLessThan(0.16);
  });

  it('measures against a mean circumference of about 40 030 km', () => {
    expect(EARTH_MEAN_CIRCUMFERENCE_KM).toBeCloseTo(40030, -1);
  });
});

describe('cities for the meridian arc', () => {
  it('give back their own latitude from two solstice readings', () => {
    for (const city of CITIES) {
      const { summer, winter } = solsticeAltitudes(city.latitudeDeg, OBLIQUITY_DEG);
      expect(fromSolsticeAltitudes(summer, winter).latitudeDeg).toBeCloseTo(city.latitudeDeg, 10);
    }
  });

  it('keep the summer noon Sun south of the zenith, so one formula serves them all', () => {
    for (const city of CITIES) expect(solsticeAltitudes(city.latitudeDeg).summer).toBeLessThan(90);
  });

  it('start with Samarkand', () => {
    expect(CITIES[0]).toEqual({ id: 'samarkand', latitudeDeg: SAMARKAND_LATITUDE_DEG });
  });
});
