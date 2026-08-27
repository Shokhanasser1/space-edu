/**
 * Where a star is in your sky, from where you are and when you look.
 *
 * Four functions and about forty lines of trigonometry, replacing this, which
 * is what the star finder shipped with:
 *
 *   const baseAzimuth  = ((locIndex + 1) * (starIndex + 1) * 47) % 360;
 *   const baseAltitude = ((locIndex + 1) + (starIndex + 1) * 13) % 90;
 *
 * The maths is standard and old. Everything here follows Meeus, *Astronomical
 * Algorithms*, 2nd ed., chapters 12 (sidereal time) and 13 (transformation of
 * coordinates); the constants are quoted from it rather than fitted to
 * anything. `skyPosition.test.js` checks the results against facts you can look
 * up — Polaris sits as high as your latitude, Canopus never rises over
 * Uzbekistan, a star transits at 90 - |latitude - declination| — so a
 * transcription slip fails the build instead of quietly pointing a child at the
 * wrong wall.
 *
 * What this deliberately does not model: precession (positions are J2000 and
 * we draw them as J2000 — about 0.4 degrees of drift by 2026, well under a
 * finger's width at arm's length), nutation, aberration, proper motion, and
 * atmospheric refraction near the horizon. All of them are smaller than the
 * error in "I think that bright one, over there". If somebody later wants to
 * point a telescope with this, they need all four and this comment is the
 * warning that they are missing.
 */

const DEG = Math.PI / 180;
const sin = (deg) => Math.sin(deg * DEG);
const cos = (deg) => Math.cos(deg * DEG);

/** Degrees into [0, 360). */
export function normaliseDegrees(deg) {
  return ((deg % 360) + 360) % 360;
}

/**
 * Julian day from a JavaScript Date. 1970-01-01T00:00:00Z is JD 2440587.5, and
 * a Date is milliseconds from exactly that instant, so this is the whole
 * conversion — no calendar arithmetic and no leap-year edge case to get wrong.
 */
export function julianDay(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

/**
 * Greenwich mean sidereal time, in degrees. Meeus eq. 12.4.
 *
 * Sidereal time is the sky's own clock: it is the right ascension currently
 * crossing your meridian. It runs about four minutes a day fast on a wall
 * clock, which is why the same constellation rises earlier each night and why
 * the sky has seasons.
 */
export function greenwichMeanSiderealTimeDeg(jd) {
  const d = jd - 2451545.0;
  const t = d / 36525;
  return normaliseDegrees(
    280.46061837 + 360.98564736629 * d + 0.000387933 * t * t - (t * t * t) / 38710000,
  );
}

/**
 * Local mean sidereal time, in degrees, for a longitude east of Greenwich.
 * Uzbekistan is around +69, so a star crosses Tashkent's meridian 69 degrees of
 * sidereal time — about four and a half hours — before it crosses London's.
 */
export function localSiderealTimeDeg(date, longitudeDeg) {
  return normaliseDegrees(greenwichMeanSiderealTimeDeg(julianDay(date)) + longitudeDeg);
}

/**
 * Equatorial (right ascension, declination) to horizontal (altitude, azimuth).
 * Meeus eq. 13.5 and 13.6, with the azimuth turned round.
 *
 * Altitude is degrees above the horizon; negative means it is below your feet.
 * **Azimuth is measured from north through east** — 0 is north, 90 is east,
 * 180 is south — because that is what a compass and every phone's orientation
 * sensor report, and `ARCameraView` subtracts a compass heading from it.
 * Meeus measures azimuth westward from south, hence the + 180 below; getting
 * that backwards points you at the opposite wall and looks entirely plausible
 * on screen.
 */
export function horizontalFromEquatorial(raDeg, decDeg, latitudeDeg, localSiderealDeg) {
  const h = localSiderealDeg - raDeg; // hour angle: how far past your meridian
  const altitudeDeg =
    Math.asin(sin(decDeg) * sin(latitudeDeg) + cos(decDeg) * cos(latitudeDeg) * cos(h)) / DEG;

  const azimuthFromSouth =
    Math.atan2(sin(h), cos(h) * sin(latitudeDeg) - Math.tan(decDeg * DEG) * cos(latitudeDeg)) / DEG;

  return { altitudeDeg, azimuthDeg: normaliseDegrees(azimuthFromSouth + 180) };
}

/**
 * The eight compass points, as locale keys rather than words: a Russian or
 * Uzbek child is not helped by "NNE". The caller looks the key up in
 * `skyView.compass.*`.
 */
const COMPASS_KEYS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

export function compassKey(azimuthDeg) {
  const index = Math.round(normaliseDegrees(azimuthDeg) / 45) % 8;
  return COMPASS_KEYS[index];
}
