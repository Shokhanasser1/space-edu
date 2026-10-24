/**
 * Ideal (potential) flow past a wing section, for the "applications" tab of
 * the Bernoulli lesson: a Joukowski airfoil z = ζ + c²/ζ made from a circle
 * of radius a around μ, with the circulation fixed by the Kutta condition
 * (Γ = 4πUa·sin(α + β): the flow leaves the sharp trailing edge smoothly).
 *
 * Everything here is in "airfoil units" (c = 1, chord ≈ 4.03) and for a unit
 * free-stream speed U = 1; speeds scale with U and pressures with ρU²/2.
 * The free stream is horizontal on screen and the wing is pitched nose-up by
 * the angle of attack α ("display" frame = airfoil frame turned by −α).
 *
 * With p = p₀ + ρ(U² − v²)/2 (Bernoulli along every streamline), the average
 * over the chord of p_below − p_above equals ρ(⟨v_top²⟩ − ⟨v_bottom²⟩)/2, and
 * this average times the chord is exactly the Kutta–Joukowski lift ρUΓ —
 * so "F ≈ Δp·S" with these mean speeds is a fair school-level estimate.
 */

const C = 1;
const EX = 0.09; // thickness (≈ 10.7 % of the chord)
const EY = 0.07; // camber
const MU = { x: -EX, y: EY };
const A = Math.hypot(C - MU.x, MU.y);
const BETA = Math.atan2(EY, C + EX);

const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const mul = (p, q) => ({ x: p.x * q.x - p.y * q.y, y: p.x * q.y + p.y * q.x });
const div = (p, q) => {
  const d = q.x * q.x + q.y * q.y || 1e-12;
  return { x: (p.x * q.x + p.y * q.y) / d, y: (p.y * q.x - p.x * q.y) / d };
};
const csqrt = (p) => {
  const r = Math.hypot(p.x, p.y);
  const x = Math.sqrt(Math.max(0, (r + p.x) / 2));
  const y = Math.sign(p.y || 1) * Math.sqrt(Math.max(0, (r - p.x) / 2));
  return { x, y };
};
const rot = (p, ang) => ({ x: p.x * Math.cos(ang) - p.y * Math.sin(ang), y: p.x * Math.sin(ang) + p.y * Math.cos(ang) });

/** z = ζ + c²/ζ */
function jouk(z) {
  return add(z, div({ x: C * C, y: 0 }, z));
}

/** The ζ outside the circle that maps to z, or null when z is inside the wing. */
function inverse(z) {
  const s = csqrt(sub(mul(z, z), { x: 4 * C * C, y: 0 }));
  const r1 = { x: (z.x + s.x) / 2, y: (z.y + s.y) / 2 };
  const r2 = { x: (z.x - s.x) / 2, y: (z.y - s.y) / 2 };
  const d1 = Math.hypot(r1.x - MU.x, r1.y - MU.y);
  const d2 = Math.hypot(r2.x - MU.x, r2.y - MU.y);
  const best = d1 >= d2 ? r1 : r2;
  return Math.max(d1, d2) < A * 1.0005 ? null : best;
}

/**
 * Velocity (u, v) in the airfoil frame at ζ for U = 1 and angle α (radians):
 * dF/dζ = e^{−iα} − a²e^{iα}/(ζ−μ)² + iΓ/(2π(ζ−μ)), divided by dz/dζ.
 */
function velAt(zeta, al) {
  const g = 4 * Math.PI * A * Math.sin(al + BETA);
  const d = sub(zeta, MU);
  const e1 = { x: Math.cos(al), y: -Math.sin(al) };
  const e2 = { x: A * A * Math.cos(al), y: A * A * Math.sin(al) };
  const w1 = sub(e1, div(e2, mul(d, d)));
  const w2 = div({ x: 0, y: g / (2 * Math.PI) }, d);
  const dF = add(w1, w2);
  const dz = sub({ x: 1, y: 0 }, div({ x: C * C, y: 0 }, mul(zeta, zeta)));
  const w = div(dF, dz);
  return { u: w.x, v: -w.y };
}

/** Speed (U = 1) at a display-frame point, or null inside the wing. */
export function speedAtDisplay(X, Y, alphaRad) {
  const z = rot({ x: X, y: Y }, alphaRad);
  const zeta = inverse(z);
  if (!zeta) return null;
  const w = velAt(zeta, alphaRad);
  return Math.hypot(w.u, w.v);
}

/** Velocity (U = 1) at a display-frame point, in the display frame; null inside. */
function velDisplay(X, Y, alphaRad) {
  const z = rot({ x: X, y: Y }, alphaRad);
  const zeta = inverse(z);
  if (!zeta) return null;
  const w = velAt(zeta, alphaRad);
  const r = rot({ x: w.u, y: w.v }, -alphaRad);
  return { u: r.x, v: r.y };
}

/**
 * The wing outline and its surface speeds, for angle α (radians).
 * Returns { outline: [{x,y}] in the display frame, chord, xLE, xTE,
 * top/bottom: [{ s, v }] with s ∈ [0, 1] along the chord (LE → TE) and v the
 * surface speed for U = 1, vTop/vBot: rms speeds over the chord, cl: mean
 * pressure difference / (ρU²/2) }.
 */
export function wingSurface(alphaRad, n = 480) {
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const th = -BETA + (2 * Math.PI * i) / n;
    const zeta = add(MU, { x: A * Math.cos(th), y: A * Math.sin(th) });
    const z = jouk(zeta);
    // |dF/dζ| on the circle = |2U·sin(θ − α) + Γ/(2πa)|
    const dF = Math.abs(2 * Math.sin(th - alphaRad) + 2 * Math.sin(alphaRad + BETA));
    const dz = sub({ x: 1, y: 0 }, div({ x: C * C, y: 0 }, mul(zeta, zeta)));
    const md = Math.hypot(dz.x, dz.y);
    pts.push({ x: z.x, y: z.y, v: i === 0 ? NaN : dF / md });
  }
  // the trailing-edge speed is finite: take the neighbours' mean
  pts[0].v = (pts[1].v + pts[n - 1].v) / 2;
  let iLE = 0;
  for (let i = 1; i < n; i += 1) if (pts[i].x < pts[iLE].x) iLE = i;
  const xLE = pts[iLE].x;
  const xTE = pts[0].x;
  const chord = xTE - xLE;
  const top = pts.slice(0, iLE + 1).reverse(); // LE → TE over the top
  const bot = pts.slice(iLE).concat([pts[0]]); // LE → TE underneath
  const toS = (arr) => arr.map((p) => ({ s: (p.x - xLE) / chord, v: p.v, x: p.x, y: p.y }));
  const T = toS(top);
  const B = toS(bot);
  const interp = (arr, s) => {
    for (let i = 0; i < arr.length - 1; i += 1) {
      const p = arr[i];
      const q = arr[i + 1];
      if ((p.s - s) * (q.s - s) <= 0 && p.s !== q.s) {
        const f = (s - p.s) / (q.s - p.s);
        return p.v + f * (q.v - p.v);
      }
    }
    return arr[arr.length - 1].v;
  };
  let st = 0;
  let sb = 0;
  const m = 400;
  const prof = [];
  for (let k = 0; k <= m; k += 1) {
    const s = k / m;
    const vt = interp(T, s);
    const vb = interp(B, s);
    prof.push({ s, vt, vb });
    if (k > 0 && k < m) {
      st += vt * vt;
      sb += vb * vb;
    }
  }
  const vTop = Math.sqrt(st / (m - 1));
  const vBot = Math.sqrt(sb / (m - 1));
  const outline = pts.map((p) => rot(p, -alphaRad));
  // quarter-chord point (where the lift of a thin wing acts), display frame
  const qc = rot({ x: xLE + chord * 0.25, y: (T[Math.round(T.length * 0.25)].y + B[Math.round(B.length * 0.25)].y) / 2 }, -alphaRad);
  return { outline, chord, profile: prof, vTop, vBot, cl: vTop * vTop - vBot * vBot, qc };
}

/**
 * Streamlines through the display window [x0, x1] for angle α, seeded at the
 * left edge at heights `ys`. Each line: { pts: [{x,y}], t: cumulative travel
 * time for U = 1 }.
 */
export function wingStreamlines(alphaRad, x0, x1, ys) {
  const lines = [];
  const ds = 0.03;
  for (const y0 of ys) {
    let p = { x: x0, y: y0 };
    const pts = [{ ...p }];
    const t = [0];
    let tt = 0;
    for (let k = 0; k < 2400 && p.x < x1; k += 1) {
      const w1 = velDisplay(p.x, p.y, alphaRad);
      if (!w1) break;
      const s1 = Math.hypot(w1.u, w1.v) || 1e-6;
      const mid = { x: p.x + (0.5 * ds * w1.u) / s1, y: p.y + (0.5 * ds * w1.v) / s1 };
      let w2 = velDisplay(mid.x, mid.y, alphaRad);
      if (!w2) w2 = w1;
      const s2 = Math.hypot(w2.u, w2.v) || 1e-6;
      let next = { x: p.x + (ds * w2.u) / s2, y: p.y + (ds * w2.v) / s2 };
      if (!velDisplay(next.x, next.y, alphaRad)) {
        // pushed against the wing: slide along it
        next = { x: p.x + ds, y: p.y + (y0 > 0 ? ds : -ds) * 0.5 };
      }
      tt += ds / Math.max(0.12, s2);
      p = next;
      pts.push({ ...p });
      t.push(tt);
    }
    lines.push({ pts, t, y0 });
  }
  return lines;
}

/** Cp = 1 − v²/U² on a cols × rows grid covering the display box (null inside the wing). */
export function pressureGrid(alphaRad, box, cols, rows) {
  const out = new Array(cols * rows);
  for (let j = 0; j < rows; j += 1) {
    const Y = box.y1 - ((j + 0.5) / rows) * (box.y1 - box.y0);
    for (let i = 0; i < cols; i += 1) {
      const X = box.x0 + ((i + 0.5) / cols) * (box.x1 - box.x0);
      const s = speedAtDisplay(X, Y, alphaRad);
      out[j * cols + i] = s === null ? null : 1 - s * s;
    }
  }
  return out;
}

/** Chord length in airfoil units (independent of α). */
export const CHORD_UNITS = wingSurface(0).chord;
