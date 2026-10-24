/**
 * The flat plates of the plumb-line tab ("Center of gravity of a body"),
 * and the plane geometry they need: the area centroid of a polygon with
 * holes (that point is the centre of gravity of a thin uniform plate), its
 * moment of inertia about a pin (for a realistic swing), point-in-plate and
 * line intersection. Coordinates are centimetres, y up, the origin at the
 * lower-left corner of the plate's bounding box. Outer contours run
 * counter-clockwise, holes clockwise, so signed areas add up.
 */

const rad = (d) => (d * Math.PI) / 180;

/** Points of a circular arc from angle a0 to a1 (degrees), both ends included. */
function arc(cx, cy, r, a0, a1, n) {
  const out = [];
  for (let i = 0; i <= n; i += 1) {
    const a = rad(a0 + ((a1 - a0) * i) / n);
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

/** Shifts every contour (and the extra points) so the bounding box starts at (0, 0). */
function normalise(contours, points) {
  let x0 = Infinity;
  let y0 = Infinity;
  for (const c of contours) {
    for (const [x, y] of c) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
    }
  }
  const mv = ([x, y]) => [x - x0, y - y0];
  return { contours: contours.map((c) => c.map(mv)), points: points.map(mv) };
}

/* ------------------------------------------------------------- the plates */

// 32 × 20 cm rectangle: C at the crossing of the diagonals, (16; 10).
const RECT = {
  contours: [
    [
      [0, 0],
      [32, 0],
      [32, 20],
      [0, 20],
    ],
  ],
  holes: [
    [3, 17],
    [29, 17],
    [16, 3],
  ],
};

// A scalene triangle: C where the medians cross, ((0+32+8)/3; (0+0+27)/3) = (13.3; 9).
const TRI_V = [
  [0, 0],
  [32, 0],
  [8, 27],
];
const TRI = {
  contours: [TRI_V],
  holes: [
    [8.6, 22.5],
    [4.2, 2],
    [27, 2],
  ],
};

// L-shape 30 × 30 cm, arms 8 cm wide: parts 8 × 30 (C₁ = (4; 15), 240 cm²) and
// 22 × 8 (C₂ = (19; 4), 176 cm²); C = (10.35; 10.35), outside the material.
const L_SHAPE = {
  contours: [
    [
      [0, 0],
      [30, 0],
      [30, 8],
      [8, 8],
      [8, 30],
      [0, 30],
    ],
  ],
  holes: [
    [4, 27],
    [27, 4],
    [3, 3],
  ],
  parts: [
    { x: 0, y: 0, w: 8, h: 30 },
    { x: 8, y: 0, w: 22, h: 8 },
  ],
};

// Ring R = 15 cm, r = 10 cm: C at the centre (15; 15), in the empty middle.
const RING = {
  contours: [arc(15, 15, 15, 0, 360, 72).slice(0, -1), arc(15, 15, 10, 360, 0, 60).slice(0, -1)],
  holes: [90, 210, 330].map((a) => [15 + 12.5 * Math.cos(rad(a)), 15 + 12.5 * Math.sin(rad(a))]),
  circle: { cx: 15, cy: 15, R: 15, r: 10 },
};

// Boomerang: a 150° band between radii 14 and 20 cm with round tips; C lies
// on its symmetry axis, in the empty space between the arms.
function boomerang() {
  const A0 = 195;
  const A1 = 345;
  const tip = (a, from, sign) => {
    const u = [Math.cos(rad(a)), Math.sin(rad(a))];
    const t = [-u[1] * sign, u[0] * sign];
    const c = [17 * u[0], 17 * u[1]];
    const out = [];
    for (let i = 1; i < 12; i += 1) {
      const f = (Math.PI * i) / 12;
      const k = from === 'outer' ? 1 : -1;
      out.push([c[0] + 3 * (k * Math.cos(f) * u[0] + Math.sin(f) * t[0]), c[1] + 3 * (k * Math.cos(f) * u[1] + Math.sin(f) * t[1])]);
    }
    return out;
  };
  const outline = [...arc(0, 0, 20, A0, A1, 40), ...tip(A1, 'outer', 1), ...arc(0, 0, 14, A1, A0, 30), ...tip(A0, 'inner', -1)];
  const holes = [A1, A0, 270].map((a) => [17 * Math.cos(rad(a)), 17 * Math.sin(rad(a))]);
  const n = normalise([outline], [...holes, [0, 0]]);
  return { contours: n.contours, holes: n.points.slice(0, 3), axis: n.points[3] };
}

// An irregular plate, like an island on a map: no formula, only the experiment.
const BLOB = {
  contours: [
    [
      [2, 9],
      [5, 4],
      [10, 1.5],
      [15, 3.5],
      [20, 1],
      [26, 2],
      [31, 5],
      [33.5, 10],
      [31, 14.5],
      [32.5, 19.5],
      [28, 24],
      [21, 22.5],
      [16, 25.5],
      [9.5, 24],
      [5.5, 19.5],
      [1, 15],
    ],
  ],
  holes: [
    [6.5, 18],
    [29, 20],
    [21, 4.5],
  ],
};

export const SHAPE_IDS = ['rect', 'tri', 'L', 'ring', 'boom', 'blob'];
const RAW = { rect: RECT, tri: TRI, L: L_SHAPE, ring: RING, boom: boomerang(), blob: BLOB };

/* --------------------------------------------------------------- geometry */

/** Signed area, area centroid and polar second moment about the origin of a set of contours. */
export function polygonProps(contours) {
  let A = 0;
  let sx = 0;
  let sy = 0;
  let J = 0;
  for (const c of contours) {
    for (let i = 0; i < c.length; i += 1) {
      const [x0, y0] = c[i];
      const [x1, y1] = c[(i + 1) % c.length];
      const cr = x0 * y1 - x1 * y0;
      A += cr / 2;
      sx += ((x0 + x1) * cr) / 6;
      sy += ((y0 + y1) * cr) / 6;
      J += (cr * (x0 * x0 + x0 * x1 + x1 * x1 + y0 * y0 + y0 * y1 + y1 * y1)) / 12;
    }
  }
  return { A, cx: sx / A, cy: sy / A, J };
}

/** Even-odd test: is (x, y) on the material of the plate? */
export function insidePlate(contours, x, y) {
  let inside = false;
  for (const c of contours) {
    for (let i = 0, j = c.length - 1; i < c.length; j = i, i += 1) {
      const [xi, yi] = c[i];
      const [xj, yj] = c[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** Intersection of the lines p1 + s·d1 and p2 + t·d2 (null when nearly parallel). */
export function intersect(p1, d1, p2, d2) {
  const den = d1[0] * d2[1] - d1[1] * d2[0];
  if (Math.abs(den) < 1e-6) return null;
  const s = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / den;
  return [p1[0] + s * d1[0], p1[1] + s * d1[1]];
}

/** SVG path data of the contours (even-odd fill makes holes). `map` turns a point into screen [x, y]. */
export function contourPath(contours, map) {
  return contours
    .map(
      (c) =>
        c
          .map((p, i) => {
            const [x, y] = map(p);
            return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join('') + 'Z',
    )
    .join('');
}

/** Everything the tab needs about one plate, with its centroid and pin inertia. */
function build(id) {
  const raw = RAW[id];
  const p = polygonProps(raw.contours);
  let w = 0;
  let h = 0;
  for (const c of raw.contours) {
    for (const [x, y] of c) {
      w = Math.max(w, x);
      h = Math.max(h, y);
    }
  }
  const jc = p.J - p.A * (p.cx * p.cx + p.cy * p.cy); // polar moment about C, cm⁴ per unit density
  return {
    ...raw,
    id,
    area: p.A,
    c: [p.cx, p.cy],
    jc,
    w,
    h,
    cInside: insidePlate(raw.contours, p.cx, p.cy),
  };
}

export const SHAPES = Object.fromEntries(SHAPE_IDS.map((id) => [id, build(id)]));
export { TRI_V };
