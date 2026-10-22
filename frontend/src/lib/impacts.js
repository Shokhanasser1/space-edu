/**
 * Impact craters: how much energy an asteroid brings, and how big a hole it
 * leaves.
 *
 * The Laboratory's crater module is built on this. The energy is school
 * physics — a sphere's mass and its kinetic energy — and the crater size is the
 * scaling law the Earth Impact Effects Program uses:
 *
 *   Collins, G. S., Melosh, H. J. & Marcus, R. A. (2005), "Earth Impact Effects
 *   Program: A Web-based computer program for calculating the regional
 *   environmental consequences of a meteoroid impact on Earth",
 *   Meteoritics & Planetary Science 40, 817-840.
 *
 *   transient crater (eq. 21, SI units)
 *     D_tc = 1.161 (rho_i / rho_t)^(1/3) L^0.78 v^0.44 g^-0.22 sin(theta)^(1/3)
 *   final simple crater (eq. 22)
 *     D_fr = 1.25 D_tc
 *   final complex crater, once a simple one would exceed D_c (eq. 27)
 *     D_fr = 1.17 D_tc^1.13 / D_c^0.13
 *
 * L is the impactor's diameter, v its speed at the surface, theta the angle
 * from the horizontal, g the target's surface gravity. The exponents on D_tc
 * and D_c sum to one, so eq. 27 works in any unit of length.
 *
 * What the module does NOT model, and says so on the page: the atmosphere.
 * Collins et al. slow and break the impactor up on the way down; here it
 * arrives at the speed the reader set. That matters most for small stony and
 * icy bodies on Earth, which often explode in the air instead — the roughly
 * 20 m asteroid over Chelyabinsk in February 2013 did. The Moon has no air, so
 * there the model is closer to the whole story. Scaling laws like these are
 * good to some tens of per cent.
 *
 * Other figures:
 *   1 megaton of TNT = 4.184e15 J (the defined value, 1 kt = 4.184e12 J).
 *   Target density 2500 kg/m^3 on Earth — sedimentary rock, the value Collins
 *   et al. use for it. 2550 kg/m^3 on the Moon — the mean density of the lunar
 *   crust from GRAIL (Wieczorek et al. 2013, Science 339, 671).
 *   Surface gravity 9.81 m/s^2 (Earth) and 1.62 m/s^2 (Moon).
 *   Simple-to-complex transition: 3.2 km on Earth (Collins et al. 2005); about
 *   15 km on the Moon (Pike 1977; Melosh 1989, "Impact Cratering"). Both are
 *   approximate — real craters change form over a range of sizes.
 *   Slowest possible impact: the target's escape speed, 11.2 km/s for Earth
 *   and 2.4 km/s for the Moon. Fastest considered: 72 km/s.
 *   45 degrees is the most likely impact angle (Shoemaker 1962), hence the
 *   default.
 *
 * Meteor Crater, Arizona, is about 1.2 km across and about 50 000 years old,
 * made by an iron impactor of the order of 50 m. Melosh & Collins (2005,
 * Nature 434, 157) argue for an impact speed near 12 km/s. With those inputs
 * this model gives about 1.5 km, and the module prints the model's own figure
 * next to the real one rather than tuning anything to make them agree.
 *
 * The other famous impacts, with the same honesty:
 *
 *   Chicxulub, Mexico, 66 million years ago: a crater about 180 km across
 *   (Hildebrand et al. 1991, Geology 19, 867) from a stony asteroid usually put
 *   at about 10 km (Schulte et al. 2010, Science 327, 1214), arriving steeply,
 *   45-60 degrees (Collins et al. 2020, Nat. Commun. 11, 1480). At 10 km, 20 km/s
 *   and 60 degrees this model gives about 130 km — short of 180, and the page
 *   says so: estimates of the asteroid's size differ, and a scaling law is
 *   least certain at the very largest sizes.
 *
 *   Chelyabinsk, Russia, 15 February 2013: a stony body about 19 m across at
 *   about 19 km/s and 18 degrees, which released about 500 kt of TNT some
 *   30 km up and left no crater (Popova et al. 2013, Science 342, 1069; Brown
 *   et al. 2013, Nature 503, 238). This model has no air, so it digs one
 *   anyway; the preset is there to show the airburst warning, and its energy,
 *   about 0.47 Mt, agrees with the measured one.
 *
 * Tashkent covers about 335 km^2; a circle of that area is about 20.6 km wide,
 * which is the "wider than Tashkent" line.
 */

/** Joules in one megaton of TNT. */
export const JOULES_PER_MEGATON = 4.184e15;

/** Impactor densities, kg/m^3. */
export const IMPACTOR_DENSITY = {
  ice: 1000,
  stone: 3000,
  iron: 7800,
};

/** The two target bodies. */
export const BODIES = {
  earth: { gravity: 9.81, targetDensity: 2500, transitionDiameterM: 3200, minSpeedKms: 11.2 },
  moon: { gravity: 1.62, targetDensity: 2550, transitionDiameterM: 15000, minSpeedKms: 2.4 },
};

export const MAX_SPEED_KMS = 72;

/** The Meteor Crater preset, and the real crater it is compared with. */
export const METEOR_CRATER = {
  body: 'earth',
  diameterM: 50,
  composition: 'iron',
  speedKms: 12.8,
  angleDeg: 45,
  realDiameterM: 1200,
};

/**
 * Famous impacts the presets jump to (sources in the header). `realDiameterM`
 * is the real crater, `null` where there is none to compare: Chelyabinsk
 * exploded in the air, and the Moon preset is the Meteor Crater rock moved
 * to the Moon to compare the two worlds.
 */
export const IMPACT_PRESETS = {
  meteor: { ...METEOR_CRATER },
  chicxulub: {
    body: 'earth',
    diameterM: 10000,
    composition: 'stone',
    speedKms: 20,
    angleDeg: 60,
    realDiameterM: 180000,
  },
  chelyabinsk: {
    body: 'earth',
    diameterM: 19,
    composition: 'stone',
    speedKms: 19,
    angleDeg: 18,
    realDiameterM: null,
    airburst: true,
  },
  moon: { ...METEOR_CRATER, body: 'moon', realDiameterM: null },
};

/** Tashkent's area, km^2, and the width of a circle that size, m (about 20.6 km). */
export const TASHKENT_AREA_KM2 = 335;
export const TASHKENT_WIDTH_M = 2 * Math.sqrt(TASHKENT_AREA_KM2 / Math.PI) * 1000;

/** A crater this wide counts as dinosaur-killer class for the mission, m. */
export const GIANT_CRATER_M = 100000;

/** Whether two impacts used the same asteroid (size, make-up, speed, angle). */
export function sameImpactor(a, b) {
  return (
    Math.abs(Math.log10(a.diameterM) - Math.log10(b.diameterM)) < 1e-6 &&
    a.composition === b.composition &&
    Math.abs(a.speedKms - b.speedKms) < 1e-6 &&
    a.angleDeg === b.angleDeg
  );
}

/** Mass of a spherical impactor, kg. */
export function impactorMass(diameterM, density) {
  return density * (Math.PI / 6) * diameterM ** 3;
}

/** Kinetic energy, J. */
export function kineticEnergy(massKg, speedKms) {
  const v = speedKms * 1000;
  return 0.5 * massKg * v * v;
}

/** Energy in megatons of TNT. */
export function megatons(energyJ) {
  return energyJ / JOULES_PER_MEGATON;
}

/** Transient crater diameter, m (Collins et al. 2005, eq. 21). */
export function transientCraterDiameter({ diameterM, composition, speedKms, angleDeg, body }) {
  const target = BODIES[body];
  const rhoI = IMPACTOR_DENSITY[composition];
  const theta = (angleDeg * Math.PI) / 180;
  return (
    1.161 *
    Math.cbrt(rhoI / target.targetDensity) *
    diameterM ** 0.78 *
    (speedKms * 1000) ** 0.44 *
    target.gravity ** -0.22 *
    Math.cbrt(Math.sin(theta))
  );
}

/** Final crater diameter, m, and whether it is complex (eqs. 22 and 27). */
export function finalCrater(transientM, body) {
  const dc = BODIES[body].transitionDiameterM;
  const simple = 1.25 * transientM;
  if (simple <= dc) return { diameterM: simple, complex: false };
  return { diameterM: (1.17 * transientM ** 1.13) / dc ** 0.13, complex: true };
}

/** Everything the module prints about one impact. */
export function simulateImpact(params) {
  const mass = impactorMass(params.diameterM, IMPACTOR_DENSITY[params.composition]);
  const energy = kineticEnergy(mass, params.speedKms);
  const transient = transientCraterDiameter(params);
  return { mass, energy, megatons: megatons(energy), transientM: transient, ...finalCrater(transient, params.body) };
}

/** How far off a guess is, as a factor of at least 1 either way. */
export function guessFactor(guessM, actualM) {
  return Math.max(guessM / actualM, actualM / guessM);
}

/** A guess within this factor of the model counts as a good prediction. */
export const GOOD_GUESS_FACTOR = 1.5;

/**
 * Depth below the original ground at distance `x` from the centre, for drawing
 * (negative is above ground: the raised rim). Schematic, and the page says so:
 * a fresh simple crater is about one fifth as deep as it is wide (Pike 1977
 * for lunar simple craters); a complex one is shallower with a flat floor and
 * a central peak. Only the diameter is a computed figure.
 */
export function craterDepthAt(x, diameterM, complex) {
  const radius = diameterM / 2;
  if (radius <= 0) return 0;
  const r = Math.abs(x) / radius;
  const rimHeight = (complex ? 0.015 : 0.03) * diameterM;
  const rim = rimHeight * Math.exp(-(((r - 1) / 0.15) ** 2));
  if (!complex) return (r < 1 ? 0.2 * diameterM * (1 - r * r) : 0) - rim;
  const depth = 0.07 * diameterM;
  let bowl = 0;
  if (r < 0.6) bowl = depth - 0.4 * depth * Math.exp(-((r / 0.12) ** 2));
  else if (r < 1) bowl = depth * (1 - ((r - 0.6) / 0.4) ** 1.5);
  return bowl - rim;
}
