import { describe, expect, it } from 'vitest';

import { cardinalKey, compassPoint, horizontalPosition } from './starPosition';

const TASHKENT = { lat: 41.2995, lon: 69.2401 };
const POLARIS = { ra: 37.954, dec: 89.264 };
const SIRIUS = { ra: 101.287, dec: -16.716 };
const CANOPUS = { ra: 95.987, dec: -52.696 };

describe('horizontalPosition', () => {
  it('puts Polaris due north at an altitude equal to the latitude', () => {
    // True at any hour of any day, which is the whole point of Polaris.
    for (const iso of ['2026-01-15T17:00:00Z', '2026-07-15T18:00:00Z', '2026-08-28T02:30:00Z']) {
      const { azimuth, altitude } = horizontalPosition(POLARIS, TASHKENT, new Date(iso));
      expect(Math.abs(altitude - TASHKENT.lat)).toBeLessThan(1);
      expect(Math.min(azimuth, 360 - azimuth)).toBeLessThan(2);
    }
  });

  it('has Sirius in the southern sky on a January evening and gone in July', () => {
    // 22:00 in Tashkent, mid-January: Sirius is up and to the south-east.
    const winter = horizontalPosition(SIRIUS, TASHKENT, new Date('2026-01-15T17:00:00Z'));
    expect(winter.altitude).toBeGreaterThan(20);
    expect(compassPoint(winter.azimuth)).toBe('SSE');
    // The same hour in July, it is far below the horizon.
    const summer = horizontalPosition(SIRIUS, TASHKENT, new Date('2026-07-15T18:00:00Z'));
    expect(summer.altitude).toBeLessThan(0);
  });

  it('never raises Canopus above the horizon of Uzbekistan', () => {
    // Declination −52.7° from latitude 41.3°N: it cannot rise. This is why
    // the star was taken out of the catalogue rather than given an image.
    for (let hour = 0; hour < 24; hour += 1) {
      const { altitude } = horizontalPosition(CANOPUS, TASHKENT, new Date(Date.UTC(2026, 0, 15, hour)));
      expect(altitude).toBeLessThan(0);
    }
  });

  it('always answers with an azimuth in [0, 360)', () => {
    for (let hour = 0; hour < 24; hour += 3) {
      const { azimuth } = horizontalPosition(SIRIUS, TASHKENT, new Date(Date.UTC(2026, 2, 1, hour)));
      expect(azimuth).toBeGreaterThanOrEqual(0);
      expect(azimuth).toBeLessThan(360);
    }
  });
});

describe('compassPoint', () => {
  it('names the sixteen points', () => {
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(22.5)).toBe('NNE');
    expect(compassPoint(90)).toBe('E');
    expect(compassPoint(180)).toBe('S');
    expect(compassPoint(270)).toBe('W');
    expect(compassPoint(348.75)).toBe('N');
  });

  it('does not read below the table for a negative or oversized azimuth', () => {
    // The hand-rolled version did `dirs[Math.round(az / 22.5) % 16]` on an
    // atan2 result, and `dirs[-3]` is undefined.
    expect(compassPoint(-90)).toBe('W');
    expect(compassPoint(-10)).toBe('N');
    expect(compassPoint(450)).toBe('E');
  });
});

describe('cardinalKey', () => {
  it('maps quadrants to the existing translation keys', () => {
    expect(cardinalKey(10)).toBe('north');
    expect(cardinalKey(350)).toBe('north');
    expect(cardinalKey(100)).toBe('east');
    expect(cardinalKey(200)).toBe('south');
    expect(cardinalKey(260)).toBe('west');
  });
});
