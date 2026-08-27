/**
 * The bodies we draw, with the numbers a child will read off the panel.
 *
 * Physical values are NASA's Planetary Fact Sheet
 * (nssdc.gsfc.nasa.gov/planetary/factsheet) and, for the small bodies, JPL's
 * Small-Body Database. Orbital elements appear only for bodies astronomy-engine
 * does not model (the four outer dwarf planets): epoch JD 2461200.5 from SBDB.
 * Everything with an `astro` name is positioned by astronomy-engine (VSOP87,
 * ±1 arcminute), not by these numbers.
 *
 * Texture slots list candidates in order; the first file that exists wins.
 * The `4k_*.webp` / `2k_*.webp` maps are Solar System Scope's (CC BY 4.0),
 * re-encoded to WebP under the repository's 2 MB-per-file budget; the older
 * three.js maps stay as fallbacks. Names are i18n keys under `explore.bodies`.
 *
 * `rotationHours` is the sidereal day, negative for retrograde spin.
 * `atmosphere` lists the main constituents as formulas, which need no
 * translation. `tempC` is the mean surface (or 1-bar) temperature.
 */

const T = '/textures/';

export const BODIES = [
  {
    id: 'sun', kind: 'star', astro: 'Sun',
    radiusKm: 695700, massKg: 1.9885e30, gravity: 274, tempC: 5500,
    rotationHours: 609.12, axialTilt: 7.25, color: '#FDB813',
    textures: { map: [`${T}4k_sun.webp`, `${T}sunmap.jpg`] },
  },
  {
    id: 'mercury', kind: 'planet', astro: 'Mercury',
    radiusKm: 2439.7, massKg: 3.3011e23, gravity: 3.7, tempC: 167,
    rotationHours: 1407.6, axialTilt: 0.034, atmosphere: [], color: '#9a9a9a',
    textures: { map: [`${T}4k_mercury.webp`, `${T}mercurymap.jpg`], bump: [`${T}mercurybump.jpg`] },
  },
  {
    id: 'venus', kind: 'planet', astro: 'Venus',
    radiusKm: 6051.8, massKg: 4.8675e24, gravity: 8.87, tempC: 464,
    rotationHours: -5832.5, axialTilt: 177.36, atmosphere: ['CO₂', 'N₂'], color: '#e3bb76',
    glow: { color: '#f3d9a4', strength: 1.4 },
    textures: { map: [`${T}4k_venus_atmosphere.webp`, `${T}venusmap.jpg`], bump: [`${T}venusbump.jpg`] },
  },
  {
    id: 'earth', kind: 'planet', astro: 'Earth',
    radiusKm: 6371, massKg: 5.9722e24, gravity: 9.8, tempC: 15,
    rotationHours: 23.9345, axialTilt: 23.44, atmosphere: ['N₂', 'O₂', 'Ar'], color: '#3b8ad9',
    glow: { color: '#5aa6ff', strength: 1.0 },
    textures: {
      map: [`${T}4k_earth_daymap.webp`, `${T}earth_atmos_2048.jpg`],
      night: [`${T}4k_earth_nightmap.webp`, `${T}earth_lights_2048.png`],
      clouds: [`${T}2k_earth_clouds.webp`, `${T}earth_clouds_1024.png`],
      specular: [`${T}2k_earth_specular.webp`, `${T}earth_specular_2048.jpg`],
      normal: [`${T}earth_normal_2048.jpg`],
    },
  },
  {
    id: 'mars', kind: 'planet', astro: 'Mars',
    radiusKm: 3389.5, massKg: 6.4171e23, gravity: 3.71, tempC: -65,
    rotationHours: 24.6229, axialTilt: 25.19, atmosphere: ['CO₂', 'N₂', 'Ar'], color: '#c1440e',
    glow: { color: '#e9a27a', strength: 0.35 },
    textures: { map: [`${T}4k_mars.webp`, `${T}marsmap1k.jpg`], bump: [`${T}marsbump1k.jpg`] },
  },
  {
    id: 'jupiter', kind: 'planet', astro: 'Jupiter',
    radiusKm: 69911, massKg: 1.8981e27, gravity: 24.79, tempC: -110,
    rotationHours: 9.925, axialTilt: 3.13, atmosphere: ['H₂', 'He'], color: '#d39c7e',
    textures: { map: [`${T}4k_jupiter.webp`, `${T}jupitermap.jpg`] },
  },
  {
    id: 'saturn', kind: 'planet', astro: 'Saturn',
    radiusKm: 58232, massKg: 5.6834e26, gravity: 10.44, tempC: -140,
    rotationHours: 10.656, axialTilt: 26.73, atmosphere: ['H₂', 'He'], color: '#ead6b8',
    rings: {
      innerKm: 74500, outerKm: 140220,
      // Cassini Division, as a fraction of the ring span.
      gaps: [[0.654, 0.726]],
      textures: { ring: [`${T}2k_saturn_ring_alpha.png`, `${T}saturnringcolor.jpg`] },
    },
    textures: { map: [`${T}4k_saturn.webp`, `${T}saturnmap.jpg`] },
  },
  {
    id: 'uranus', kind: 'planet', astro: 'Uranus',
    radiusKm: 25362, massKg: 8.681e25, gravity: 8.87, tempC: -195,
    rotationHours: -17.24, axialTilt: 97.77, atmosphere: ['H₂', 'He', 'CH₄'], color: '#9fd3e0',
    rings: { innerKm: 41837, outerKm: 51149, thin: true, textures: { ring: [`${T}uranusringcolour.jpg`] } },
    textures: { map: [`${T}2k_uranus.webp`, `${T}uranusmap.jpg`] },
  },
  {
    id: 'neptune', kind: 'planet', astro: 'Neptune',
    radiusKm: 24622, massKg: 1.02413e26, gravity: 11.15, tempC: -200,
    rotationHours: 16.11, axialTilt: 28.32, atmosphere: ['H₂', 'He', 'CH₄'], color: '#4f74d8',
    textures: { map: [`${T}2k_neptune.webp`, `${T}neptunemap.jpg`] },
  },
  {
    id: 'pluto', kind: 'dwarf', astro: 'Pluto',
    radiusKm: 1188.3, massKg: 1.303e22, gravity: 0.62, tempC: -225,
    rotationHours: -153.29, axialTilt: 122.53, atmosphere: ['N₂', 'CH₄', 'CO'], color: '#d9b8a6',
    textures: { map: [`${T}plutomap1k.jpg`], bump: [`${T}plutobump1k.jpg`] },
  },
  {
    id: 'ceres', kind: 'dwarf',
    radiusKm: 469.7, massKg: 9.38e20, gravity: 0.28, tempC: -105,
    rotationHours: 9.07, axialTilt: 4, atmosphere: [], color: '#a9a9a9',
    orbit: { a: 2.766, e: 0.0797, i: 10.59, om: 80.25, w: 73.29, ma: 274.42, epochJd: 2461200.5 },
    textures: { map: [`${T}2k_ceres_fictional.webp`] },
  },
  {
    id: 'eris', kind: 'dwarf',
    radiusKm: 1163, massKg: 1.66e22, gravity: 0.82, tempC: -231,
    rotationHours: 378.4, axialTilt: 78, atmosphere: [], color: '#d3d3d3',
    orbit: { a: 67.9, e: 0.438, i: 43.9, om: 36, w: 151, ma: 212, epochJd: 2461200.5 },
    textures: { map: [`${T}2k_eris_fictional.webp`] },
  },
  {
    id: 'haumea', kind: 'dwarf',
    radiusKm: 816, massKg: 4.006e21, gravity: 0.4, tempC: -241,
    rotationHours: 3.915, axialTilt: 0, atmosphere: [], color: '#e0e0e0',
    orbit: { a: 43.1, e: 0.194, i: 28.2, om: 122, w: 241, ma: 223, epochJd: 2461200.5 },
    textures: { map: [`${T}2k_haumea_fictional.webp`] },
  },
  {
    id: 'makemake', kind: 'dwarf',
    radiusKm: 715, massKg: 3.1e21, gravity: 0.5, tempC: -239,
    rotationHours: 22.83, axialTilt: 0, atmosphere: [], color: '#d2b48c',
    orbit: { a: 45.6, e: 0.159, i: 29, om: 79.3, w: 297, ma: 170, epochJd: 2461200.5 },
    textures: { map: [`${T}2k_makemake_fictional.webp`] },
  },
];

/**
 * Moons. `aKm` is the semi-major axis, `periodDays` the sidereal period
 * (negative = retrograde). The Moon comes from astronomy-engine's lunar
 * theory and the Galileans from its Jupiter-moon model (`galilean`); the rest
 * run on circular orbits in their planet's equatorial plane, which is where
 * the regular satellites actually are. Tidally locked moons spin once per
 * orbit, so `rotationHours` is omitted and derived from the period.
 */
export const MOONS = [
  { id: 'moon', parent: 'earth', astro: 'Moon', radiusKm: 1737.4, massKg: 7.346e22, gravity: 1.62, tempC: -20, aKm: 384400, periodDays: 27.3217, color: '#b8b8b8', textures: { map: [`${T}4k_moon.webp`, `${T}moon_1024.jpg`] } },
  { id: 'phobos', parent: 'mars', radiusKm: 11.27, massKg: 1.06e16, gravity: 0.006, tempC: -40, aKm: 9376, periodDays: 0.3189, color: '#8a8078' },
  { id: 'deimos', parent: 'mars', radiusKm: 6.2, massKg: 1.5e15, gravity: 0.003, tempC: -40, aKm: 23463, periodDays: 1.2624, color: '#9a9088' },
  { id: 'io', parent: 'jupiter', galilean: 'io', radiusKm: 1821.6, massKg: 8.93e22, gravity: 1.8, tempC: -143, aKm: 421800, periodDays: 1.7691, color: '#e8d27a' },
  { id: 'europa', parent: 'jupiter', galilean: 'europa', radiusKm: 1560.8, massKg: 4.8e22, gravity: 1.31, tempC: -160, aKm: 671100, periodDays: 3.5512, color: '#d9d0c0' },
  { id: 'ganymede', parent: 'jupiter', galilean: 'ganymede', radiusKm: 2634.1, massKg: 1.4819e23, gravity: 1.43, tempC: -163, aKm: 1070400, periodDays: 7.1546, color: '#a89f92' },
  { id: 'callisto', parent: 'jupiter', galilean: 'callisto', radiusKm: 2410.3, massKg: 1.0759e23, gravity: 1.24, tempC: -139, aKm: 1882700, periodDays: 16.689, color: '#8b8378' },
  { id: 'mimas', parent: 'saturn', radiusKm: 198.2, massKg: 3.75e19, gravity: 0.064, tempC: -209, aKm: 185540, periodDays: 0.942, color: '#cfcfcf' },
  { id: 'enceladus', parent: 'saturn', radiusKm: 252.1, massKg: 1.08e20, gravity: 0.11, tempC: -198, aKm: 238040, periodDays: 1.3702, color: '#f4f4f4' },
  { id: 'rhea', parent: 'saturn', radiusKm: 763.8, massKg: 2.31e21, gravity: 0.26, tempC: -220, aKm: 527070, periodDays: 4.5175, color: '#d8d4cc' },
  { id: 'titan', parent: 'saturn', radiusKm: 2574.7, massKg: 1.3452e23, gravity: 1.35, tempC: -179, atmosphere: ['N₂', 'CH₄'], aKm: 1221870, periodDays: 15.945, color: '#e0b060', glow: { color: '#f0c070', strength: 0.9 } },
  { id: 'iapetus', parent: 'saturn', radiusKm: 734.5, massKg: 1.81e21, gravity: 0.22, tempC: -143, aKm: 3560840, periodDays: 79.33, color: '#b0a89a' },
  { id: 'titania', parent: 'uranus', radiusKm: 788.4, massKg: 3.4e21, gravity: 0.37, tempC: -203, aKm: 436300, periodDays: 8.706, color: '#c8c4bc' },
  { id: 'oberon', parent: 'uranus', radiusKm: 761.4, massKg: 3.08e21, gravity: 0.35, tempC: -203, aKm: 583500, periodDays: 13.463, color: '#b8b0a4' },
  { id: 'triton', parent: 'neptune', radiusKm: 1353.4, massKg: 2.14e22, gravity: 0.78, tempC: -235, atmosphere: ['N₂'], aKm: 354760, periodDays: -5.877, color: '#cfdede' },
  { id: 'charon', parent: 'pluto', radiusKm: 606, massKg: 1.586e21, gravity: 0.29, tempC: -220, aKm: 19591, periodDays: 6.387, color: '#b0a8a0' },
];

/** Deep-space probes the backend can fetch from JPL Horizons (ids are Horizons'). */
export const SPACECRAFT = [
  { id: '-31', name: 'Voyager 1', color: '#ffd166', model: '/models/probes/voyager.glb' },
  { id: '-32', name: 'Voyager 2', color: '#ffb347', model: '/models/probes/voyager.glb' },
  { id: '-98', name: 'New Horizons', color: '#9be7ff', model: '/models/probes/new_horizons.glb' },
  { id: '-170', name: 'JWST', color: '#f4c7ff' },
  { id: '-96', name: 'Parker Solar Probe', color: '#ff8c69', model: '/models/probes/parker.glb' },
  { id: '-61', name: 'Juno', color: '#c5f0a4', model: '/models/probes/juno.glb' },
];

/** The sky behind everything: Solar System Scope's Milky Way panorama. */
export const SKY_TEXTURE = [`${T}4k_stars_milky_way.webp`];

export const BODY_BY_ID = new Map([...BODIES, ...MOONS].map((b) => [b.id, b]));

export function moonsOf(parentId) {
  return MOONS.filter((m) => m.parent === parentId);
}

/** Sidereal rotation in hours, deriving it for tidally locked moons. */
export function rotationHoursOf(entry) {
  if (entry.rotationHours) return entry.rotationHours;
  if (entry.periodDays) return entry.periodDays * 24;
  return 24;
}
