/**
 * Seasons: where the Sun stands at noon, how long the day lasts, and why
 * neither has anything to do with how far away the Sun is.
 *
 * The Laboratory's seasons module is built on this. Everything is computed
 * from the date and the axial tilt — there is no table of day lengths here —
 * so the tilt slider can be dragged to 0 or 90 degrees and the numbers stay
 * honest about a planet that does not exist.
 *
 * The Sun's position is the US Naval Observatory's "approximate solar
 * coordinates" algorithm (USNO Astronomical Applications Department), good to
 * about a minute of arc for dates within two centuries of 2000:
 *
 *   d = JD - 2451545.0                         days since J2000.0
 *   g = 357.529 + 0.98560028 d                 mean anomaly of the Sun
 *   q = 280.459 + 0.98564736 d                 mean longitude of the Sun
 *   L = q + 1.915 sin g + 0.020 sin 2g         apparent ecliptic longitude
 *   R = 1.00014 - 0.01671 cos g - 0.00014 cos 2g   distance, au
 *
 * and the declination for a tilt e is sin(dec) = sin(e) sin(L). The USNO uses
 * the real obliquity there; the module lets the reader replace it.
 *
 * The rest is the standard spherical astronomy of Meeus, "Astronomical
 * Algorithms" (2nd ed., 1998), chapter 15:
 *
 *   noon altitude   h = 90 - |lat - dec|   (the Sun is north of the zenith
 *                                           when dec > lat)
 *   sunrise/sunset  cos H0 = (sin h0 - sin lat sin dec) / (cos lat cos dec)
 *                   with h0 = -0.833 degrees: 34' of refraction at the
 *                   horizon plus 16' for the Sun's upper limb
 *   day length      2 H0 / 15 hours; no solution means polar day or night
 *
 * Constants:
 *   obliquity   23.44 degrees  (23.4393 at J2000.0, IAU 2006 precession)
 *   Tashkent    41.3 degrees N
 *   au          149 597 870.7 km  (IAU 2012 Resolution B2)
 *
 * Dates are for the year 2026, at noon UT. A day either way moves the
 * declination by less than half a degree, which is why the module can speak
 * of "21 June" without saying which year.
 *
 * Sunrise and sunset as clock times need two more things the latitude does
 * not give: the city's longitude and its time zone, and the equation of time
 * from the same USNO algorithm,
 *
 *   RA  = atan2(cos e sin L, cos L)          the Sun's right ascension
 *   EqT = q - RA                             in degrees; x 4 = minutes
 *   noon (local standard time) = 12 h - lon/15 - EqT + UTC offset
 *
 * and the day length either side of that noon. Every city on the list keeps
 * standard time all year (no daylight saving), so the clock times are the
 * ones on the city's clocks: Uzbekistan UTC+5, Murmansk UTC+3 (Russia,
 * permanent standard time since 2014), Quito UTC-5, Cape Town UTC+2.
 * Coordinates are city centres, rounded to 0.01 degree.
 */

/** Earth's mean obliquity, degrees (23.4393 at J2000.0, rounded as textbooks give it). */
export const EARTH_TILT_DEG = 23.44;

/** Tashkent's latitude, degrees north. */
export const TASHKENT_LAT_DEG = 41.3;

/**
 * The cities the module offers: four in Uzbekistan, and three that answer a
 * question Tashkent cannot — a polar night (Murmansk, the largest city north
 * of the Arctic Circle), the equator (Quito) and the southern hemisphere,
 * where the seasons are the other way round (Cape Town).
 * `id` names the `lab` locale key `seasonCity<Id>`; latitude is north-positive,
 * longitude east-positive, `utcOffset` in hours.
 */
export const CITIES = [
  { id: 'Tashkent', latDeg: TASHKENT_LAT_DEG, lonDeg: 69.24, utcOffset: 5 },
  { id: 'Samarkand', latDeg: 39.65, lonDeg: 66.96, utcOffset: 5 },
  { id: 'Nukus', latDeg: 42.46, lonDeg: 59.6, utcOffset: 5 },
  { id: 'Termez', latDeg: 37.22, lonDeg: 67.28, utcOffset: 5 },
  { id: 'Murmansk', latDeg: 68.97, lonDeg: 33.08, utcOffset: 3 },
  { id: 'Quito', latDeg: -0.18, lonDeg: -78.47, utcOffset: -5 },
  { id: 'CapeTown', latDeg: -33.92, lonDeg: 18.42, utcOffset: 2 },
];

export function cityById(id) {
  return CITIES.find((city) => city.id === id) ?? CITIES[0];
}

/** Altitude of the Sun's centre at sunrise and sunset, degrees (Meeus ch. 15). */
export const SUNRISE_ALTITUDE_DEG = -0.833;

/** The astronomical unit, km (IAU 2012 B2). */
export const AU_KM = 149597870.7;

/** Days in the (non-leap) year the module shows. */
export const DAYS_IN_YEAR = 365;

/** Julian Date of 2026 January 1, 0h UT. */
const JD_2026_JAN_1 = 2461041.5;
const J2000 = 2451545.0;

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Mid-month day of the year, for the twelve bars of the day-length chart. */
export const MID_MONTH_DAYS = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349];

const wrap360 = (x) => ((x % 360) + 360) % 360;

/** Days since J2000.0 at noon UT on day `dayOfYear` (1 = 1 January) of 2026. */
function daysSinceJ2000(dayOfYear) {
  return JD_2026_JAN_1 + (dayOfYear - 1) + 0.5 - J2000;
}

function meanAnomalyDeg(dayOfYear) {
  return wrap360(357.529 + 0.98560028 * daysSinceJ2000(dayOfYear));
}

/** The Sun's apparent ecliptic longitude, degrees: 0 at the March equinox, 90 at the June solstice. */
export function sunLongitudeDeg(dayOfYear) {
  const d = daysSinceJ2000(dayOfYear);
  const g = meanAnomalyDeg(dayOfYear) * RAD;
  const q = 280.459 + 0.98564736 * d;
  return wrap360(q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g));
}

/** Earth-Sun distance, au. */
export function sunDistanceAu(dayOfYear) {
  const g = meanAnomalyDeg(dayOfYear) * RAD;
  return 1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g);
}

/** The Sun's declination, degrees, for a planet tilted `tiltDeg`. */
export function declinationDeg(dayOfYear, tiltDeg = EARTH_TILT_DEG) {
  return Math.asin(Math.sin(tiltDeg * RAD) * Math.sin(sunLongitudeDeg(dayOfYear) * RAD)) * DEG;
}

/**
 * The Sun at local noon: altitude above the horizon, and which way to face.
 *
 * `side` is 'south' when the Sun crosses the meridian south of the zenith,
 * 'north' when north of it. A negative altitude means it does not rise.
 */
export function noonSun(latDeg, decDeg) {
  return {
    altitudeDeg: 90 - Math.abs(latDeg - decDeg),
    side: decDeg > latDeg ? 'north' : 'south',
  };
}

/**
 * Hours between sunrise and sunset: 24 for polar day, 0 for polar night.
 *
 * At a declination of exactly +/-90 the hour-angle formula divides by zero,
 * but the Sun then sits on the celestial pole at a fixed altitude, so the day
 * is all or nothing.
 */
export function dayLengthHours(latDeg, decDeg) {
  const sinH0 = Math.sin(SUNRISE_ALTITUDE_DEG * RAD);
  const denominator = Math.cos(latDeg * RAD) * Math.cos(decDeg * RAD);
  const numerator = sinH0 - Math.sin(latDeg * RAD) * Math.sin(decDeg * RAD);
  if (Math.abs(denominator) < 1e-9) return numerator < 0 ? 24 : 0;
  const cosH0 = numerator / denominator;
  if (cosH0 <= -1) return 24;
  if (cosH0 >= 1) return 0;
  return (2 * Math.acos(cosH0) * DEG) / 15;
}

/** Shadow of a stick `stickM` tall with the Sun at `altitudeDeg`; null when there is no Sun. */
export function shadowLengthM(altitudeDeg, stickM = 1) {
  if (altitudeDeg <= 0) return null;
  return stickM / Math.tan(altitudeDeg * RAD);
}

/**
 * The astronomical season in the northern hemisphere, as a `lab` locale key:
 * equinox to solstice and solstice to equinox, by the Sun's longitude. A planet
 * without tilt has none.
 */
export function seasonKey(dayOfYear, tiltDeg = EARTH_TILT_DEG) {
  if (tiltDeg < 0.5) return 'seasonNone';
  const longitude = sunLongitudeDeg(dayOfYear);
  if (longitude < 90) return 'seasonSpring';
  if (longitude < 180) return 'seasonSummer';
  if (longitude < 270) return 'seasonAutumn';
  return 'seasonWinter';
}

/**
 * The season by the Sun's place on the ecliptic, for a latitude: the southern
 * hemisphere has summer while the northern has winter. Within two degrees of
 * the equator the noon Sun is always high and the day always about twelve
 * hours, so the module does not pretend there is a summer there.
 */
export function seasonKeyAt(dayOfYear, tiltDeg, latDeg) {
  const north = seasonKey(dayOfYear, tiltDeg);
  if (north === 'seasonNone') return north;
  if (Math.abs(latDeg) < 2) return 'seasonEquator';
  if (latDeg > 0) return north;
  return {
    seasonSpring: 'seasonAutumn',
    seasonSummer: 'seasonWinter',
    seasonAutumn: 'seasonSpring',
    seasonWinter: 'seasonSummer',
  }[north];
}

/**
 * How strongly the noon Sun lights a flat patch of ground, as a fraction of a
 * Sun straight overhead: the same beam spread over 1/sin(h) times the area.
 * The atmosphere, which takes more of a low Sun's light, is not included.
 */
export function noonSunlightFraction(altitudeDeg) {
  return altitudeDeg <= 0 ? 0 : Math.sin(altitudeDeg * RAD);
}

/** Day lengths in the middle of each month, hours. */
export function monthlyDayLengths(latDeg, tiltDeg = EARTH_TILT_DEG) {
  return MID_MONTH_DAYS.map((day) => dayLengthHours(latDeg, declinationDeg(day, tiltDeg)));
}

/** The shortest and longest day of the year at a latitude, hours. */
export function dayLengthRange(latDeg, tiltDeg = EARTH_TILT_DEG) {
  let min = 24;
  let max = 0;
  for (let day = 1; day <= DAYS_IN_YEAR; day += 1) {
    const hours = dayLengthHours(latDeg, declinationDeg(day, tiltDeg));
    min = Math.min(min, hours);
    max = Math.max(max, hours);
  }
  return { min, max };
}

/** How many days of the year the Sun does not rise at all at a latitude. */
export function polarNightDays(latDeg, tiltDeg = EARTH_TILT_DEG) {
  let count = 0;
  for (let day = 1; day <= DAYS_IN_YEAR; day += 1) {
    if (dayLengthHours(latDeg, declinationDeg(day, tiltDeg)) <= 0) count += 1;
  }
  return count;
}

/**
 * The equation of time, minutes: how far a sundial runs ahead of a clock
 * (USNO). About +16 minutes in early November, about -14 in mid-February.
 */
export function equationOfTimeMinutes(dayOfYear, tiltDeg = EARTH_TILT_DEG) {
  const d = daysSinceJ2000(dayOfYear);
  const q = wrap360(280.459 + 0.98564736 * d);
  const longitude = sunLongitudeDeg(dayOfYear) * RAD;
  const tilt = tiltDeg * RAD;
  const ra = wrap360(Math.atan2(Math.cos(tilt) * Math.sin(longitude), Math.cos(longitude)) * DEG);
  const difference = wrap360(q - ra + 180) - 180;
  return difference * 4;
}

/**
 * Local noon, sunrise and sunset on the city's clock, hours (may run past 24).
 * `polar` is 'day' when the Sun does not set and 'night' when it does not
 * rise; `rise` and `set` are then null.
 */
export function sunTimes(dayOfYear, city, tiltDeg = EARTH_TILT_DEG) {
  const noon = 12 - city.lonDeg / 15 - equationOfTimeMinutes(dayOfYear, tiltDeg) / 60 + city.utcOffset;
  const length = dayLengthHours(city.latDeg, declinationDeg(dayOfYear, tiltDeg));
  if (length >= 24) return { noon, rise: null, set: null, polar: 'day' };
  if (length <= 0) return { noon, rise: null, set: null, polar: 'night' };
  return { noon, rise: noon - length / 2, set: noon + length / 2, polar: null };
}

/** `HH:MM` for an hour of the day, wrapped into 0-24. */
export function formatClock(hours) {
  const minutes = Math.round((((hours % 24) + 24) % 24) * 60) % (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * The days on which the Sun's longitude reaches 0, 90, 180 and 270 degrees:
 * the March equinox, June solstice, September equinox and December solstice.
 * Found from the algorithm above rather than typed in.
 */
export function equinoxesAndSolstices() {
  const targets = [0, 90, 180, 270];
  return targets.map((target) => {
    for (let day = 1; day <= DAYS_IN_YEAR; day += 1) {
      const before = wrap360(sunLongitudeDeg(day - 1) - target);
      const after = wrap360(sunLongitudeDeg(day) - target);
      if (after < before && after < 10) return day;
    }
    return null;
  });
}

/** The days of the year when Earth is nearest to and farthest from the Sun. */
export function perihelionAndAphelion() {
  let near = 1;
  let far = 1;
  for (let day = 1; day <= DAYS_IN_YEAR; day += 1) {
    if (sunDistanceAu(day) < sunDistanceAu(near)) near = day;
    if (sunDistanceAu(day) > sunDistanceAu(far)) far = day;
  }
  return { perihelionDay: near, aphelionDay: far };
}

/**
 * The day of the module's year that has the same month and date as `date` —
 * so the page can open on today. 29 February, which 2026 does not have, is
 * treated as 28 February.
 */
export function dayOfYearFor(date) {
  const month = date.getMonth();
  let day = Math.min(date.getDate(), MONTH_LENGTHS[month]);
  for (let m = 0; m < month; m += 1) day += MONTH_LENGTHS[m];
  return day;
}

/** `{ month: 0-11, day: 1-31 }` for a day of the year. */
export function calendarDate(dayOfYear) {
  let remaining = Math.min(DAYS_IN_YEAR, Math.max(1, Math.round(dayOfYear)));
  for (let month = 0; month < 12; month += 1) {
    if (remaining <= MONTH_LENGTHS[month]) return { month, day: remaining };
    remaining -= MONTH_LENGTHS[month];
  }
  return { month: 11, day: 31 };
}
