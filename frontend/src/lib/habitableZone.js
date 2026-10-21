/**
 * The habitable zone: how far from a star a planet can be and still keep
 * liquid water on its surface.
 *
 * The Laboratory's habitable-zone module is built on this file. Its one idea is
 * that the zone moves with the star: round a dim red dwarf it sits a few tenths
 * of an astronomical unit out, round a bright F star it is further away than
 * Mars is from the Sun.
 *
 * **The edges.** Kopparapu et al. (2013), ApJ 765, 131, with the coefficients
 * as updated in Kopparapu et al. (2014), ApJL 787, L29, table 1, for an
 * Earth-mass planet. The stellar flux at each edge, in units of the flux Earth
 * receives, is a polynomial in the star's effective temperature:
 *
 *   Seff = Seff_sun + a*T + b*T^2 + c*T^3 + d*T^4,   T = Teff - 5780 K
 *
 * and the distance of that edge, in au, is
 *
 *   d = sqrt( L / Seff )        (L in solar luminosities)
 *
 * The inner edge is the "runaway greenhouse" limit — closer in, the oceans
 * evaporate and the water vapour traps ever more heat, as is thought to have
 * happened to Venus. The outer edge is the "maximum greenhouse" limit — further
 * out, even a thick carbon-dioxide atmosphere cannot keep water liquid. For the
 * Sun these come to about 0.95 and 1.68 au. The fit holds for
 * 2600 K <= Teff <= 7200 K; temperatures outside that are clamped to it.
 *
 * **The planet's temperature.** The equilibrium temperature of a planet that
 * spreads the heat it absorbs over its whole surface:
 *
 *   Teq = 278.6 K * L^(1/4) * d^(-1/2) * (1 - A)^(1/4)
 *
 * 278.6 K is the value for a black body at 1 au from the Sun. With Earth's
 * Bond albedo of about 0.3 this gives 255 K (-18 C), while Earth's measured
 * mean surface temperature is 288 K (15 C): the difference, about 33 K, is the
 * greenhouse effect. The module prints the equilibrium figure and says so.
 *
 * **The stars.** Representative main-sequence values, rounded, read from
 * Pecaut & Mamajek (2013), ApJS 208, 9 (the dwarf colour-temperature
 * sequence): roughly an M3, a K5, the Sun, and an F5 star. They are labelled
 * "typical" on the page — real stars of each class spread around them.
 *
 * **The planets drawn for the Sun.** Semi-major axes and mean surface
 * temperatures from the NASA Planetary Fact Sheet: Venus 0.723 au and 737 K
 * (464 C), Earth 1.000 au and 288 K, Mars 1.524 au and 210 K (-63 C).
 *
 * **Real systems** (the presets), rounded from the papers that measured them:
 *
 *   Sun          Teff 5772 K (IAU 2015 Resolution B3 nominal), L = 1.
 *   Proxima Cen  Teff 3050 K, L = 0.00155 L_sun; Proxima b at 0.0485 au,
 *                one orbit every 11.2 days (Anglada-Escude et al. 2016,
 *                Nature 536, 437).
 *   TRAPPIST-1   Teff 2566 K, L = 0.000553 L_sun, planets b-h at 0.01154 to
 *                0.06189 au (Agol et al. 2021, Planet. Sci. J. 2, 1). Its
 *                temperature is just below the 2600 K floor of the fit, so its
 *                zone is worked out at 2600 K — a small stretch the page says
 *                out loud. The answer, e, f and g inside the zone, is the one
 *                published by Gillon et al. (2017, Nature 542, 456).
 *   Kepler-452   Teff 5757 K, about 20 per cent brighter than the Sun;
 *                Kepler-452b at 1.046 au, a 385-day year (Jenkins et al.
 *                2015, AJ 150, 56).
 *
 * Starlight is the flux a planet receives relative to Earth, L / d^2: Venus
 * gets about 1.9 times Earth's, Mars about 0.43.
 */

/** Earth's Bond albedo, rounded (NASA Planetary Fact Sheet: 0.306). */
export const EARTH_ALBEDO = 0.3;

/** Kopparapu et al. (2014), table 1, 1 Earth mass. */
const EDGES = {
  runawayGreenhouse: { seffSun: 1.107, a: 1.332e-4, b: 1.58e-8, c: -8.308e-12, d: -1.931e-15 },
  maximumGreenhouse: { seffSun: 0.356, a: 6.171e-5, b: 1.698e-9, c: -3.198e-12, d: -5.575e-16 },
};

/** Where the polynomial fit is valid, K. */
export const TEFF_RANGE = [2600, 7200];

/** Representative main-sequence stars (Pecaut & Mamajek 2013, rounded). */
export const STAR_TYPES = {
  M: { teff: 3400, luminosity: 0.02, colour: '#ff7a4d' },
  K: { teff: 4500, luminosity: 0.2, colour: '#ffb56c' },
  G: { teff: 5780, luminosity: 1, colour: '#fff1c9' },
  F: { teff: 6500, luminosity: 2.5, colour: '#e8eeff' },
};

/** Planets drawn round the Sun (NASA Planetary Fact Sheet). */
export const SOLAR_PLANETS = [
  { key: 'venus', au: 0.723, surfaceC: 464 },
  { key: 'earth', au: 1.0, surfaceC: 15 },
  { key: 'mars', au: 1.524, surfaceC: -63 },
];

/**
 * Real planetary systems for the presets (sources in the header). `starClass`
 * is the spectral class the system counts as for "every kind of star";
 * `home` is the planet the view opens on.
 */
export const SYSTEMS = {
  sun: {
    starClass: 'G',
    teff: 5772,
    luminosity: 1,
    colour: '#fff1c9',
    planets: SOLAR_PLANETS.map(({ key, au }) => ({ key, au })),
    home: 'earth',
  },
  proxima: {
    starClass: 'M',
    teff: 3050,
    luminosity: 0.00155,
    colour: '#ff7043',
    planets: [{ key: 'b', au: 0.0485 }],
    home: 'b',
  },
  trappist1: {
    starClass: 'M',
    teff: 2566,
    luminosity: 0.000553,
    colour: '#ff5a36',
    planets: [
      { key: 'b', au: 0.01154 },
      { key: 'c', au: 0.0158 },
      { key: 'd', au: 0.02227 },
      { key: 'e', au: 0.02925 },
      { key: 'f', au: 0.03849 },
      { key: 'g', au: 0.04683 },
      { key: 'h', au: 0.06189 },
    ],
    home: 'e',
  },
  kepler452: {
    starClass: 'G',
    teff: 5757,
    luminosity: 1.2,
    colour: '#fff1c9',
    planets: [{ key: 'b', au: 1.046 }],
    home: 'b',
  },
};

/** Whether a star is outside the temperatures the fit was made for. */
export function isExtrapolated(teff) {
  return teff < TEFF_RANGE[0] || teff > TEFF_RANGE[1];
}

/** Starlight a planet receives, in units of what Earth receives from the Sun. */
export function starlight(luminosity, distanceAu) {
  return luminosity / distanceAu ** 2;
}

/**
 * Stellar flux at one edge of the zone, in units of the flux at Earth.
 * `edge` is 'runawayGreenhouse' or 'maximumGreenhouse'.
 */
export function edgeFlux(edge, teff) {
  const k = EDGES[edge];
  const clamped = Math.min(TEFF_RANGE[1], Math.max(TEFF_RANGE[0], teff));
  const t = clamped - 5780;
  return k.seffSun + k.a * t + k.b * t ** 2 + k.c * t ** 3 + k.d * t ** 4;
}

/** The zone's inner and outer edge in au, for a star of `teff` K and `luminosity` L_sun. */
export function habitableZone(teff, luminosity) {
  return {
    inner: Math.sqrt(luminosity / edgeFlux('runawayGreenhouse', teff)),
    outer: Math.sqrt(luminosity / edgeFlux('maximumGreenhouse', teff)),
  };
}

/** Equilibrium temperature in kelvin, with no greenhouse effect. */
export function equilibriumTemperatureK(luminosity, distanceAu, albedo = EARTH_ALBEDO) {
  return 278.6 * luminosity ** 0.25 * distanceAu ** -0.5 * (1 - albedo) ** 0.25;
}

/** Where a planet at `distanceAu` sits: 'hot' inside the zone, 'liquid' in it, 'frozen' beyond. */
export function waterState(distanceAu, zone) {
  if (distanceAu < zone.inner) return 'hot';
  if (distanceAu > zone.outer) return 'frozen';
  return 'liquid';
}

/** A round axis length that shows the whole zone with room beyond it, au. */
export function viewSpanAu(zone) {
  const target = zone.outer * 1.25;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s * magnitude >= target);
  return step * magnitude;
}
