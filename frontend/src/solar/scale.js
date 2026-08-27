/**
 * How big things are on screen.
 *
 * At true scale the Solar System is invisible: the Earth is 0.0017 of the
 * Earth–Sun distance, so at any zoom that shows an orbit the planet is a
 * fraction of a pixel. Every viewer — NASA Eyes, Celestia, Stellarium — cheats
 * somewhere, and the honest way to cheat is to say so. This module owns the
 * cheat: distances are real (1 au = 40 units), body sizes follow a log curve
 * in `visual` mode, and the `true` mode switches the cheat off so a class can
 * see with their own eyes why it was needed.
 */

export const AU_KM = 149597870.7;
export const AU_UNITS = 40;
export const SUN_VISUAL_RADIUS = 6;

export const SCALE_MODES = ['visual', 'true'];

/** Scene units per kilometre at true scale. */
export const UNITS_PER_KM = AU_UNITS / AU_KM;

/**
 * Radius on screen for a body of `radiusKm`.
 *
 * `visual`: log curve — the Earth ≈ 1.0, Jupiter ≈ 1.9, the Moon ≈ 0.6, tiny
 * moons stop at 0.16 so they can still be clicked. Moons get a further factor
 * so they never swallow the planet they orbit. `true`: kilometres.
 */
export function displayRadius(radiusKm, mode = 'visual', { isMoon = false } = {}) {
  if (mode === 'true') return Math.max(radiusKm * UNITS_PER_KM, 0.0004);
  if (radiusKm > 100000) return SUN_VISUAL_RADIUS;
  const r = Math.max(0.16, (Math.log10(radiusKm) - 2.5) * 0.8);
  return isMoon ? r * 0.55 : r;
}

/**
 * Where a moon sits relative to its planet, in scene units, given the real
 * semi-major axis. In `true` mode this is the real distance. In `visual` mode
 * the planet is drawn hundreds of times too large, so the real distance would
 * put the Moon inside the Earth; a log compression keeps the ordering of the
 * moons (Io inside Europa inside Ganymede) while keeping each of them outside
 * the inflated planet.
 */
export function moonOrbitRadius(aKm, parentRadiusKm, parentDisplayRadius, mode = 'visual') {
  if (mode === 'true') return aKm * UNITS_PER_KM;
  const ratio = aKm / parentRadiusKm;
  return parentDisplayRadius * (1.3 + 1.2 * Math.log(1 + ratio));
}

/** Kilometre offsets around a body (satellites) expressed in scene units. */
export function kmToUnitsAround(km, bodyRadiusKm, bodyDisplayRadius) {
  return (km / bodyRadiusKm) * bodyDisplayRadius;
}

export function auToUnits(au) {
  return au * AU_UNITS;
}

/** Ecliptic (x east, y north-of-vernal, z up) → three.js (x, y up, z). */
export function eclipticToScene(v, scale = AU_UNITS, out = [0, 0, 0]) {
  out[0] = v[0] * scale;
  out[1] = v[2] * scale;
  out[2] = -v[1] * scale;
  return out;
}
