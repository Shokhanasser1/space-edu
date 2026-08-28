/**
 * The star finder did not do astronomy. It did this:
 *
 *   const baseAzimuth  = ((locIndex + 1) * (starIndex + 1) * 47) % 360;
 *   const baseAltitude = ((locIndex + 1) + (starIndex + 1) * 13) % 90;
 *
 * Array positions, dressed up with a one-second spinner. Move Tashkent to the
 * top of the list and every star in the sky moves with it; wait six hours and
 * nothing moves at all. The `lat` and `lon` on all 28 locations in
 * `src/data/stars.js` were never read by anything.
 *
 * So these are not regression tests for a bug that was found. They are the
 * check that the replacement is real, and every one of them is a fact about
 * the sky that can be looked up rather than a number this code happened to
 * print. If any of them fails, the sky is wrong, not the test.
 */
import { describe, expect, it } from 'vitest';

import {
  compassKey,
  greenwichMeanSiderealTimeDeg,
  horizontalFromEquatorial,
  julianDay,
  localSiderealTimeDeg,
} from './skyPosition';

// Bright Star Catalogue positions, J2000, straight out of skyCatalog.json.
const POLARIS = { ra: 37.9529, dec: 89.2642 };
const DUBHE = { ra: 165.9319, dec: 61.751 };
const CANOPUS = { ra: 95.9879, dec: -52.6958 };
const SIRIUS = { ra: 101.2871, dec: -16.7161 };

const TASHKENT = { lat: 41.2995, lon: 69.2401 };
const MOSCOW = { lat: 55.7558, lon: 37.6173 };

describe('Julian day', () => {
  it('puts the J2000.0 epoch exactly where it is defined', () => {
    // 2000 January 1.5 TT is JD 2451545.0 by definition. Everything else in
    // this file is measured from that instant, so if it is off, all of it is.
    expect(julianDay(new Date('2000-01-01T12:00:00Z'))).toBeCloseTo(2451545.0, 9);
  });

  it('advances by exactly one for a day', () => {
    const a = julianDay(new Date('2026-03-01T00:00:00Z'));
    const b = julianDay(new Date('2026-03-02T00:00:00Z'));
    expect(b - a).toBeCloseTo(1, 9);
  });

  it('advances by half for twelve hours, so time of day is not ignored', () => {
    const a = julianDay(new Date('2026-03-01T00:00:00Z'));
    const b = julianDay(new Date('2026-03-01T12:00:00Z'));
    expect(b - a).toBeCloseTo(0.5, 9);
  });
});

describe('sidereal time', () => {
  it('is 280.46061837 degrees at the J2000.0 epoch', () => {
    // The defining constant of the standard GMST series (Meeus, Astronomical
    // Algorithms, ch. 12). If this is right the series was transcribed right.
    expect(greenwichMeanSiderealTimeDeg(2451545.0)).toBeCloseTo(280.46061837, 6);
  });

  it('gains about four minutes a day on the clock', () => {
    // A sidereal day is 23h56m04s, which is why the same star rises four
    // minutes earlier each night — the thing that makes seasons of the sky.
    const a = greenwichMeanSiderealTimeDeg(2451545.0);
    const b = greenwichMeanSiderealTimeDeg(2451546.0);
    const gainedDegrees = (b - a + 360) % 360;
    expect(gainedDegrees * 4).toBeCloseTo(3.94, 1); // degrees -> minutes of time
  });

  it('is further east for a place further east, degree for degree', () => {
    const when = new Date('2026-08-28T20:00:00Z');
    const tashkent = localSiderealTimeDeg(when, TASHKENT.lon);
    const greenwich = localSiderealTimeDeg(when, 0);
    expect((tashkent - greenwich + 360) % 360).toBeCloseTo(TASHKENT.lon, 6);
  });
});

describe('where a star actually is in the sky', () => {
  it('holds Polaris at an altitude equal to your latitude, all night', () => {
    // The oldest navigation fact there is, and the one a child can check on a
    // school trip: the pole star sits as high as you are far north.
    for (const hour of [0, 3, 6, 9, 12, 15, 18, 21]) {
      const when = new Date(Date.UTC(2026, 7, 28, hour));
      const lst = localSiderealTimeDeg(when, TASHKENT.lon);
      const { altitudeDeg } = horizontalFromEquatorial(
        POLARIS.ra, POLARIS.dec, TASHKENT.lat, lst,
      );
      expect(Math.abs(altitudeDeg - TASHKENT.lat), `at ${hour}:00 UTC`).toBeLessThan(0.8);
    }
  });

  it('puts a star due south at its highest, at exactly 90 - |lat - dec|', () => {
    // A star crosses the meridian when the local sidereal time equals its
    // right ascension. That is the moment it is highest, and the altitude then
    // is fixed by geometry alone.
    const { altitudeDeg, azimuthDeg } = horizontalFromEquatorial(
      SIRIUS.ra, SIRIUS.dec, TASHKENT.lat, SIRIUS.ra,
    );
    expect(altitudeDeg).toBeCloseTo(90 - Math.abs(TASHKENT.lat - SIRIUS.dec), 6);
    expect(azimuthDeg).toBeCloseTo(180, 6); // due south, being south of the zenith
  });

  it('puts a star north of the zenith due north when it transits', () => {
    const { altitudeDeg, azimuthDeg } = horizontalFromEquatorial(
      DUBHE.ra, DUBHE.dec, TASHKENT.lat, DUBHE.ra,
    );
    expect(altitudeDeg).toBeCloseTo(90 - Math.abs(TASHKENT.lat - DUBHE.dec), 6);
    expect(azimuthDeg).toBeCloseTo(0, 6);
  });

  it('never lets Canopus rise over Uzbekistan, because it cannot', () => {
    // Declination -52.7 from latitude +41.3: the highest it ever gets is
    // 90 - |41.3 + 52.7| = -4 degrees. It is below the horizon permanently, and
    // a sky view that draws it there is lying to a child who went outside.
    for (let hour = 0; hour < 24; hour += 1) {
      const lst = localSiderealTimeDeg(new Date(Date.UTC(2026, 7, 28, hour)), TASHKENT.lon);
      const { altitudeDeg } = horizontalFromEquatorial(
        CANOPUS.ra, CANOPUS.dec, TASHKENT.lat, lst,
      );
      expect(altitudeDeg, `hour ${hour}`).toBeLessThan(0);
    }
  });

  it('never lets Dubhe set over Uzbekistan, because it cannot', () => {
    // +61.75 from +41.3 is circumpolar: it never touches the horizon.
    for (let hour = 0; hour < 24; hour += 1) {
      const lst = localSiderealTimeDeg(new Date(Date.UTC(2026, 7, 28, hour)), TASHKENT.lon);
      const { altitudeDeg } = horizontalFromEquatorial(
        DUBHE.ra, DUBHE.dec, TASHKENT.lat, lst,
      );
      expect(altitudeDeg, `hour ${hour}`).toBeGreaterThan(0);
    }
  });

  it('answers differently for two different places at the same instant', () => {
    // The whole point of the location dropdown, and the thing index arithmetic
    // could not do: Tashkent and Moscow do not see Sirius in the same place.
    const when = new Date('2026-01-15T20:00:00Z');
    const fromTashkent = horizontalFromEquatorial(
      SIRIUS.ra, SIRIUS.dec, TASHKENT.lat, localSiderealTimeDeg(when, TASHKENT.lon),
    );
    const fromMoscow = horizontalFromEquatorial(
      SIRIUS.ra, SIRIUS.dec, MOSCOW.lat, localSiderealTimeDeg(when, MOSCOW.lon),
    );
    expect(Math.abs(fromTashkent.altitudeDeg - fromMoscow.altitudeDeg)).toBeGreaterThan(5);
  });

  it('answers differently for the same place six hours apart', () => {
    const lat = TASHKENT.lat;
    const early = horizontalFromEquatorial(
      SIRIUS.ra, SIRIUS.dec, lat,
      localSiderealTimeDeg(new Date('2026-01-15T18:00:00Z'), TASHKENT.lon),
    );
    const late = horizontalFromEquatorial(
      SIRIUS.ra, SIRIUS.dec, lat,
      localSiderealTimeDeg(new Date('2026-01-16T00:00:00Z'), TASHKENT.lon),
    );
    expect(Math.abs(early.altitudeDeg - late.altitudeDeg)).toBeGreaterThan(10);
  });

  it('measures azimuth from north through east, the way a compass does', () => {
    // A star one hour of right ascension east of the meridian is in the
    // eastern half of the sky, so its azimuth is between 90 and 180 seen from
    // the northern hemisphere looking south. Getting this convention backwards
    // is the classic way to send someone outside facing the wrong wall.
    const { azimuthDeg } = horizontalFromEquatorial(
      SIRIUS.ra, SIRIUS.dec, TASHKENT.lat, SIRIUS.ra - 15,
    );
    expect(azimuthDeg).toBeGreaterThan(90);
    expect(azimuthDeg).toBeLessThan(180);
  });

  it('keeps azimuth inside 0-360 rather than handing back a negative', () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const lst = localSiderealTimeDeg(new Date(Date.UTC(2026, 7, 28, hour)), TASHKENT.lon);
      const { azimuthDeg } = horizontalFromEquatorial(
        SIRIUS.ra, SIRIUS.dec, TASHKENT.lat, lst,
      );
      expect(azimuthDeg, `hour ${hour}`).toBeGreaterThanOrEqual(0);
      expect(azimuthDeg, `hour ${hour}`).toBeLessThan(360);
    }
  });
});

describe('compass points', () => {
  it('names the four cardinals at the four cardinal azimuths', () => {
    expect(compassKey(0)).toBe('n');
    expect(compassKey(90)).toBe('e');
    expect(compassKey(180)).toBe('s');
    expect(compassKey(270)).toBe('w');
  });

  it('rounds to the nearest of the eight, and wraps past north', () => {
    expect(compassKey(44)).toBe('ne');
    expect(compassKey(359)).toBe('n');
    expect(compassKey(-1)).toBe('n');
  });
});
