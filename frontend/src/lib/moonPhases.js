import {
  EclipticGeoMoon,
  MoonPhase,
  NextLunarEclipse,
  NodeEventKind,
  SearchGlobalSolarEclipse,
  SearchLunarEclipse,
  SearchMoonNode,
  SunPosition,
} from 'astronomy-engine';

/**
 * The Moon's phases, and why there is not an eclipse every month.
 *
 * Used by the Laboratory's Moon module. Two halves:
 *
 * **The phase cycle, as arithmetic.** The Moon's age is the time since new
 * moon; its phase angle (elongation from the Sun) grows uniformly through one
 * synodic month, and the lit fraction of the disc seen from Earth is
 *
 *   k = (1 - cos theta) / 2
 *
 * which is 0 at new moon, 1/2 at the quarters and 1 at full. The mean
 * elongation is not uniform in reality — the orbit is an ellipse — but the
 * error is a few hours of age, invisible on this page.
 *
 * **Eclipses, as geometry.** The Moon's orbit is tilted 5.145 degrees to the
 * ecliptic, so at most new and full moons it passes above or below the Sun or
 * Earth's shadow. An eclipse needs a syzygy near one of the two nodes, where
 * the orbit crosses the ecliptic. The Sun comes back to the same node once
 * per eclipse year of 346.62 days, so eclipses cluster into two "seasons" a
 * year. The page asks one question: is the Sun close enough to a node?
 * The ecliptic limits used are the approximate upper ones — about 18 degrees
 * for a solar eclipse and about 12 degrees for an umbral lunar eclipse. The
 * exact limits depend on the distances to the Sun and Moon, which is why the
 * module calls an eclipse "possible", not "certain". The lunar limit is the
 * umbral one: a faint penumbral eclipse can happen up to about 17 degrees from
 * a node, and the module does not count those (the real-date presets skip
 * them, so the page never shows a real eclipse it calls impossible).
 *
 * When the Moon is visible follows from the same angle. It is highest in the
 * sky about theta/15 hours after the Sun is — at local midnight when full, at
 * sunset at first quarter — so the page can say "evening", "all night" or
 * "before dawn" without pretending to a clock time that depends on the season
 * and the observer's longitude.
 *
 * Constants:
 *   synodic month   29.530589 d   mean, new moon to new moon
 *   eclipse year    346.620075 d  Sun to the same lunar node
 *   inclination     5.145 deg     mean, Moon's orbit to the ecliptic
 *   Source: Meeus, Astronomical Algorithms, 2nd ed. (1998), ch. 47-49 and 54;
 *   NASA GSFC Moon Fact Sheet.
 *
 * Real dates — today's age, where the node is, the next eclipses — come from
 * astronomy-engine (Cosinekitty), which the Sky and Solar System pages use.
 */

/** Mean synodic month, days. */
export const SYNODIC_MONTH_DAYS = 29.530589;

/** Mean sidereal month — one turn among the stars — days (Meeus, ch. 49). */
export const SIDEREAL_MONTH_DAYS = 27.321662;

/** Eclipse year: the Sun's return to the same lunar node, days. */
export const ECLIPSE_YEAR_DAYS = 346.620075;

/** Mean inclination of the Moon's orbit to the ecliptic, degrees. */
export const MOON_INCLINATION_DEG = 5.145;

/** Approximate upper ecliptic limits, degrees from a node. */
export const SOLAR_ECLIPSE_LIMIT_DEG = 18;
export const LUNAR_ECLIPSE_LIMIT_DEG = 12;

/** How far the Sun moves against the nodes in one synodic month, degrees. */
export const NODE_STEP_PER_MONTH_DEG = (360 * SYNODIC_MONTH_DAYS) / ECLIPSE_YEAR_DAYS;

const HALF_MONTH = SYNODIC_MONTH_DAYS / 2;
const RAD = Math.PI / 180;

/** Wrap an angle into [0, 360). */
export function wrap360(deg) {
  return ((deg % 360) + 360) % 360;
}

/** Wrap an age into [0, synodic month). */
export function wrapAge(days) {
  return ((days % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS) % SYNODIC_MONTH_DAYS;
}

/** Elongation from the Sun for a Moon of `ageDays`, degrees: 0 new, 180 full. */
export function phaseAngleDeg(ageDays) {
  return (360 * wrapAge(ageDays)) / SYNODIC_MONTH_DAYS;
}

/** Lit fraction of the disc seen from Earth, 0..1. */
export function illuminatedFraction(ageDays) {
  return (1 - Math.cos(phaseAngleDeg(ageDays) * RAD)) / 2;
}

/** True from new moon to full moon. */
export function isWaxing(ageDays) {
  return wrapAge(ageDays) < HALF_MONTH;
}

/**
 * The eight phase names, in order from new moon, as `lab` locale keys. Each
 * covers an eighth of the month centred on its phase angle, so "first
 * quarter" is the three and a half days around day 7.4.
 */
export const PHASE_KEYS = [
  'moonPhaseNew',
  'moonPhaseWaxingCrescent',
  'moonPhaseFirstQuarter',
  'moonPhaseWaxingGibbous',
  'moonPhaseFull',
  'moonPhaseWaningGibbous',
  'moonPhaseLastQuarter',
  'moonPhaseWaningCrescent',
];

/** Which of the eight phases an age falls in, 0..7. */
export function phaseIndex(ageDays) {
  return Math.round(wrapAge(ageDays) / (SYNODIC_MONTH_DAYS / 8)) % 8;
}

/** The age at the middle of phase `index`, days. */
export function phaseCenterAge(index) {
  return (index * SYNODIC_MONTH_DAYS) / 8;
}

export function phaseKey(ageDays) {
  return PHASE_KEYS[phaseIndex(ageDays)];
}

/** Days until the next full moon (0 at full). */
export function daysToFull(ageDays) {
  const age = wrapAge(ageDays);
  return age <= HALF_MONTH ? HALF_MONTH - age : SYNODIC_MONTH_DAYS - age + HALF_MONTH;
}

/** Days until the next new moon. */
export function daysToNew(ageDays) {
  return SYNODIC_MONTH_DAYS - wrapAge(ageDays);
}

/**
 * The Sun's angle from the Moon's ascending node, `ageDays` into a lunation
 * that began with the Sun `sigmaAtNewDeg` from it.
 */
export function sunNodeAngleDeg(sigmaAtNewDeg, ageDays) {
  return wrap360(sigmaAtNewDeg + (ageDays * 360) / ECLIPSE_YEAR_DAYS);
}

/** Angular distance from `angleDeg` to the nearer of the two nodes, 0..90. */
export function distanceFromNodeDeg(angleDeg) {
  const a = wrap360(angleDeg) % 180;
  return Math.min(a, 180 - a);
}

/**
 * The Moon's height above the ecliptic, degrees, at `ageDays` into the
 * lunation. Its argument of latitude is the Sun's angle from the node plus the
 * Moon's elongation from the Sun.
 */
export function moonLatitudeDeg(sigmaAtNewDeg, ageDays, inclinationDeg = MOON_INCLINATION_DEG) {
  const argument = sunNodeAngleDeg(sigmaAtNewDeg, ageDays) + phaseAngleDeg(ageDays);
  return Math.asin(Math.sin(inclinationDeg * RAD) * Math.sin(argument * RAD)) / RAD;
}

/**
 * Whether this lunation's new and full moons can be eclipses.
 *
 * With `inclinationDeg` 0 — the "what if the orbit were flat" toggle — every
 * new moon is a solar eclipse and every full moon a lunar one, which is the
 * point of the toggle.
 */
export function eclipsesThisMonth(sigmaAtNewDeg, inclinationDeg = MOON_INCLINATION_DEG) {
  if (inclinationDeg === 0) return { solar: true, lunar: true };
  return {
    solar: distanceFromNodeDeg(sunNodeAngleDeg(sigmaAtNewDeg, 0)) < SOLAR_ECLIPSE_LIMIT_DEG,
    lunar: distanceFromNodeDeg(sunNodeAngleDeg(sigmaAtNewDeg, HALF_MONTH)) < LUNAR_ECLIPSE_LIMIT_DEG,
  };
}

/**
 * Within a day of new or full: the times an eclipse can actually be happening.
 *
 * In the last day of a lunation the new moon that matters is the coming one,
 * a month of node drift later than the one the lunation began with. Checking
 * the old one put a real solar eclipse a day early on the wrong side of the
 * limit.
 */
export function eclipseNow(ageDays, sigmaAtNewDeg, inclinationDeg = MOON_INCLINATION_DEG) {
  const age = wrapAge(ageDays);
  const month = eclipsesThisMonth(sigmaAtNewDeg, inclinationDeg);
  if (age < 1 && month.solar) return 'solar';
  if (age > SYNODIC_MONTH_DAYS - 1) {
    const next = inclinationDeg === 0
      || distanceFromNodeDeg(sunNodeAngleDeg(sigmaAtNewDeg, SYNODIC_MONTH_DAYS)) < SOLAR_ECLIPSE_LIMIT_DEG;
    return next ? 'solar' : null;
  }
  if (Math.abs(age - HALF_MONTH) < 1 && month.lunar) return 'lunar';
  return null;
}

/**
 * When a Moon of `ageDays` can be seen, as a `lab` locale key.
 *
 * By its angle from the Sun: within about 15 degrees it is lost in the glare;
 * a waxing Moon is up in the evening, a full one all night (it rises as the
 * Sun sets), a waning one after midnight and before dawn.
 */
export function visibilityKey(ageDays) {
  const theta = phaseAngleDeg(ageDays);
  if (theta < 15 || theta > 345) return 'moonSeeNone';
  if (theta < 100) return 'moonSeeEvening';
  if (theta < 160) return 'moonSeeEveningNight';
  if (theta < 200) return 'moonSeeAllNight';
  if (theta < 260) return 'moonSeeNightMorning';
  return 'moonSeeMorning';
}

/**
 * The Moon's height above the ecliptic, degrees, at which a syzygy is
 * `nodeLimitDeg` from the node — the ecliptic limit restated as a latitude,
 * for drawing the eclipse window in the side view.
 */
export function latitudeLimitDeg(nodeLimitDeg, inclinationDeg = MOON_INCLINATION_DEG) {
  return Math.asin(Math.sin(inclinationDeg * RAD) * Math.sin(nodeLimitDeg * RAD)) / RAD;
}

/** The Moon's real age at `date`, days. */
export function moonAgeAt(date) {
  return (MoonPhase(date) / 360) * SYNODIC_MONTH_DAYS;
}

/**
 * The real Sun-to-ascending-node angle at the start of the lunation `date`
 * falls in, degrees.
 *
 * The node's longitude is read off the Moon's own position the next time it
 * crosses the ecliptic; the node drifts only 0.05 degrees a day, so the few
 * days between now and that crossing do not matter here.
 */
export function sunNodeAngleAtNewMoon(date) {
  const node = SearchMoonNode(date);
  const crossing = EclipticGeoMoon(node.time).lon;
  const ascending = node.kind === NodeEventKind.Ascending ? crossing : crossing + 180;
  const sigmaNow = SunPosition(date).elon - ascending;
  return wrap360(sigmaNow - (moonAgeAt(date) * 360) / ECLIPSE_YEAR_DAYS);
}

/**
 * The page's state for a real moment: `{ age, sigma }`, where `sigma` is the
 * Sun's angle from the node at the start of the lunation `age` belongs to.
 *
 * In the last half day before new moon the lunation that is about to begin is
 * the one that matters — a solar eclipse is a new moon — so that moment is
 * given as age 0 of the next lunation rather than age 29.5 of this one.
 */
export function moonStateAt(date) {
  const age = moonAgeAt(date);
  const sigma = sunNodeAngleAtNewMoon(date);
  if (age > SYNODIC_MONTH_DAYS - 0.5) {
    return { age: 0, sigma: wrap360(sigma + (SYNODIC_MONTH_DAYS * 360) / ECLIPSE_YEAR_DAYS) };
  }
  return { age, sigma };
}

/** The next solar and lunar eclipses after `date`, as `{ kind, date }`. */
export function nextEclipses(date) {
  const solar = SearchGlobalSolarEclipse(date);
  const lunar = SearchLunarEclipse(date);
  return {
    solar: { kind: solar.kind, date: solar.peak.date },
    lunar: { kind: lunar.kind, date: lunar.peak.date },
  };
}

/**
 * The next lunar eclipse after `date` that reaches Earth's umbra — partial or
 * total — as `{ kind, date }`. Penumbral ones are skipped: they are faint, and
 * they sit beyond the umbral limit this page uses.
 */
export function nextUmbralLunarEclipse(date) {
  let eclipse = SearchLunarEclipse(date);
  for (let i = 0; i < 12 && eclipse.kind === 'penumbral'; i += 1) eclipse = NextLunarEclipse(eclipse.peak);
  return { kind: eclipse.kind, date: eclipse.peak.date };
}
