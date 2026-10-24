/**
 * Route geometry for the "Yo'l va ko'chish" simulator. Every route is built
 * from straight segments and circular arcs measured in metres, with the start
 * point at the origin (x to the east, y to the north). Positions are found by
 * arc length, so the path s is exact and the displacement |Δr| is simply the
 * distance of the current point from the origin.
 */

/** segments: { type: 'line', from: [x, y], to: [x, y] } | { type: 'arc', c: [x, y], r, a0, a1 } (radians). */
export function makeRoute(segments) {
  let acc = 0;
  const segs = segments.map((sg) => {
    const len = sg.type === 'line' ? Math.hypot(sg.to[0] - sg.from[0], sg.to[1] - sg.from[1]) : Math.abs(sg.a1 - sg.a0) * sg.r;
    const out = { ...sg, len, s0: acc };
    acc += len;
    return out;
  });
  return { segs, length: acc };
}

/** Point and unit tangent at arc length s along one pass of the route. */
export function pointOnRoute(route, s) {
  const sl = Math.min(Math.max(s, 0), route.length);
  let sg = route.segs[route.segs.length - 1];
  for (const cand of route.segs) {
    if (sl <= cand.s0 + cand.len + 1e-9) {
      sg = cand;
      break;
    }
  }
  const u = sg.len > 0 ? (sl - sg.s0) / sg.len : 0;
  if (sg.type === 'line') {
    const dx = sg.to[0] - sg.from[0];
    const dy = sg.to[1] - sg.from[1];
    return { x: sg.from[0] + dx * u, y: sg.from[1] + dy * u, tx: dx / sg.len, ty: dy / sg.len };
  }
  const dir = Math.sign(sg.a1 - sg.a0) || 1;
  const a = sg.a0 + (sg.a1 - sg.a0) * u;
  return {
    x: sg.c[0] + sg.r * Math.cos(a),
    y: sg.c[1] + sg.r * Math.sin(a),
    tx: -Math.sin(a) * dir,
    ty: Math.cos(a) * dir,
  };
}

/**
 * Position after travelling a total path s on a route that may be repeated
 * (laps). After a whole number of laps the runner is at the end of the route,
 * which for closed routes is the start again.
 */
export function positionAt(route, s) {
  const L = route.length;
  if (s <= 0) return pointOnRoute(route, 0);
  let sl = s % L;
  if (sl < 1e-9) sl = L;
  return pointOnRoute(route, sl);
}

/** n+1 evenly spaced samples along one pass of the route. */
export function sampleRoute(route, n) {
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const s = (route.length * i) / n;
    pts.push({ s, ...pointOnRoute(route, s) });
  }
  return pts;
}

/* -------------------------------------------------------------- the routes */

/**
 * A standard 400 m athletics track. Lane 1 is measured 0.30 m outside the
 * kerb: straights 84.39 m, bends of radius 36.80 m, 2·84.39 + 2π·36.80 = 400 m.
 * The runner starts at the beginning of the home straight and runs
 * anticlockwise (infield on the left), as in competition.
 */
export const STADIUM = (() => {
  const Ls = 84.39;
  const R = (400 - 2 * Ls) / (2 * Math.PI);
  const kerb = R - 0.3;
  const laneW = 1.22;
  const lanes = 6;
  const route = makeRoute([
    { type: 'line', from: [0, 0], to: [Ls, 0] },
    { type: 'arc', c: [Ls, R], r: R, a0: -Math.PI / 2, a1: Math.PI / 2 },
    { type: 'line', from: [Ls, 2 * R], to: [0, 2 * R] },
    { type: 'arc', c: [0, R], r: R, a0: Math.PI / 2, a1: 1.5 * Math.PI },
  ]);
  const outer = kerb + laneW * lanes;
  return {
    route,
    Ls,
    R,
    kerb,
    laneW,
    lanes,
    bounds: { x0: -outer - 3, x1: Ls + outer + 3, y0: R - outer - 3, y1: R + outer + 3 },
  };
})();

/** 50 m out along a straight line and 50 m back. */
export const SHUTTLE = {
  route: makeRoute([
    { type: 'line', from: [0, 0], to: [50, 0] },
    { type: 'line', from: [50, 0], to: [0, 0] },
  ]),
  bounds: { x0: -7, x1: 57, y0: -9, y1: 9 },
};

/** School to home along two streets: 400 m east, then 300 m north (|Δr| = 500 m). */
export const SCHOOL = {
  route: makeRoute([
    { type: 'line', from: [0, 0], to: [400, 0] },
    { type: 'line', from: [400, 0], to: [400, 300] },
  ]),
  bounds: { x0: -70, x1: 470, y0: -70, y1: 350 },
  streetsX: [-130, 130, 265, 400, 530],
  streetsY: [-160, 0, 160, 320, 480],
  streetW: 16,
};

/** A zigzag of eight 25 m legs (7 m along, 24 m across): s = 200 m, |Δr| = 56 m. */
export const ZIGZAG = (() => {
  const legs = [];
  const pts = [[0, 0]];
  for (let i = 1; i <= 8; i += 1) pts.push([7 * i, i % 2 === 1 ? 24 : 0]);
  for (let i = 0; i < 8; i += 1) legs.push({ type: 'line', from: pts[i], to: pts[i + 1] });
  return { route: makeRoute(legs), vertices: pts, bounds: { x0: -7, x1: 63, y0: -6, y1: 30 } };
})();

/** Largest distance from the start reached anywhere on the route. */
export function maxDisplacement(route) {
  let m = 0;
  for (const p of sampleRoute(route, 2000)) m = Math.max(m, Math.hypot(p.x, p.y));
  return m;
}
