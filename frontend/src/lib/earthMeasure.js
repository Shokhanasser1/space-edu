/**
 * Measuring the Earth from the ground: three methods a pupil can repeat.
 *
 * The Laboratory's observatory module is built on these. Each is a single
 * geometric idea, and each comes with the number the historical observer
 * reported, so the reader can compare their own measurement with theirs.
 *
 * 1. **Biruni's method (dip of the horizon).** From the top of a mountain of
 *    height h, the horizon lies a small angle alpha below the horizontal. The
 *    line of sight to the horizon touches the Earth, so it is perpendicular to
 *    the radius there, and
 *
 *      cos(alpha) = R / (R + h)    =>    R = h * cos(alpha) / (1 - cos(alpha))
 *
 *    `1 - cos(alpha)` is computed as `2 sin^2(alpha / 2)`: for an angle of one
 *    degree the subtraction loses most of its significant figures otherwise.
 *    Because R goes as 1 / alpha^2 for small angles, a one-per-cent error in
 *    the angle is a two-per-cent error in the radius — the module shows this.
 *    Abu Rayhan Biruni (born 973 in Kath, Khwarazm) used this method; his
 *    result is commonly given as 6 339.6 km.
 *
 * 2. **Eratosthenes (c. 240 BC).** At noon on the summer solstice the Sun was
 *    overhead at Syene, while at Alexandria a gnomon's shadow showed the Sun
 *    one fiftieth of a circle (7.2 degrees) from the zenith. The two cities lie
 *    on roughly the same meridian, so the distance between them is 1/50 of the
 *    circumference. Source: Cleomedes, "On the Heavens" (Caelestia) 1.7. He
 *    gave the distance in stadia, and the length of the stadion he used is not
 *    known for certain, so the module takes the distance in kilometres.
 *
 * 3. **A meridian instrument (Ulugh Beg's observatory, Samarkand).** The noon
 *    altitude of the Sun is h = 90 - latitude + declination. On the solstices
 *    the declination is +tilt and -tilt, so two readings give both
 *
 *      tilt     = (h_summer - h_winter) / 2
 *      latitude = 90 - (h_summer + h_winter) / 2
 *
 * Constants:
 *
 *   R (Earth, mean)   6 371 km     IUGG mean radius R1 = 6 371.0088 km
 *                                  (Moritz, "Geodetic Reference System 1980")
 *   axial tilt        23.44 deg    mean obliquity at J2000.0, 23 deg 26' 21.4''
 *                                  (IAU; it changes by under a degree in
 *                                  thousands of years)
 *   Samarkand         39.65 deg N  latitude of the city
 *   Sun's diameter    0.53 deg     apparent angular diameter, mean
 *
 * Atmospheric refraction is ignored throughout; it bends a ray grazing the
 * horizon by around half a degree, which is why the module says so.
 *
 * Real places, so a reader can stand somewhere they know:
 *
 *   Tashkent TV Tower    375 m         official height of the tower
 *   Burj Khalifa         828 m         Council on Tall Buildings and Urban Habitat
 *   Big Chimgan          3 309 m       Western Tian Shan, Tashkent region
 *   Everest              8 848.86 m    China–Nepal joint survey, 2020
 *
 * Khazret Sultan's long-quoted 4 643 m is left out on purpose: recent ascents
 * dispute it as Uzbekistan's highest point, and a teaching page should not
 * pick a side in a survey argument.
 *
 * City latitudes for the meridian instrument are city centres rounded to
 * 0.01 degree.
 */

/** IUGG mean radius of the Earth, km (rounded). */
export const EARTH_MEAN_RADIUS_KM = 6371;

/** Mean obliquity of the ecliptic at J2000.0, degrees. */
export const OBLIQUITY_DEG = 23.44;

/** Latitude of Samarkand, degrees north. */
export const SAMARKAND_LATITUDE_DEG = 39.65;

/** Mean apparent angular diameter of the Sun, degrees. */
export const SUN_ANGULAR_DIAMETER_DEG = 0.53;

/** Eratosthenes' shadow angle at Alexandria: one fiftieth of a circle, degrees. */
export const ERATOSTHENES_ANGLE_DEG = 360 / 50;

/** Biruni's Earth radius as it is commonly converted to kilometres. */
export const BIRUNI_RADIUS_KM = 6339.6;

const DEG = Math.PI / 180;

/** Dip of the horizon seen from `heightKm` above a sphere of `radiusKm`, degrees. */
export function dipAngleDeg(heightKm, radiusKm = EARTH_MEAN_RADIUS_KM) {
  return Math.acos(radiusKm / (radiusKm + heightKm)) / DEG;
}

/**
 * The Earth's radius from a mountain height and a measured dip, km.
 * A dip of zero or less never meets the ground: the radius is infinite.
 */
export function radiusFromDip(heightKm, dipDeg) {
  if (!(dipDeg > 0)) return Infinity;
  const a = dipDeg * DEG;
  return (heightKm * Math.cos(a)) / (2 * Math.sin(a / 2) ** 2);
}

/** Signed fractional error of `measured` against `truth`. */
export function relativeError(measured, truth) {
  return (measured - truth) / truth;
}

/** Fractional change in the derived radius for one arcminute more dip. */
export function arcminuteSensitivity(heightKm, dipDeg) {
  return radiusFromDip(heightKm, dipDeg + 1 / 60) / radiusFromDip(heightKm, dipDeg) - 1;
}

/** Eratosthenes: circumference and radius from a shadow angle and a distance. */
export function eratosthenes(shadowDeg, distanceKm) {
  const circumferenceKm = (distanceKm * 360) / shadowDeg;
  return { circumferenceKm, radiusKm: circumferenceKm / (2 * Math.PI) };
}

/** Noon altitude of the Sun for an observer north of the Sun's declination, degrees. */
export function noonAltitudeDeg(latitudeDeg, declinationDeg) {
  return 90 - latitudeDeg + declinationDeg;
}

/** Noon altitudes on the two solstices. */
export function solsticeAltitudes(latitudeDeg = SAMARKAND_LATITUDE_DEG, tiltDeg = OBLIQUITY_DEG) {
  return {
    summer: noonAltitudeDeg(latitudeDeg, tiltDeg),
    winter: noonAltitudeDeg(latitudeDeg, -tiltDeg),
  };
}

/** Axial tilt and latitude back out of two solstice readings, degrees. */
export function fromSolsticeAltitudes(summerDeg, winterDeg) {
  return {
    tiltDeg: (summerDeg - winterDeg) / 2,
    latitudeDeg: 90 - (summerDeg + winterDeg) / 2,
  };
}

/** Mean circumference of the Earth, km: 2 pi times the IUGG mean radius (about 40 030 km). */
export const EARTH_MEAN_CIRCUMFERENCE_KM = 2 * Math.PI * EARTH_MEAN_RADIUS_KM;

/**
 * Places to stand for Biruni's method. `kind` decides how the summit is drawn;
 * the module names each one through its own locale key.
 */
export const VIEWPOINTS = [
  { id: 'tower', heightKm: 0.375, kind: 'tower' },
  { id: 'burj', heightKm: 0.828, kind: 'spire' },
  { id: 'chimgan', heightKm: 3.309, kind: 'mountain' },
  { id: 'everest', heightKm: 8.849, kind: 'mountain' },
];

/**
 * How far away the horizon is from `heightKm` up: the length of the line of
 * sight that just grazes the sphere, km. sqrt((R + h)^2 - R^2) = sqrt(h (2R + h)).
 */
export function horizonDistanceKm(heightKm, radiusKm = EARTH_MEAN_RADIUS_KM) {
  return Math.sqrt(heightKm * (2 * radiusKm + heightKm));
}

/** Sun's angle from the zenith read off a vertical stick and its shadow, degrees. */
export function shadowAngleDeg(shadowLength, stickLength) {
  return Math.atan2(shadowLength, stickLength) / DEG;
}

/** Shadow of a vertical stick when the Sun stands `angleDeg` from the zenith. */
export function shadowLength(stickLength, angleDeg) {
  return stickLength * Math.tan(angleDeg * DEG);
}

/**
 * Eratosthenes' 5 000 stadia from Syene to Alexandria (Cleomedes), turned into
 * kilometres with the two stadion lengths historians argue between: the
 * "Egyptian" 157.5 m and the Attic 185 m. Which one he meant is not known.
 */
export const SYENE_ALEXANDRIA_STADIA = 5000;
export const STADION_M = { egyptian: 157.5, attic: 185 };

/** Syene–Alexandria in km for a stadion of `stadionM` metres. */
export function stadiaToKm(stadia, stadionM) {
  return (stadia * stadionM) / 1000;
}

/** Cities for the meridian instrument, latitude in degrees north. */
export const CITIES = [
  { id: 'samarkand', latitudeDeg: SAMARKAND_LATITUDE_DEG },
  { id: 'tashkent', latitudeDeg: 41.3 },
  { id: 'bukhara', latitudeDeg: 39.77 },
  { id: 'nukus', latitudeDeg: 42.45 },
  { id: 'termez', latitudeDeg: 37.22 },
];
