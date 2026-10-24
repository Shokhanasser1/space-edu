/**
 * Constants and plain number helpers of the "artificial satellites" lesson
 * (no JSX, so the physics can be checked in Node).
 */

export const TAU = Math.PI * 2;
/** Earth's gravitational parameter GM, m³/s². */
export const GM = 3.986e14;
/** Mean Earth radius, m (the school value 6400 km is used only in the derivation tab). */
export const R_E = 6.371e6;
export const R_KM = R_E / 1000;
/** g at the surface from GM/R² (≈ 9.82 m/s², the lesson rounds it to 9.8). */
export const G_SURF = GM / (R_E * R_E);
/** Sidereal day, s: one turn of the Earth relative to the stars. */
export const SIDEREAL_DAY = 86164;

/** A time speed-up factor of 1, 2 or 5 × 10ⁿ, the nearest one to `raw` (log scale). */
export function niceFactor(raw) {
  if (!(raw > 1)) return 1;
  const e = Math.floor(Math.log10(raw));
  let best = 1;
  let bd = Infinity;
  for (const p of [e - 1, e, e + 1]) {
    for (const m of [1, 2, 5]) {
      const c = m * 10 ** p;
      const d = Math.abs(Math.log10(c / raw));
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
  }
  return Math.max(1, best);
}

/** The smallest "round" number ≥ x (axis maxima): 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8 × 10ⁿ. */
export function niceCeil(x) {
  if (!(x > 0)) return 1;
  const e = Math.floor(Math.log10(x));
  const p = 10 ** e;
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= x * 0.9999) return m * p;
  return 10 * p;
}

