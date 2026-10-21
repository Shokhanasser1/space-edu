/**
 * The Hertzsprung-Russell diagram: where a star sits by its temperature and
 * its luminosity, and whether a pupil has put it in the right place.
 *
 * The diagram is drawn the way astronomers draw it, which surprises everyone
 * the first time: temperature runs *backwards*, hot on the left, and both axes
 * are logarithmic. A star a hundred thousand times brighter than the Sun and
 * one a thousand times fainter have to fit on the same page.
 *
 *   x: log10(Teff), 40 000 K on the left to 2 500 K on the right
 *   y: log10(L / Lsun), 10^6 at the top to 10^-4 at the bottom
 *
 * The Sun's effective temperature is the IAU nominal value, 5772 K (IAU 2015
 * Resolution B3). Luminosity, radius and temperature are tied by the
 * Stefan-Boltzmann law, which in solar units reads
 *
 *   L / Lsun = (R / Rsun)^2 * (Teff / 5772 K)^4
 *
 * and every star in the catalogue below satisfies it to within 30 per cent,
 * which `hrDiagram.test.js` checks. That is the guard against a typo here: a
 * temperature or a radius that is wrong by a factor shows up as a star that
 * breaks the law.
 *
 * The figures are rounded values from each star's published interferometric
 * and spectroscopic studies, as summarised in their SIMBAD and encyclopaedia
 * entries; the ones worth naming because they are the least obvious:
 *
 *   Betelgeuse   Joyce et al. (2020), ApJ 902, 63 — about 760 Rsun, 3600 K
 *   Sirius B     Barstow et al. (2005), MNRAS 362, 1134 — 25 000 K, 0.0084 Rsun;
 *                its luminosity here is the Stefan-Boltzmann value, 0.025
 *   Arcturus     Ramirez & Allende Prieto (2011), ApJ 743, 135
 *   Deneb        Schiller & Przybilla (2008), A&A 479, 849
 *
 * Supergiant luminosities depend on distances that are still argued over, so
 * Betelgeuse, Rigel and Deneb carry `approx: true` and the page prints them
 * with a tilde.
 *
 * Spectral classes by temperature follow the usual Harvard boundaries: O above
 * 30 000 K, B to 10 000, A to 7500, F to 6000, G to 5200, K to 3700, M below.
 *
 * The Sun's future path is a schematic of the standard picture — main sequence,
 * red giant near 2300 Lsun, helium burning, asymptotic giant near 5000 Lsun,
 * planetary nebula, white dwarf — after Sackmann, Boothroyd & Kraemer (1993),
 * ApJ 418, 457. It is a sketch through those landmarks, not a model track, and
 * the page says so.
 *
 * Distances are in light-years from the Hipparcos and later parallaxes, as
 * quoted in the same entries: Proxima 4.24, Sirius 8.6, Epsilon Eridani 10.5,
 * Procyon 11.5, 40 Eridani 16.3, Vega 25, Arcturus 36.7, Aldebaran 65. The
 * three supergiants are rounded and marked approximate — Betelgeuse about 550
 * (Joyce et al. 2020), Rigel about 860, Deneb about 2600 (Schiller & Przybilla
 * 2008) — because their distances are still argued over.
 *
 * The colour a star looks follows Wien's law: the wavelength it shines most
 * brightly at is b / T, with b = 2.897771955e-3 m K (CODATA 2018). The Sun
 * peaks at 502 nm, green-blue in the middle of what eyes see; Betelgeuse at
 * about 800 nm, in the infrared; Sirius B at about 116 nm, in the ultraviolet.
 */
import { mulberry32 } from './transits';

/** Nominal solar effective temperature, K (IAU 2015 B3). */
export const SUN_TEFF_K = 5772;

/** The diagram's extent. */
export const AXES = { hotK: 40000, coolK: 2500, brightL: 1e6, dimL: 1e-4 };

const LOG_HOT = Math.log10(AXES.hotK);
const LOG_COOL = Math.log10(AXES.coolK);
const LOG_BRIGHT = Math.log10(AXES.brightL);
const LOG_DIM = Math.log10(AXES.dimL);

/** 0 at the hot (left) edge, 1 at the cool (right) edge. */
export function tempToFraction(teffK) {
  return (LOG_HOT - Math.log10(teffK)) / (LOG_HOT - LOG_COOL);
}

export function fractionToTemp(fraction) {
  return 10 ** (LOG_HOT - fraction * (LOG_HOT - LOG_COOL));
}

/** 0 at the bright (top) edge, 1 at the dim (bottom) edge. */
export function lumToFraction(lum) {
  return (LOG_BRIGHT - Math.log10(lum)) / (LOG_BRIGHT - LOG_DIM);
}

export function fractionToLum(fraction) {
  return 10 ** (LOG_BRIGHT - fraction * (LOG_BRIGHT - LOG_DIM));
}

/** L/Lsun from R/Rsun and Teff. */
export function stefanBoltzmannLuminosity(radiusSun, teffK) {
  return radiusSun ** 2 * (teffK / SUN_TEFF_K) ** 4;
}

/** Harvard spectral class letter for a temperature. */
export function spectralClass(teffK) {
  if (teffK >= 30000) return 'O';
  if (teffK >= 10000) return 'B';
  if (teffK >= 7500) return 'A';
  if (teffK >= 6000) return 'F';
  if (teffK >= 5200) return 'G';
  if (teffK >= 3700) return 'K';
  return 'M';
}

/** The letters along the bottom, each at a temperature inside its class. */
export const CLASS_MARKS = [
  { letter: 'O', teffK: 35000 },
  { letter: 'B', teffK: 15000 },
  { letter: 'A', teffK: 8700 },
  { letter: 'F', teffK: 6700 },
  { letter: 'G', teffK: 5600 },
  { letter: 'K', teffK: 4400 },
  { letter: 'M', teffK: 3100 },
];

/**
 * The stars a pupil places. `labelSide` only keeps two names from printing on
 * top of each other once both are placed (Sirius A and Vega, Arcturus and
 * Aldebaran).
 */
export const STARS = [
  { id: 'sun', nameKey: 'hrStarSun', storyKey: 'hrStorySun', teffK: 5772, lum: 1, radius: 1, spectral: 'G2 V', typeKey: 'hrTypeMainSequence', labelSide: 'right', distanceLy: 1.58e-5 },
  { id: 'siriusA', nameKey: 'hrStarSiriusA', storyKey: 'hrStorySiriusA', teffK: 9940, lum: 25, radius: 1.71, spectral: 'A1 V', typeKey: 'hrTypeMainSequence', labelSide: 'right', distanceLy: 8.6 },
  { id: 'betelgeuse', nameKey: 'hrStarBetelgeuse', storyKey: 'hrStoryBetelgeuse', teffK: 3600, lum: 90000, radius: 760, spectral: 'M1-M2 Ia', typeKey: 'hrTypeSupergiant', labelSide: 'left', approx: true, distanceLy: 550 },
  { id: 'proxima', nameKey: 'hrStarProxima', storyKey: 'hrStoryProxima', teffK: 3040, lum: 0.0017, radius: 0.15, spectral: 'M5.5 V', typeKey: 'hrTypeRedDwarf', labelSide: 'left', distanceLy: 4.24 },
  { id: 'rigel', nameKey: 'hrStarRigel', storyKey: 'hrStoryRigel', teffK: 12100, lum: 120000, radius: 79, spectral: 'B8 Ia', typeKey: 'hrTypeSupergiant', labelSide: 'right', approx: true, distanceLy: 860 },
  { id: 'siriusB', nameKey: 'hrStarSiriusB', storyKey: 'hrStorySiriusB', teffK: 25000, lum: 0.025, radius: 0.0084, spectral: 'DA2', typeKey: 'hrTypeWhiteDwarf', labelSide: 'right', distanceLy: 8.6 },
  { id: 'arcturus', nameKey: 'hrStarArcturus', storyKey: 'hrStoryArcturus', teffK: 4290, lum: 170, radius: 25, spectral: 'K1.5 III', typeKey: 'hrTypeGiant', labelSide: 'left', distanceLy: 36.7 },
  { id: 'vega', nameKey: 'hrStarVega', storyKey: 'hrStoryVega', teffK: 9600, lum: 40, radius: 2.4, spectral: 'A0 V', typeKey: 'hrTypeMainSequence', labelSide: 'left', distanceLy: 25 },
  { id: 'aldebaran', nameKey: 'hrStarAldebaran', storyKey: 'hrStoryAldebaran', teffK: 3900, lum: 440, radius: 44, spectral: 'K5 III', typeKey: 'hrTypeGiant', labelSide: 'right', distanceLy: 65 },
  { id: 'procyon', nameKey: 'hrStarProcyon', storyKey: 'hrStoryProcyon', teffK: 6530, lum: 6.9, radius: 2.05, spectral: 'F5 IV-V', typeKey: 'hrTypeMainSequence', labelSide: 'right', distanceLy: 11.5 },
  { id: 'deneb', nameKey: 'hrStarDeneb', storyKey: 'hrStoryDeneb', teffK: 8500, lum: 200000, radius: 200, spectral: 'A2 Ia', typeKey: 'hrTypeSupergiant', labelSide: 'left', approx: true, distanceLy: 2600 },
  { id: 'epsEri', nameKey: 'hrStarEpsEri', storyKey: 'hrStoryEpsEri', teffK: 5080, lum: 0.34, radius: 0.74, spectral: 'K2 V', typeKey: 'hrTypeMainSequence', labelSide: 'right', distanceLy: 10.5 },
  { id: 'eri40B', nameKey: 'hrStar40EriB', storyKey: 'hrStory40EriB', teffK: 17000, lum: 0.014, radius: 0.014, spectral: 'DA4', typeKey: 'hrTypeWhiteDwarf', labelSide: 'right', approx: true, distanceLy: 16.3 },
];

/** Wien's displacement constant, m K (CODATA 2018). */
export const WIEN_B = 2.897771955e-3;

/** The wavelength a star shines most brightly at, in nanometres. */
export function peakWavelengthNm(teffK) {
  return (WIEN_B / teffK) * 1e9;
}

/** Which part of the spectrum a wavelength falls in, as a `lab` locale key. */
export function lightBandKey(nm) {
  if (nm < 380) return 'hrBandUv';
  if (nm <= 750) return 'hrBandVisible';
  return 'hrBandIr';
}

/**
 * The four groups the diagram sorts stars into. A red dwarf is a small, cool
 * main-sequence star, so it counts towards the main sequence.
 */
export const STAR_GROUPS = ['main', 'giant', 'supergiant', 'whiteDwarf'];

const GROUP_BY_TYPE = {
  hrTypeMainSequence: 'main',
  hrTypeRedDwarf: 'main',
  hrTypeGiant: 'giant',
  hrTypeSupergiant: 'supergiant',
  hrTypeWhiteDwarf: 'whiteDwarf',
};

export function starGroup(star) {
  return GROUP_BY_TYPE[star.typeKey];
}

/**
 * Quick questions answered from the star cards. Each answer is the extreme of
 * the whole catalogue, not only of its four options, which the tests check.
 * `measure` is the card field the question is about, so a wrong pick can be
 * answered with that star's own number ("Rigel is 79 Suns wide — one of the
 * others is bigger") rather than with a bare "no".
 */
export const QUESTIONS = [
  { id: 'biggest', questionKey: 'hrQuizBiggest', whyKey: 'hrQuizBiggestWhy', wrongKey: 'hrQuizBiggestWrong', measure: 'radius', options: ['aldebaran', 'betelgeuse', 'rigel', 'deneb'], answer: 'betelgeuse' },
  { id: 'hottest', questionKey: 'hrQuizHottest', whyKey: 'hrQuizHottestWhy', wrongKey: 'hrQuizHottestWrong', measure: 'teffK', options: ['siriusA', 'rigel', 'siriusB', 'eri40B'], answer: 'siriusB' },
  { id: 'nearest', questionKey: 'hrQuizNearest', whyKey: 'hrQuizNearestWhy', wrongKey: 'hrQuizNearestWrong', measure: 'distanceLy', options: ['siriusA', 'proxima', 'epsEri', 'procyon'], answer: 'proxima' },
];

/**
 * How close a tap has to be, in decades. An ellipse, because the two axes
 * are not the same scale: 0.06 in log T is about 15 per cent in temperature,
 * 0.45 in log L a factor of 2.8 in brightness — about the same distance on
 * the page. Any wider and Arcturus and Aldebaran, two K giants a factor of
 * 2.6 apart, would each accept the other's spot.
 */
export const PLACEMENT_TOLERANCE = { logT: 0.06, logL: 0.45 };

/**
 * Judge a placement. `hints` are `lab` locale keys saying which way to move:
 * a tap that was too hot gets "this star is cooler — further right".
 */
export function judgePlacement(star, teffK, lum) {
  const dLogT = Math.log10(teffK) - Math.log10(star.teffK);
  const dLogL = Math.log10(lum) - Math.log10(star.lum);
  const tol = PLACEMENT_TOLERANCE;
  const correct = (dLogT / tol.logT) ** 2 + (dLogL / tol.logL) ** 2 <= 1;
  const hints = [];
  if (!correct) {
    if (dLogT > tol.logT / 2) hints.push('hrHintCooler');
    else if (dLogT < -tol.logT / 2) hints.push('hrHintHotter');
    if (dLogL > tol.logL / 2) hints.push('hrHintDimmer');
    else if (dLogL < -tol.logL / 2) hints.push('hrHintBrighter');
  }
  return { correct, dLogT, dLogL, hints };
}

/** The main sequence as (log T, log L) knots, for the background and its label. */
export const MAIN_SEQUENCE = [
  [3.48, -2.9],
  [3.761, 0],
  [4.0, 1.4],
  [4.3, 3.3],
  [4.55, 5.2],
];

export function mainSequenceLogL(logT) {
  for (let i = 0; i < MAIN_SEQUENCE.length - 1; i += 1) {
    const [a, b] = MAIN_SEQUENCE[i];
    const [c, d] = MAIN_SEQUENCE[i + 1];
    if (logT <= c) return b + ((logT - a) / (c - a)) * (d - b);
  }
  return MAIN_SEQUENCE[MAIN_SEQUENCE.length - 1][1];
}

/**
 * Faint context stars in the four groups, so the named ones land among
 * company. Illustrative, not a catalogue, and the page says so.
 */
export function backgroundStars(seed = 3) {
  const random = mulberry32(seed);
  const stars = [];
  const add = (logT, logL) => stars.push({ teffK: 10 ** logT, lum: 10 ** logL, alpha: 0.35 + random() * 0.35 });
  for (let i = 0; i < 160; i += 1) {
    const logT = 3.48 + random() * 1.07;
    add(logT, mainSequenceLogL(logT) + (random() - 0.5) * 0.7);
  }
  for (let i = 0; i < 32; i += 1) add(3.55 + random() * 0.17, 1.6 + random() * 1.5);
  for (let i = 0; i < 10; i += 1) add(3.52 + random() * 0.85, 4.5 + random() * 1.0);
  for (let i = 0; i < 16; i += 1) {
    const logT = 3.95 + random() * 0.5;
    add(logT, -3.6 + (logT - 3.95) * 3 + (random() - 0.5) * 0.5);
  }
  return stars;
}

/**
 * The Sun from now to white dwarf, through the landmarks in the header.
 * Points hotter than the left edge are drawn on it: the planetary-nebula
 * nucleus passes 100 000 K, off this page.
 */
export const SUN_PATH = [
  { teffK: 5772, lum: 1, mark: 'now' },
  { teffK: 5600, lum: 1.8 },
  { teffK: 4900, lum: 2.7 },
  { teffK: 4500, lum: 12 },
  { teffK: 4000, lum: 150 },
  { teffK: 3300, lum: 2300, mark: 'giant' },
  { teffK: 4700, lum: 50 },
  { teffK: 4300, lum: 150 },
  { teffK: 3500, lum: 1200 },
  { teffK: 3100, lum: 5000 },
  { teffK: 100000, lum: 5000 },
  { teffK: 100000, lum: 100 },
  { teffK: 30000, lum: 0.1 },
  { teffK: 17000, lum: 0.012, mark: 'dwarf' },
];

/** Roughly the colour a star of this temperature looks. */
export function starColour(teffK) {
  const stops = [
    [3.5, [255, 140, 82]],
    [3.6, [255, 181, 108]],
    [3.7, [255, 210, 161]],
    [3.8, [255, 244, 234]],
    [4.0, [202, 215, 255]],
    [4.5, [155, 176, 255]],
  ];
  const logT = Math.log10(teffK);
  if (logT <= stops[0][0]) return `rgb(${stops[0][1].join(',')})`;
  for (let i = 0; i < stops.length - 1; i += 1) {
    const [a, ca] = stops[i];
    const [b, cb] = stops[i + 1];
    if (logT <= b) {
      const k = (logT - a) / (b - a);
      return `rgb(${ca.map((v, j) => Math.round(v + (cb[j] - v) * k)).join(',')})`;
    }
  }
  return `rgb(${stops[stops.length - 1][1].join(',')})`;
}

/**
 * Dot size from radius, on a log scale and clamped: a white dwarf is a speck,
 * a supergiant a disc, and neither swallows the diagram. Chart convention,
 * not physics — Betelgeuse drawn to scale would cover the page.
 */
export function starRadiusPx(radiusSun) {
  return Math.min(17, Math.max(3.5, 4 + 2.4 * Math.log10(radiusSun / 0.01)));
}
