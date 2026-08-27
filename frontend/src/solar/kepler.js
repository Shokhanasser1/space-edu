/**
 * Two-body Kepler propagation, once in JavaScript and once in GLSL.
 *
 * The planets come from astronomy-engine (VSOP87 — no Kepler here). This is
 * for everything that does not: the four dwarf planets beyond Pluto and the
 * 3 700 real asteroids and Kuiper-belt objects sampled from JPL's Small-Body
 * Database, all of which are given as osculating elements at one epoch. The
 * GPU version drives the belts — thousands of bodies at zero JavaScript cost
 * per frame — and the JS version is its twin, kept in step by the tests so
 * the shader can be trusted without a way to unit-test a shader.
 *
 * Elements: a (au), e, i, om = longitude of ascending node, w = argument of
 * perihelion, ma = mean anomaly at epoch; angles in degrees, epoch a Julian
 * Date. Output: heliocentric ecliptic J2000 coordinates in au.
 */

/** Gaussian gravitational constant expressed as degrees of mean motion per
 *  day for a = 1 au. */
export const K_DEG_PER_DAY = 0.9856076686;

const DEG = Math.PI / 180;

export function meanMotionDegPerDay(a) {
  return K_DEG_PER_DAY / Math.pow(a, 1.5);
}

/** Solve M = E − e·sin E for E (radians). */
export function solveKepler(M, e) {
  let E = e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 12; k++) {
    const f = E - e * Math.sin(E) - M;
    const d = 1 - e * Math.cos(E);
    const step = f / d;
    E -= step;
    if (Math.abs(step) < 1e-9) break;
  }
  return E;
}

/**
 * Heliocentric ecliptic position (au) at Julian Date `jd`.
 * @param {{a:number,e:number,i:number,om:number,w:number,ma:number,epochJd:number}} el
 */
export function keplerPosition(el, jd, out = [0, 0, 0]) {
  const n = meanMotionDegPerDay(el.a);
  let M = (el.ma + n * (jd - el.epochJd)) % 360;
  if (M < 0) M += 360;
  const E = solveKepler(M * DEG, el.e);
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  // Position in the orbital plane, perihelion along +x.
  const xp = el.a * (cosE - el.e);
  const yp = el.a * Math.sqrt(1 - el.e * el.e) * sinE;

  const cw = Math.cos(el.w * DEG), sw = Math.sin(el.w * DEG);
  const co = Math.cos(el.om * DEG), so = Math.sin(el.om * DEG);
  const ci = Math.cos(el.i * DEG), si = Math.sin(el.i * DEG);

  // Rotate by w about z, then i about x, then om about z.
  const x1 = cw * xp - sw * yp;
  const y1 = sw * xp + cw * yp;
  const y2 = ci * y1;
  const z2 = si * y1;
  out[0] = co * x1 - so * y2;
  out[1] = so * x1 + co * y2;
  out[2] = z2;
  return out;
}

/** Orbital period in days. */
export function periodDays(a) {
  return 360 / meanMotionDegPerDay(a);
}

/**
 * The same algorithm for the vertex shader. Attributes: `elems1 = (a, e, i, om)`,
 * `elems2 = (w, ma, n, size)` with angles already in radians and n in
 * rad/day. `uDays` is days since the elements' epoch.
 */
export const KEPLER_GLSL = /* glsl */ `
  vec3 keplerPosition(vec4 e1, vec4 e2, float days) {
    float a = e1.x; float e = e1.y; float inc = e1.z; float om = e1.w;
    float w = e2.x; float M = e2.y + e2.z * days;
    M = mod(M, 6.283185307179586);
    float E = e < 0.8 ? M : 3.141592653589793;
    for (int k = 0; k < 6; k++) {
      E -= (E - e * sin(E) - M) / (1.0 - e * cos(E));
    }
    float xp = a * (cos(E) - e);
    float yp = a * sqrt(1.0 - e * e) * sin(E);
    float cw = cos(w), sw = sin(w), co = cos(om), so = sin(om), ci = cos(inc), si = sin(inc);
    float x1 = cw * xp - sw * yp;
    float y1 = sw * xp + cw * yp;
    float y2 = ci * y1;
    float z2 = si * y1;
    return vec3(co * x1 - so * y2, so * x1 + co * y2, z2);
  }
`;
