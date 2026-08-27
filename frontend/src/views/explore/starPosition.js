/**
 * Where a star is in the sky, for somebody standing at a given place and time.
 *
 * The first version of the rewritten finder did this by hand and got three
 * things wrong at once: the Julian day used a zero-based month and no time of
 * day, the hour angle subtracted an east longitude instead of adding it, and
 * `atan2` gave a negative azimuth that indexed the compass table below zero —
 * so "Direction" read `undefined`. astronomy-engine is already a dependency
 * (the solar system runs on it) and does the whole thing in one call.
 */
import { Horizon, Observer } from 'astronomy-engine';

/** Sixteen-point compass, clockwise from north. */
export const COMPASS_POINTS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

const wrap360 = (deg) => ((deg % 360) + 360) % 360;

/**
 * @param {{ ra: number, dec: number }} star  J2000 right ascension and
 *   declination, both in degrees.
 * @param {{ lat: number, lon: number }} place  Degrees; east longitude positive.
 * @param {Date} [date]
 * @returns {{ azimuth: number, altitude: number }}  Degrees. Azimuth is
 *   0–360 from north through east; altitude is negative below the horizon.
 */
export function horizontalPosition(star, place, date = new Date()) {
  const observer = new Observer(place.lat, place.lon, 0);
  // Horizon() takes right ascension in sidereal hours, not degrees.
  const h = Horizon(date, observer, star.ra / 15, star.dec, 'normal');
  return { azimuth: wrap360(h.azimuth), altitude: h.altitude };
}

/** 'N', 'NNE', … for an azimuth in degrees; any sign or range. */
export function compassPoint(azimuth) {
  return COMPASS_POINTS[Math.round(wrap360(azimuth) / 22.5) % 16];
}

/** The nearest of the four cardinal points, as a translation key. */
export function cardinalKey(azimuth) {
  const a = wrap360(azimuth);
  if (a >= 45 && a < 135) return 'east';
  if (a >= 135 && a < 225) return 'south';
  if (a >= 225 && a < 315) return 'west';
  return 'north';
}
