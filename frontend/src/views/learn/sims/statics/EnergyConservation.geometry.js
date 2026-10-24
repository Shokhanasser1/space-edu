/**
 * Tracks of the "skate park" lab of the lesson "To'liq mexanik energiyaning
 * saqlanish qonuni" and the motion of a cart along them.
 *
 * Every track is 14 m wide, starts and ends 7 m above the zero level (y = 0,
 * its lowest point), and is resampled to equal steps of arc length so the
 * motion can be integrated in the path coordinate s. The cart runs on the
 * rail like a roller-coaster car (its wheels hold the rail from both sides),
 * so it never leaves the track; its motion obeys
 *
 *   dv/dt = −g·sin θ − μ·|N|/m·sign v,   N/m = v²·κ + g·cos θ,
 *
 * θ the slope angle of the rail and κ its signed curvature (positive when the
 * rail turns towards the cart). Without friction (μ = 0) the speed follows
 * v = √(2g(h₀ − y)) exactly, which the integrator enforces to stop drift.
 */

export const G = 9.8;
export const TRACK_W = 14;
export const TRACK_TOP = 7;
const DS = 0.01; // m, resampling step

/** Default shape parameter and its range for every preset. */
export const SHAPES = {
  u: { min: 0, max: 6, step: 0.5, def: 2 }, // flat bottom width, m
  hill: { min: 1, max: 5.5, step: 0.5, def: 3.5 }, // hill height, m
  loop: { min: 1, max: 2, step: 0.1, def: 1.6 }, // loop radius R, m
  step: { min: 1, max: 4.5, step: 0.5, def: 2.5 }, // step height, m
};

const piece = (n, f) => Array.from({ length: n + 1 }, (_, i) => f(i / n));
const cosDown = (x0, w) => (u) => ({ x: x0 + w * u, y: (TRACK_TOP / 2) * (1 + Math.cos(Math.PI * u)) });
const flat = (x0, x1, y = 0) => (u) => ({ x: x0 + (x1 - x0) * u, y });

/** Dense polyline of the track and the pieces worth labelling. */
function rawTrack(id, p) {
  const parts = [];
  const meta = {};
  if (id === 'u') {
    const b = p;
    const a = (TRACK_W - b) / 2;
    parts.push(piece(500, (u) => ({ x: a * u, y: TRACK_TOP * (1 - u) ** 2 })));
    if (b > 0) parts.push(piece(60, flat(a, a + b)));
    parts.push(piece(500, (u) => ({ x: a + b + a * u, y: TRACK_TOP * u * u })));
    meta.bottom = { x0: a, x1: a + b };
  } else if (id === 'hill') {
    const H = p;
    parts.push(piece(400, cosDown(0, 4)));
    parts.push(piece(600, (u) => ({ x: 4 + 6 * u, y: (H / 2) * (1 - Math.cos(2 * Math.PI * u)) })));
    parts.push(piece(400, (u) => ({ x: 10 + 4 * u, y: (TRACK_TOP / 2) * (1 - Math.cos(Math.PI * u)) })));
    meta.hill = { x: 7, H };
  } else if (id === 'loop') {
    const R = p;
    const c = 6.5;
    const w = 0.8; // sideways drift so the exit does not hide the entry
    parts.push(piece(400, cosDown(0, 4)));
    parts.push(piece(100, flat(4, c)));
    parts.push(
      piece(900, (u) => {
        const phi = -Math.PI / 2 + 2 * Math.PI * u;
        return { x: c + R * Math.cos(phi) + w * u, y: R + R * Math.sin(phi) };
      }),
    );
    parts.push(piece(100, flat(c + w, 10)));
    parts.push(piece(400, (u) => ({ x: 10 + 4 * u, y: (TRACK_TOP / 2) * (1 - Math.cos(Math.PI * u)) })));
    meta.loop = { cx: c + w / 2, R, top: 2 * R };
  } else {
    const P = p;
    parts.push(piece(400, cosDown(0, 4)));
    parts.push(piece(60, flat(4, 5)));
    parts.push(piece(240, (u) => ({ x: 5 + 2 * u, y: (P / 2) * (1 - Math.cos(Math.PI * u)) })));
    parts.push(piece(160, flat(7, 10, P)));
    parts.push(piece(400, (u) => ({ x: 10 + 4 * u, y: P + ((TRACK_TOP - P) / 2) * (1 - Math.cos(Math.PI * u)) })));
    meta.step = { x0: 7, x1: 10, P };
  }
  const pts = [];
  parts.forEach((pp, i) => pts.push(...(i === 0 ? pp : pp.slice(1))));
  return { pts, meta };
}

/**
 * The track resampled every DS metres of arc length: x, y, slope angle θ,
 * signed curvature κ, and helpers to look them up at any s.
 */
export function buildTrack(id, p) {
  const { pts, meta } = rawTrack(id, p);
  const cum = [0];
  for (let i = 1; i < pts.length; i += 1) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const L = cum[cum.length - 1];
  const n = Math.floor(L / DS) + 1;
  const X = new Float64Array(n);
  const Y = new Float64Array(n);
  let j = 1;
  for (let k = 0; k < n; k += 1) {
    const s = k * DS;
    while (j < cum.length - 1 && cum[j] < s) j += 1;
    const f = (s - cum[j - 1]) / Math.max(cum[j] - cum[j - 1], 1e-12);
    X[k] = pts[j - 1].x + (pts[j].x - pts[j - 1].x) * f;
    Y[k] = pts[j - 1].y + (pts[j].y - pts[j - 1].y) * f;
  }
  const TH = new Float64Array(n);
  for (let k = 0; k < n; k += 1) {
    const a = Math.max(0, k - 1);
    const b = Math.min(n - 1, k + 1);
    TH[k] = Math.atan2(Y[b] - Y[a], X[b] - X[a]);
    if (k > 0) {
      while (TH[k] - TH[k - 1] > Math.PI) TH[k] -= 2 * Math.PI;
      while (TH[k] - TH[k - 1] < -Math.PI) TH[k] += 2 * Math.PI;
    }
  }
  const K0 = new Float64Array(n);
  for (let k = 0; k < n; k += 1) {
    const a = Math.max(0, k - 2);
    const b = Math.min(n - 1, k + 2);
    K0[k] = (TH[b] - TH[a]) / ((b - a) * DS);
  }
  // light smoothing of κ (joins of pieces), window ±4 samples
  const K = new Float64Array(n);
  for (let k = 0; k < n; k += 1) {
    let sum = 0;
    let c = 0;
    for (let q = Math.max(0, k - 4); q <= Math.min(n - 1, k + 4); q += 1) {
      sum += K0[q];
      c += 1;
    }
    K[k] = sum / c;
  }
  const at = (arr, s) => {
    const u = Math.min(n - 1.000001, Math.max(0, s / DS));
    const i = Math.floor(u);
    const f = u - i;
    return arr[i] + (arr[i + 1] - arr[i]) * f;
  };
  /** s of the first point (from the left end) where the descending start ramp is at height h. */
  const sAtHeight = (h) => {
    for (let k = 1; k < n; k += 1) if (Y[k] <= h) return (k - 1) * DS + ((Y[k - 1] - h) / Math.max(Y[k - 1] - Y[k], 1e-12)) * DS;
    return 0;
  };
  return {
    id,
    p,
    L: (n - 1) * DS,
    n,
    X,
    Y,
    meta,
    x: (s) => at(X, s),
    y: (s) => at(Y, s),
    th: (s) => at(TH, s),
    k: (s) => at(K, s),
    sAtHeight,
  };
}

/** Tangential acceleration of the cart at (s, v). */
function accel(track, s, v, mu) {
  const th = track.th(s);
  let a = -G * Math.sin(th);
  if (mu > 0 && Math.abs(v) > 1e-9) {
    const nPerM = v * v * track.k(s) + G * Math.cos(th);
    a -= Math.sign(v) * mu * Math.abs(nPerM);
  }
  return a;
}

/**
 * Advance the cart by `dt` seconds (several RK4 substeps). Returns the new
 * { s, v, stopped }. With μ = 0 the speed is put back onto √(2g(h₀ − y)).
 */
export function stepCart(track, state, dt, { mu, h0 }) {
  let { s, v } = state;
  let stopped = false;
  const n = Math.max(1, Math.ceil(dt / 0.002));
  const h = dt / n;
  for (let i = 0; i < n; i += 1) {
    if (mu > 0) {
      // slow enough for friction to stop it within this substep, where static friction can hold it
      const th = track.th(s);
      const holds = Math.abs(Math.sin(th)) <= mu * Math.abs(Math.cos(th)) + 1e-9;
      if (holds && Math.abs(v) <= mu * G * Math.abs(Math.cos(th)) * h * 1.5) {
        v = 0;
        stopped = true;
        break;
      }
    }
    const k1v = accel(track, s, v, mu);
    const k1s = v;
    const k2v = accel(track, s + (h / 2) * k1s, v + (h / 2) * k1v, mu);
    const k2s = v + (h / 2) * k1v;
    const k3v = accel(track, s + (h / 2) * k2s, v + (h / 2) * k2v, mu);
    const k3s = v + (h / 2) * k2v;
    const k4v = accel(track, s + h * k3s, v + h * k3v, mu);
    const k4s = v + h * k3v;
    const vNew = v + (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
    const sNew = s + (h / 6) * (k1s + 2 * k2s + 2 * k3s + k4s);
    if (mu > 0 && v !== 0 && Math.sign(vNew) !== Math.sign(v)) {
      // the cart comes to rest: it stays if static friction can hold it here
      const th = track.th(sNew);
      if (Math.abs(Math.sin(th)) <= mu * Math.abs(Math.cos(th)) + 1e-9) {
        s = sNew;
        v = 0;
        stopped = true;
        break;
      }
    }
    s = Math.min(track.L, Math.max(0, sNew));
    v = vNew;
    if (mu === 0) {
      const vv = Math.sqrt(Math.max(0, 2 * G * (h0 - track.y(s))));
      if (vv > 0.05) v = Math.sign(v || 1) * vv;
    }
  }
  return { s, v, stopped };
}
