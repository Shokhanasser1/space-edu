/**
 * How a star lives and dies, from the one number that decides it: its mass.
 *
 * The Laboratory's "life of a star" module used to step every star through the
 * same four stages — nebula, star, supernova, black hole — which tells a child
 * the Sun will become a black hole. It will not. Mass decides the road:
 *
 *   below ~0.5 M☉   main sequence for trillions of years, then (predicted) a
 *                   helium white dwarf; the universe is too young for any
 *                   such star to have died yet (Laughlin, Bodenheimer &
 *                   Adams 1997, ApJ 482, 420)
 *   ~0.5 to ~8 M☉  red giant, planetary nebula, white dwarf
 *   ~8 to ~20 M☉   red supergiant, core-collapse supernova, neutron star
 *   above ~20 M☉    red supergiant, supernova (or direct collapse), black hole
 *
 * The 8 and 20 M☉ boundaries are the usual textbook round numbers; the real
 * ones are blurred by rotation, composition and companion stars, and the page
 * says so.
 *
 * Main-sequence lifetime is the fitting formula of Hurley, Pols & Tout (2000),
 * MNRAS 315, 543, at solar metallicity: the time to the base of the giant
 * branch,
 *
 *   t_BGB = (a1 + a2 M^4 + a3 M^5.5 + M^7) / (a4 M^2 + a5 M^7)   [Myr]
 *
 * with t_MS ≈ 0.95 t_BGB. It is used rather than the classroom rule
 * t ≈ 10^10 yr × M^-2.5 because that rule, fine near the Sun, makes a 30 M☉
 * star live about 2 million years where models give about 6; the rule is
 * still shown on the page as the intuition, with that caveat.
 *
 * Main-sequence luminosity is the piecewise mass–luminosity relation quoted
 * from Duric (2004), Advanced Astrophysics: 0.23 M^2.3 below 0.43 M☉, M^4 to
 * 2 M☉, 1.4 M^3.5 to 55 M☉, 32000 M above.
 *
 * Spectral class by main-sequence mass follows the commonly tabulated ranges
 * (Habets & Heintze 1981): O ≥ 16, B ≥ 2.1, A ≥ 1.4, F ≥ 1.04, G ≥ 0.8,
 * K ≥ 0.45 M☉, M below.
 */

/** The Sun's age, years (NASA). */
export const SUN_AGE_YEARS = 4.6e9;

/** Age of the universe, years (Planck 2018: 13.787 ± 0.020 Gyr). */
export const UNIVERSE_AGE_YEARS = 13.8e9;

/** Initial masses (M☉) where the fate changes. Approximate, and labelled so. */
export const HELIUM_DWARF_BELOW = 0.5;
export const SUPERNOVA_ABOVE = 8;
export const BLACK_HOLE_ABOVE = 20;

/** The range the module's slider offers, M☉. The lifetime fit holds across it. */
export const MASS_RANGE = { min: 0.1, max: 40 };

const HPT = [1593.89, 2706.708, 146.6143, 0.0414196, 0.3426349];

/** Time to the base of the giant branch, Myr (Hurley, Pols & Tout 2000, Z = 0.02). */
export function baseOfGiantBranchMyr(mass) {
  const [a1, a2, a3, a4, a5] = HPT;
  return (a1 + a2 * mass ** 4 + a3 * mass ** 5.5 + mass ** 7) / (a4 * mass ** 2 + a5 * mass ** 7);
}

/** Main-sequence lifetime, years. */
export function mainSequenceLifetimeYears(mass) {
  return 0.95 * baseOfGiantBranchMyr(mass) * 1e6;
}

/** The classroom rule, for comparison only: 10 billion years × M^-2.5. */
export function simpleLifetimeYears(mass) {
  return 1e10 * mass ** -2.5;
}

/** Main-sequence luminosity in solar units (Duric 2004). */
export function mainSequenceLuminosity(mass) {
  if (mass < 0.43) return 0.23 * mass ** 2.3;
  if (mass < 2) return mass ** 4;
  if (mass < 55) return 1.4 * mass ** 3.5;
  return 32000 * mass;
}

/** Spectral class letter of a main-sequence star of this mass. */
export function spectralClass(mass) {
  if (mass >= 16) return 'O';
  if (mass >= 2.1) return 'B';
  if (mass >= 1.4) return 'A';
  if (mass >= 1.04) return 'F';
  if (mass >= 0.8) return 'G';
  if (mass >= 0.45) return 'K';
  return 'M';
}

/**
 * The colour a star of each class looks, as an sRGB hex. The usual
 * blackbody-derived approximations (Mitchell Charity's star colour table).
 */
export const CLASS_COLOUR = {
  O: '#9bb0ff',
  B: '#aabfff',
  A: '#cad7ff',
  F: '#f8f7ff',
  G: '#fff4ea',
  K: '#ffd2a1',
  M: '#ffcc6f',
};

/** How the star ends: 'heliumWhiteDwarf' | 'whiteDwarf' | 'neutronStar' | 'blackHole'. */
export function fateOf(mass) {
  if (mass < HELIUM_DWARF_BELOW) return 'heliumWhiteDwarf';
  if (mass < SUPERNOVA_ABOVE) return 'whiteDwarf';
  if (mass < BLACK_HOLE_ABOVE) return 'neutronStar';
  return 'blackHole';
}

/** The stages, in order, that a star of this mass goes through. */
export function lifeStages(mass) {
  switch (fateOf(mass)) {
    case 'heliumWhiteDwarf':
      return ['nebula', 'mainSequence', 'whiteDwarf'];
    case 'whiteDwarf':
      return ['nebula', 'mainSequence', 'redGiant', 'planetaryNebula', 'whiteDwarf'];
    case 'neutronStar':
      return ['nebula', 'mainSequence', 'redSupergiant', 'supernova', 'neutronStar'];
    default:
      return ['nebula', 'mainSequence', 'redSupergiant', 'supernova', 'blackHole'];
  }
}

/** True when no star of this mass can yet have left the main sequence. */
export function outlivesUniverse(mass) {
  return mainSequenceLifetimeYears(mass) > UNIVERSE_AGE_YEARS;
}

/**
 * A duration as a value and a unit key, two significant figures:
 * `{ value: '11', unit: 'Billion' }`. The unit key is appended to a locale key
 * prefix by the caller (`uniYearsBillion`, ...).
 */
export function splitYears(years) {
  const units = [
    ['Trillion', 1e12],
    ['Billion', 1e9],
    ['Million', 1e6],
    ['Thousand', 1e3],
  ];
  for (const [unit, size] of units) {
    if (years >= size) {
      const scaled = years / size;
      const value = scaled >= 100 ? Math.round(scaled).toString() : Number(scaled.toPrecision(2)).toString();
      return { value, unit };
    }
  }
  return { value: Math.round(years).toString(), unit: 'Years' };
}

/** Slider position (0..1) to mass, logarithmic across MASS_RANGE. */
export function massFromSlider(position) {
  const lo = Math.log10(MASS_RANGE.min);
  const hi = Math.log10(MASS_RANGE.max);
  return 10 ** (lo + Math.min(1, Math.max(0, position)) * (hi - lo));
}

/** Mass to slider position (0..1), the inverse of `massFromSlider`. */
export function sliderFromMass(mass) {
  const lo = Math.log10(MASS_RANGE.min);
  const hi = Math.log10(MASS_RANGE.max);
  return (Math.log10(mass) - lo) / (hi - lo);
}
