/**
 * Geometry for the "draw it yourself" kinematics game.
 *
 * The map is a park measured in metres: x grows to the right, y grows DOWN
 * (SVG convention). Physics coordinates shown to the learner are measured
 * from the reference body (the flag) with y growing UP, so a point P has
 * X = P.x - O.x and Y = O.y - P.y in the chosen frame.
 */

export const W = 120; // map width, m
export const H = 80; // map height, m
export const CELL = 5; // one grid cell, m

/** Where the reference flag stands at the start, and the plane tree it can move to. */
export const HOME_ORIGIN = { x: 10, y: 75 };
export const CHINOR = { x: 70, y: 20 };

export const SPEEDS = { walk: 1.4, run: 4 }; // m/s, a child walking / jogging
export const CLOCKS = [5, 10, 20]; // how many times faster the clock runs than real time

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export const snapToGrid = (p) => ({
  x: clamp(Math.round(p.x / CELL) * CELL, 0, W),
  y: clamp(Math.round(p.y / CELL) * CELL, 0, H),
});

/**
 * The trajectory is one continuous line: strokes are joined end to start, so a
 * single-point stroke is a straight segment from wherever the line ended.
 */
export function flatten(strokes) {
  const pts = [];
  for (const stroke of strokes) {
    for (const p of stroke) {
      const last = pts[pts.length - 1];
      if (!last || dist(last, p) > 1e-6) pts.push(p);
    }
  }
  return pts;
}

/** cum[i] = length of the polyline from pts[0] to pts[i]; the path length is the last entry. */
export function cumulative(pts) {
  const cum = new Array(pts.length);
  if (!pts.length) return cum;
  cum[0] = 0;
  for (let i = 1; i < pts.length; i += 1) cum[i] = cum[i - 1] + dist(pts[i - 1], pts[i]);
  return cum;
}

/** Index of the segment that contains arc length s. */
function segmentAt(cum, s) {
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= s) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** The point at arc length s along the polyline. */
export function pointAt(pts, cum, s) {
  if (!pts.length) return null;
  if (pts.length === 1 || s <= 0) return { ...pts[0] };
  const total = cum[cum.length - 1];
  if (s >= total) return { ...pts[pts.length - 1] };
  const i = segmentAt(cum, s);
  const segLen = cum[i + 1] - cum[i] || 1;
  const f = (s - cum[i]) / segLen;
  return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * f, y: pts[i].y + (pts[i + 1].y - pts[i].y) * f };
}

/** The part of the polyline already walked: every vertex up to s plus the interpolated end. */
export function trailTo(pts, cum, s) {
  if (pts.length < 2 || s <= 0) return [];
  const total = cum[cum.length - 1];
  if (s >= total) return pts;
  const i = segmentAt(cum, s);
  return [...pts.slice(0, i + 1), pointAt(pts, cum, s)];
}

/** Heading in degrees (SVG frame), averaged over a short stretch so freehand jitter does not spin the walker. */
export function headingAt(pts, cum, s) {
  if (pts.length < 2) return 0;
  const total = cum[cum.length - 1];
  const a = pointAt(pts, cum, clamp(s - 0.8, 0, total));
  const b = pointAt(pts, cum, clamp(s + 0.8, 0, total));
  if (dist(a, b) < 1e-6) return 0;
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

export const toSvgPoints = (pts) => pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
