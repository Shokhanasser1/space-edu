/**
 * Orbital mechanics, in one place, shared by the Laboratory and the Live page.
 *
 * Both needed the same answers and neither had them. The Laboratory's satellite
 * module advanced its spacecraft at a fixed angular rate whatever altitude the
 * slider said, and the Live page printed altitude, velocity and inclination but
 * never a period or an orbit class, because there was nowhere to work them out.
 *
 * Everything here is derived from two constants and the vis-viva equation.
 * Nothing is a stored figure about a particular spacecraft, so there is nothing
 * here that can go stale or be wrong about a real object — the inputs come from
 * the live element set, and the outputs are arithmetic on them.
 *
 * Constants are WGS-84, which is the datum SGP4 and every TLE are expressed in:
 *
 *   mu  = 398600.4418 km^3/s^2   Earth's gravitational parameter (GM)
 *   Re  = 6378.137 km            equatorial radius
 *
 * Source: NIMA TR8350.2, "Department of Defense World Geodetic System 1984",
 * third edition, tables 3.1 and 3.4.
 */

/** Earth's gravitational parameter, km^3/s^2 (WGS-84). */
export const MU_EARTH = 398600.4418;

/** Earth's equatorial radius, km (WGS-84). */
export const EARTH_RADIUS_KM = 6378.137;

/** Altitude of a geostationary orbit above the equator, km. */
export const GEO_ALTITUDE_KM = 35786;

/**
 * The period of a circular orbit at `altitudeKm`, in minutes.
 *
 * T = 2*pi*sqrt(a^3/mu), with a = Re + altitude.
 */
export function orbitalPeriodMinutes(altitudeKm) {
  const a = EARTH_RADIUS_KM + altitudeKm;
  return (2 * Math.PI * Math.sqrt((a * a * a) / MU_EARTH)) / 60;
}

/**
 * The speed of a circular orbit at `altitudeKm`, in km/s.
 *
 * v = sqrt(mu/a). This is why a higher orbit is a slower one, which is the
 * single most counter-intuitive thing about orbits for a new reader.
 */
export function orbitalSpeedKms(altitudeKm) {
  return Math.sqrt(MU_EARTH / (EARTH_RADIUS_KM + altitudeKm));
}

/**
 * Semi-major axis in km from a TLE's mean motion, in revolutions per day.
 *
 * The inverse of the period formula: a = (mu * (T/2*pi)^2)^(1/3).
 */
export function semiMajorAxisKm(meanMotionRevPerDay) {
  if (!(meanMotionRevPerDay > 0)) return null;
  const periodSeconds = 86400 / meanMotionRevPerDay;
  const n = (2 * Math.PI) / periodSeconds;
  return Math.cbrt(MU_EARTH / (n * n));
}

/** Period in minutes from a TLE's mean motion, in revolutions per day. */
export function periodMinutesFromMeanMotion(meanMotionRevPerDay) {
  if (!(meanMotionRevPerDay > 0)) return null;
  return 1440 / meanMotionRevPerDay;
}

/**
 * Apogee and perigee altitudes in km, from mean motion and eccentricity.
 *
 * Both are heights above the equatorial radius, which is how CelesTrak's own
 * SATCAT reports them, so the two can be compared.
 */
export function apsidesKm(meanMotionRevPerDay, eccentricity) {
  const a = semiMajorAxisKm(meanMotionRevPerDay);
  if (a === null) return { apogeeKm: null, perigeeKm: null };
  const e = Number.isFinite(eccentricity) ? Math.max(0, eccentricity) : 0;
  return {
    apogeeKm: a * (1 + e) - EARTH_RADIUS_KM,
    perigeeKm: a * (1 - e) - EARTH_RADIUS_KM,
  };
}

/**
 * Which of the four orbit classes an object is in.
 *
 * The boundaries are the conventional ones, and the order matters: a highly
 * elliptical orbit is classed by its shape rather than by where its apogee
 * happens to fall, because a Molniya orbit with a 39 000 km apogee is not a
 * geostationary satellite and must not be filtered as one.
 *
 *   HEO  eccentricity above 0.25 — an orbit that is a long ellipse
 *   LEO  apogee below 2000 km
 *   GEO  period within 30 minutes of a sidereal day, inclination under 15 deg
 *   MEO  everything between LEO and geostationary
 *
 * Returns a stable id plus the locale key the interface labels it with, so no
 * caller has to hold a mapping of its own.
 */
export function classifyOrbit({ apogeeKm, perigeeKm, eccentricity, periodMinutes, inclinationDeg }) {
  if (apogeeKm === null || apogeeKm === undefined || !Number.isFinite(apogeeKm)) {
    return { id: 'unknown', labelKey: 'orbitUnknown' };
  }
  if (Number.isFinite(eccentricity) && eccentricity > 0.25) {
    return { id: 'heo', labelKey: 'orbitHeo' };
  }
  if (apogeeKm < 2000) {
    return { id: 'leo', labelKey: 'orbitLeo' };
  }
  // A sidereal day is 1436.07 minutes; a geostationary satellite matches it.
  if (
    Number.isFinite(periodMinutes) &&
    Math.abs(periodMinutes - 1436.07) < 30 &&
    (!Number.isFinite(inclinationDeg) || Math.abs(inclinationDeg) < 15) &&
    Number.isFinite(perigeeKm) &&
    perigeeKm > 30000
  ) {
    return { id: 'geo', labelKey: 'orbitGeo' };
  }
  return { id: 'meo', labelKey: 'orbitMeo' };
}

/** The simple altitude-only classification the Laboratory's slider needs. */
export function orbitType(altitudeKm) {
  if (altitudeKm < 2000) return { id: 'leo', labelKey: 'orbitLeo' };
  if (altitudeKm < GEO_ALTITUDE_KM - 1000) return { id: 'meo', labelKey: 'orbitMeo' };
  if (altitudeKm <= GEO_ALTITUDE_KM + 1000) return { id: 'geo', labelKey: 'orbitGeo' };
  return { id: 'heo', labelKey: 'orbitHeo' };
}
