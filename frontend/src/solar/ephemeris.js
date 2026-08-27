import { Body, GeoMoon, HelioVector, JupiterMoons, RotationAxis } from 'astronomy-engine';
import { keplerPosition } from './kepler';
import { msToJd } from './clock';
import { AU_KM } from './scale';

/**
 * Where everything is, for a given instant.
 *
 * Positions come from astronomy-engine (VSOP87 for the planets, a lunar
 * theory for the Moon, Lieske's model for Jupiter's Galilean moons, IAU
 * rotation elements for the poles) — the same models behind planetarium
 * software, checked here against JPL Horizons (see the tests). The old view
 * used one set of Keplerian elements with no secular terms and was a full day
 * behind Horizons for the Earth.
 *
 * Frames: astronomy-engine works in J2000 equatorial coordinates (EQJ). The
 * scene is heliocentric ecliptic, because that is the plane a class expects
 * to look down on. `eqjToEcliptic` is the one rotation between them.
 */

const DEG = Math.PI / 180;
const OBLIQUITY = 23.4392911 * DEG;
const COS_E = Math.cos(OBLIQUITY);
const SIN_E = Math.sin(OBLIQUITY);

export function eqjToEcliptic(v, out = [0, 0, 0]) {
  const x = v.x ?? v[0];
  const y = v.y ?? v[1];
  const z = v.z ?? v[2];
  out[0] = x;
  out[1] = COS_E * y + SIN_E * z;
  out[2] = -SIN_E * y + COS_E * z;
  return out;
}

const bodyCache = new Map();
function astroBody(name) {
  if (!bodyCache.has(name)) bodyCache.set(name, Body[name]);
  return bodyCache.get(name);
}

/**
 * Heliocentric ecliptic position in au for a planet, dwarf planet or the
 * Sun (which is the origin).
 */
export function helioPositionAU(entry, ms, out = [0, 0, 0]) {
  if (entry.kind === 'star') {
    out[0] = out[1] = out[2] = 0;
    return out;
  }
  if (entry.astro) {
    const v = HelioVector(astroBody(entry.astro), new Date(ms));
    return eqjToEcliptic(v, out);
  }
  if (entry.orbit) return keplerPosition(entry.orbit, msToJd(ms), out);
  out[0] = out[1] = out[2] = 0;
  return out;
}

/**
 * Offset of a moon from its planet, in au, ecliptic frame. The Moon and the
 * Galileans use astronomy-engine; other moons run on circular orbits in the
 * planet's equatorial plane, phase-locked to the epoch so time can be scrubbed
 * backwards and forwards deterministically.
 */
export function moonOffsetAU(moon, parent, ms, out = [0, 0, 0]) {
  const date = new Date(ms);
  if (moon.astro === 'Moon') return eqjToEcliptic(GeoMoon(date), out);
  if (moon.galilean) {
    const jm = JupiterMoons(date)[moon.galilean];
    return eqjToEcliptic(jm, out);
  }
  const orient = bodyOrientation(parent, ms);
  const angle = ((ms / 86_400_000) / moon.periodDays) * 2 * Math.PI;
  const r = moon.aKm / AU_KM;
  const c = Math.cos(angle) * r;
  const s = Math.sin(angle) * r;
  const { node: u, north: n } = orient;
  // v = n × u completes a right-handed basis in the equatorial plane.
  const v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  out[0] = c * u[0] + s * v[0];
  out[1] = c * u[1] + s * v[1];
  out[2] = c * u[2] + s * v[2];
  return out;
}

function normalize(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/**
 * Orientation of a body: unit vectors (ecliptic frame) of its north pole and
 * of the node Q where its equator crosses the J2000 equator, and the prime
 * meridian angle W measured from Q. This is the IAU convention that
 * astronomy-engine's `RotationAxis` implements for the Sun, Moon, planets and
 * Pluto; the tilt in the catalogue is used for everything else.
 */
export function bodyOrientation(entry, ms) {
  if (entry.astro && entry.astro !== 'EMB') {
    const axis = RotationAxis(astroBody(entry.astro), new Date(ms));
    const nEqj = [axis.north.x, axis.north.y, axis.north.z];
    // Q = Z × N, normalised (RA = α0 + 90°, on the equator).
    const qEqj = normalize([-nEqj[1], nEqj[0], 0]);
    return {
      north: eqjToEcliptic(nEqj),
      node: eqjToEcliptic(qEqj),
      spinDeg: axis.spin,
    };
  }
  const tilt = (entry.axialTilt || 0) * DEG;
  const hours = entry.rotationHours || (entry.periodDays ? entry.periodDays * 24 : 24);
  const spinDeg = ((ms / 3_600_000 / hours) * 360) % 360;
  return {
    north: [0, -Math.sin(tilt), Math.cos(tilt)],
    node: [1, 0, 0],
    spinDeg,
  };
}

/** Distance between two positions in au. */
export function distanceAU(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Light travel time in minutes for a distance in au. */
export function lightMinutes(au) {
  return (au * AU_KM) / 299792.458 / 60;
}
