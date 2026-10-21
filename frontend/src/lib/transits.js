/**
 * Transit photometry: how much a planet dims its star, for how long, and how
 * a pupil gets the planet back out of a noisy light curve.
 *
 * This is the method TESS and Kepler use, and the Laboratory's exoplanet
 * module is built on it. A planet crossing its star blocks a fraction of the
 * disc equal to the ratio of the two areas, so
 *
 *   depth = (Rp / Rs)^2
 *
 * and doubling a planet's radius makes the dip four times deeper — the one
 * idea the module asks the reader to predict before they touch anything. The
 * second idea is the other half of the same fraction: the same planet in
 * front of a smaller star blocks more of it. An Earth round the Sun dims it by
 * 84 parts per million; round TRAPPIST-1, a star barely bigger than Jupiter,
 * by half a per cent. That is why the first Earth-sized planets found in a
 * star's temperate zone were found round red dwarfs.
 *
 * The model is deliberately the textbook one, and the module says so on the
 * page: a circular orbit seen exactly edge-on (impact parameter 0), no limb
 * darkening, and white noise. Limb darkening rounds the bottom of a real dip;
 * leaving it out keeps the measured depth equal to (Rp/Rs)^2, which a
 * fourteen-year-old can check with a calculator. A real transit that does not
 * cross the middle of its star is a little shorter than the one drawn here.
 *
 * Constants are the IAU nominal values, so the same figures appear here as in
 * any table a reader looks up:
 *
 *   Rs (Sun)      695 700 km        IAU 2015 Resolution B3
 *   Rj (Jupiter)  71 492 km         IAU 2015 Resolution B3, equatorial
 *   Re (Earth)    6 378.1 km        IAU 2015 Resolution B3, equatorial
 *   GM (Sun)      1.3271244e20 m^3/s^2   IAU 2015 Resolution B3
 *   au            149 597 870.7 km  IAU 2012 Resolution B2
 *
 * Transit duration for a central transit on a circular orbit is equation 3 of
 * Seager & Mallen-Ornelas (2003), ApJ 585, 1038, with b = 0 and sin i = 1:
 *
 *   T = (P / pi) * asin( (Rs / a) * (1 + Rp/Rs) )
 *
 * with the orbit's size a from Kepler's third law and the star's mass.
 *
 * Planet size classes are the Kepler mission's (Borucki et al. 2011, ApJ 736,
 * 19): Earth-size below 1.25 Earth radii, super-Earth to 2, Neptune-size to 6,
 * and Jupiter-size above. A Jupiter-size planet on an orbit shorter than ten
 * days is a "hot Jupiter".
 *
 * Host stars. The Sun-like, orange (K) and red (M) dwarfs are typical
 * main-sequence values rounded from the table of Pecaut & Mamajek (2013),
 * ApJS 208, 9 — roughly a G2, a K5 and an M3-M4 dwarf — and the page calls
 * them typical. TRAPPIST-1 and the real planets are published values:
 *
 *   HD 209458 b   Torres, Winn & Holman (2008), ApJ 677, 1324: star 1.155 Rsun,
 *                 1.119 Msun, 6065 K; planet 1.359 Rj; P = 3.52475 d
 *   HD 189733 b   Torres, Winn & Holman (2008): star 0.756 Rsun, 0.806 Msun,
 *                 5040 K; planet 1.138 Rj; P = 2.21857 d
 *   55 Cancri e   Bourrier et al. (2018), A&A 619, A1: star 0.943 Rsun,
 *                 0.905 Msun, 5172 K; planet 1.875 Rearth; P = 0.73655 d
 *   TRAPPIST-1 e  Agol et al. (2021), PSJ 2, 1: star 0.1192 Rsun, 0.0898 Msun,
 *                 2566 K; planet 0.920 Rearth; P = 6.10101 d
 *
 * `transits.test.js` checks that each comes out with its published depth.
 */

/** Nominal solar radius, km (IAU 2015 B3). */
export const SUN_RADIUS_KM = 695700;

/** Nominal equatorial radius of Jupiter, km (IAU 2015 B3). */
export const JUPITER_RADIUS_KM = 71492;

/** Nominal equatorial radius of Earth, km (IAU 2015 B3). */
export const EARTH_RADIUS_KM = 6378.1;

/** The astronomical unit, km (IAU 2012 B2). */
export const AU_KM = 149597870.7;

/** Nominal solar mass parameter, km^3/s^2 (IAU 2015 B3). */
export const GM_SUN_KM3_S2 = 1.3271244e11;

/**
 * How the module observes: a 12-day stretch at a 10-minute cadence, with
 * 400 ppm of white noise per point. TESS full-frame images were taken every
 * 30 minutes in its first mission and every 10 minutes in its second; 400 ppm
 * is the order of scatter it gets on a bright Sun-like star. The noise is held
 * fixed whatever star is chosen — a real faint red dwarf is noisier — so that
 * a change in the dip is the planet's doing and nothing else's. Twelve days
 * keeps at least two transits in view for every period the module offers.
 */
export const OBSERVATION = {
  spanDays: 12,
  cadenceDays: 10 / (24 * 60),
  noise: 0.0004,
};

/** The host stars a reader can pick. Typical values; see the header. */
export const STAR_TYPES = [
  { id: 'sunlike', nameKey: 'exoStarSunlike', radiusSun: 1, massSun: 1, teffK: 5772 },
  { id: 'kdwarf', nameKey: 'exoStarKdwarf', radiusSun: 0.7, massSun: 0.7, teffK: 4400 },
  { id: 'mdwarf', nameKey: 'exoStarMdwarf', radiusSun: 0.3, massSun: 0.3, teffK: 3300 },
  { id: 'trappist', nameKey: 'exoStarTrappist', radiusSun: 0.1192, massSun: 0.0898, teffK: 2566 },
];

/** The star every planet goes round unless it says otherwise. */
export const SUN_LIKE = STAR_TYPES[0];

/** Real transiting planets, with the published values listed in the header. */
export const REAL_PLANETS = [
  {
    id: 'hd209458b',
    nameKey: 'exoPresetHd209458b',
    star: { id: 'hd209458', nameKey: 'exoStarHd209458', radiusSun: 1.155, massSun: 1.119, teffK: 6065 },
    radiusEarth: 15.23,
    periodDays: 3.52475,
  },
  {
    id: 'hd189733b',
    nameKey: 'exoPresetHd189733b',
    star: { id: 'hd189733', nameKey: 'exoStarHd189733', radiusSun: 0.756, massSun: 0.806, teffK: 5040 },
    radiusEarth: 12.76,
    periodDays: 2.21857,
  },
  {
    id: 'cnc55e',
    nameKey: 'exoPreset55Cnce',
    star: { id: 'cnc55', nameKey: 'exoStar55Cnc', radiusSun: 0.943, massSun: 0.905, teffK: 5172 },
    radiusEarth: 1.875,
    periodDays: 0.73655,
  },
  {
    id: 'trappist1e',
    nameKey: 'exoPresetTrappist1e',
    star: STAR_TYPES[3],
    radiusEarth: 0.92,
    periodDays: 6.10101,
  },
];

/** The star a planet goes round. */
export const starOf = (planet) => planet.star ?? SUN_LIKE;

/** Fraction of the star's light a planet of radius ratio `k` blocks. */
export function transitDepth(k) {
  return k * k;
}

/** Radius ratio Rp/Rs for a planet of `radiusEarth` Earth radii round `star`. */
export function radiusRatio(radiusEarth, star = SUN_LIKE) {
  return (radiusEarth * EARTH_RADIUS_KM) / (star.radiusSun * SUN_RADIUS_KM);
}

/** Radius ratio Rp/Rs for a planet of `radiusJupiters` round `star`. */
export function radiusRatioFromJupiters(radiusJupiters, star = SUN_LIKE) {
  return (radiusJupiters * JUPITER_RADIUS_KM) / (star.radiusSun * SUN_RADIUS_KM);
}

/** Planet radius in Earth radii from its radius ratio and its star. */
export function earthRadiiFromRatio(k, star = SUN_LIKE) {
  return (k * star.radiusSun * SUN_RADIUS_KM) / EARTH_RADIUS_KM;
}

/** Orbital radius of a circular orbit of `periodDays` round `massSun` solar masses, km. */
export function semiMajorAxisKm(periodDays, massSun = 1) {
  const p = periodDays * 86400;
  return Math.cbrt((GM_SUN_KM3_S2 * massSun * p * p) / (4 * Math.PI * Math.PI));
}

/** Total length of a central transit, first contact to last, in days. */
export function transitDurationDays(periodDays, k, star = SUN_LIKE) {
  const starKm = star.radiusSun * SUN_RADIUS_KM;
  const x = Math.min(1, (starKm / semiMajorAxisKm(periodDays, star.massSun)) * (1 + k));
  return (periodDays / Math.PI) * Math.asin(x);
}

/** The Kepler size class, as a `lab` locale key. */
export function planetClassKey(radiusEarth, periodDays) {
  if (radiusEarth < 1.25) return 'exoTypeEarth';
  if (radiusEarth < 2) return 'exoTypeSuperEarth';
  if (radiusEarth < 6) return 'exoTypeNeptune';
  return periodDays < 10 ? 'exoTypeHotJupiter' : 'exoTypeJupiter';
}

/** Seeded uniform generator, so a light curve is the same on every render. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mid-transit times inside `[0, spanDays]`. */
export function transitCenters(planet, spanDays = OBSERVATION.spanDays) {
  const centers = [];
  for (let t = planet.epochDays; t <= spanDays; t += planet.periodDays) centers.push(t);
  return centers;
}

/**
 * Noiseless relative flux at time `t` (1 = the star unobstructed).
 *
 * A trapezoid: full depth while the planet is wholly on the disc, a straight
 * ramp across ingress and egress. For b = 0 the ramp lasts T * k / (1 + k).
 */
export function modelFlux(t, planet, durationDays) {
  const k = planet.rpOverRs;
  const half = durationDays / 2;
  const ramp = (durationDays * k) / (1 + k);
  const phase = (((t - planet.epochDays) % planet.periodDays) + planet.periodDays) % planet.periodDays;
  const dt = Math.min(phase, planet.periodDays - phase);
  if (dt >= half) return 1;
  const depth = transitDepth(k);
  if (dt <= half - ramp) return 1 - depth;
  return 1 - (depth * (half - dt)) / ramp;
}

/**
 * The light curve the reader sees: model flux plus seeded Gaussian noise.
 *
 * `planet.seed` fixes the noise, so moving a slider changes the planet and not
 * the scatter — otherwise every drag would redraw a different random curve.
 */
export function buildLightCurve(planet, observation = OBSERVATION) {
  const { spanDays, cadenceDays, noise } = observation;
  const duration = transitDurationDays(planet.periodDays, planet.rpOverRs, starOf(planet));
  const random = mulberry32(planet.seed);
  const count = Math.floor(spanDays / cadenceDays) + 1;
  const times = new Array(count);
  const flux = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const t = i * cadenceDays;
    // Box-Muller: two uniforms in, one standard normal out.
    const u = Math.max(random(), 1e-12);
    const gauss = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
    times[i] = t;
    flux[i] = modelFlux(t, planet, duration) + gauss * noise;
  }
  return { times, flux, cadenceDays, duration };
}

/** Half-width of the running mean that finds a dip near a tap, days. */
const CORE_DAYS = 0.025;

/** The widest half-window a depth is read from, days. */
const CORE_MAX_DAYS = 0.04;

function meanBetween(curve, from, to, center) {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < curve.times.length; i += 1) {
    const d = Math.abs(curve.times[i] - center);
    if (d >= from && d <= to) {
      sum += curve.flux[i];
      n += 1;
    }
  }
  return n ? sum / n : NaN;
}

/**
 * Move a click to the bottom of the nearest dip, as an astronomer would.
 *
 * A tap on a phone lands a few pixels off, and a few pixels is a couple of
 * hours here. Two steps:
 *
 * 1. The lowest running mean within `searchDays` of the tap finds the dip.
 *    That alone is not the middle: the bottom of a transit is flat, and every
 *    window that fits inside it is equally low, so noise picks one.
 * 2. The middle is the average time of the points below half depth near it —
 *    halfway between ingress and egress, where the two sides of the dip cross
 *    the same level.
 *
 * If there is no dip near the tap this lands on the lowest stretch of noise,
 * and `evaluateMarks` says so.
 */
export function snapToDip(curve, t, searchDays = 0.25) {
  let coarse = t;
  let lowest = Infinity;
  const step = curve.cadenceDays;
  for (let c = t - searchDays; c <= t + searchDays; c += step) {
    const m = meanBetween(curve, 0, CORE_DAYS, c);
    if (m < lowest) {
      lowest = m;
      coarse = c;
    }
  }
  const halfDepth = (meanBetween(curve, 0.2, 0.6, coarse) + lowest) / 2;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < curve.times.length; i += 1) {
    if (Math.abs(curve.times[i] - coarse) <= 0.15 && curve.flux[i] < halfDepth) {
      sum += curve.times[i];
      n += 1;
    }
  }
  return n ? sum / n : coarse;
}

/**
 * Half-width of the window a dip's depth is read from.
 *
 * A transit of TRAPPIST-1 e lasts under an hour and one of a hot Jupiter round
 * a Sun-like star three, so one fixed window either reads past the edges of
 * the short dip — and calls it shallower than it is — or throws away most of
 * the long one. The window is a third of the dip's own width, measured as the
 * time it spends below half depth, and never narrower than one sample.
 */
function coreHalfWidth(curve, center) {
  const baseline = meanBetween(curve, 0.2, 0.6, center);
  const bottom = meanBetween(curve, 0, curve.cadenceDays * 1.01, center);
  const half = (baseline + bottom) / 2;
  let n = 0;
  for (let i = 0; i < curve.times.length; i += 1) {
    if (Math.abs(curve.times[i] - center) <= 0.15 && curve.flux[i] < half) n += 1;
  }
  const width = n * curve.cadenceDays;
  return Math.min(CORE_MAX_DAYS, Math.max(curve.cadenceDays * 1.01, 0.3 * width));
}

/** Depth read off the data at `center`: the local baseline minus the core of the dip. */
export function measureDepth(curve, center) {
  const core = meanBetween(curve, 0, coreHalfWidth(curve, center), center);
  const baseline = meanBetween(curve, 0.2, 0.6, center);
  return baseline - core;
}

/**
 * Judge the reader's marks against the planet they were looking for.
 *
 * Statuses, in the order they are checked:
 *   empty    nothing marked
 *   miss     at least one mark is not on a transit (`misses` says how many)
 *   one      only one transit marked: no period without a second
 *   skipped  the marked transits are not neighbours, so the spacing is a
 *            multiple of the period
 *   found    `depth`, `period`, `ratio` and `radiusEarth` as measured from
 *            the marks — the reader's numbers, not the planet's. The radius
 *            needs the star's size as well as the dip, as it does for real.
 */
export function evaluateMarks(marks, planet, curve) {
  if (!marks.length) return { status: 'empty' };
  const tolerance = Math.max(0.6 * curve.duration, 0.05);
  const indices = [];
  let misses = 0;
  for (const t of marks) {
    const n = Math.round((t - planet.epochDays) / planet.periodDays);
    if (Math.abs(t - (planet.epochDays + n * planet.periodDays)) <= tolerance) indices.push(n);
    else misses += 1;
  }
  if (misses) return { status: 'miss', misses };

  const unique = [...new Set(indices)].sort((a, b) => a - b);
  if (unique.length < 2) return { status: 'one' };
  for (let i = 1; i < unique.length; i += 1) {
    if (unique[i] - unique[i - 1] !== 1) return { status: 'skipped' };
  }

  const sorted = [...marks].sort((a, b) => a - b);
  const period = (sorted[sorted.length - 1] - sorted[0]) / (unique.length - 1);
  const depth = sorted.reduce((sum, t) => sum + measureDepth(curve, t), 0) / sorted.length;
  const ratio = Math.sqrt(Math.max(depth, 0));
  return { status: 'found', depth, period, ratio, radiusEarth: earthRadiiFromRatio(ratio, starOf(planet)) };
}

/** The stars a mystery planet may go round. TRAPPIST-1 is a preset, not a mystery. */
const HUNT_STARS = STAR_TYPES.slice(0, 3);

/**
 * A hidden planet for the "mystery star" mode.
 *
 * Round a Sun-like, orange or red dwarf, with a dip between 0.2 and 3 per
 * cent and a period of 1.2-5 days: every one is at least five times the noise
 * deep, so it can be found by eye, and at least two transits fall inside the
 * twelve days observed. Picking the dip rather than the radius keeps a red
 * dwarf's planets findable — the same dip there is a much smaller planet,
 * from about 1.5 Earth radii up, which is the lesson.
 */
export function randomPlanet(seed) {
  const random = mulberry32(seed);
  const star = HUNT_STARS[Math.min(HUNT_STARS.length - 1, Math.floor(random() * HUNT_STARS.length))];
  const depth = 0.002 * 15 ** random();
  const periodDays = 1.2 + random() * 3.8;
  return {
    rpOverRs: Math.sqrt(depth),
    periodDays,
    epochDays: 0.3 + random() * periodDays,
    seed,
    star,
  };
}
