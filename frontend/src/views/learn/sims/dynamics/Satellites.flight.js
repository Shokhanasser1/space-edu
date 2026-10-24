import { GM, R_E, R_KM, TAU, niceCeil, niceFactor } from './Satellites.consts';

/**
 * Newton's cannon: a body fired horizontally from the top of a very high
 * (imagined) mountain, with no air, so that the Earth's gravity
 * a = −GM·r/r³ is the only thing acting on it.
 *
 * The summit height is chosen so that the circular speed there is exactly
 * 7.9 km/s: r₀ = GM/v₁² = 6 386.8 km, i.e. h ≈ 15.8 km above R = 6371 km.
 * Then v₂ = √2·v₁ = 11.17 km/s, so the slider's 11.2 km/s escapes.
 *
 * The flight is integrated once, when the shot is fired (fourth-order
 * Runge-Kutta, a step that grows as r^1.5 so every part of an orbit gets the
 * same number of steps), and the animation then just reads the samples by
 * time. Coordinates in metres, Earth's centre at the origin, y up; the body
 * starts at the top of the Earth moving to the right (clockwise).
 */

export const V1 = 7900;
export const R0 = GM / (V1 * V1);
export const H0 = R0 - R_E;
export const V2 = Math.SQRT2 * V1;
/** Beyond this distance from the centre the flight is not followed any more. */
export const CAP = 10 * R_E;

function accel(x, y) {
  const r2 = x * x + y * y;
  const k = -GM / (r2 * Math.sqrt(r2));
  return [k * x, k * y];
}

/** What the shot will do, worked out from the energy (vis-viva) — used for the words. */
export function classify(v0) {
  const eps = (v0 * v0) / 2 - GM / R0;
  if (eps >= 0) return { kind: 'escape', apo: Infinity, period: Infinity };
  const a = -GM / (2 * eps);
  const period = TAU * Math.sqrt((a * a * a) / GM);
  if (Math.abs(v0 - V1) < 0.5) return { kind: 'circle', apo: R0, period };
  if (v0 < V1) {
    const peri = 2 * a - R0;
    return peri < R_E ? { kind: 'land', apo: R0, period } : { kind: 'ellipse', apo: R0, period };
  }
  const apo = 2 * a - R0;
  return { kind: apo > CAP ? 'away' : 'ellipse', apo, period };
}

/**
 * Integrates one shot fired at v0 (m/s). Returns the samples
 * [{ t, x, y, vx, vy }], how it ended and what the scene and graph need.
 */
export function flight(v0) {
  let x = 0;
  let y = R0;
  let vx = v0;
  let vy = 0;
  let t = 0;
  let swept = 0;
  let prevAng = Math.PI / 2;
  const pts = [{ t, x, y, vx, vy }];
  let last = pts[0];
  let lastAng = prevAng;
  let end = null;
  let ended = 'away';
  for (let i = 0; i < 600000; i += 1) {
    const r = Math.hypot(x, y);
    const dt = Math.min(500, 0.5 * (r / R_E) ** 1.5);
    const [ax1, ay1] = accel(x, y);
    const x2 = x + (vx * dt) / 2;
    const y2 = y + (vy * dt) / 2;
    const vx2 = vx + (ax1 * dt) / 2;
    const vy2 = vy + (ay1 * dt) / 2;
    const [ax2, ay2] = accel(x2, y2);
    const x3 = x + (vx2 * dt) / 2;
    const y3 = y + (vy2 * dt) / 2;
    const vx3 = vx + (ax2 * dt) / 2;
    const vy3 = vy + (ay2 * dt) / 2;
    const [ax3, ay3] = accel(x3, y3);
    const x4 = x + vx3 * dt;
    const y4 = y + vy3 * dt;
    const vx4 = vx + ax3 * dt;
    const vy4 = vy + ay3 * dt;
    const [ax4, ay4] = accel(x4, y4);
    const nx = x + (dt / 6) * (vx + 2 * vx2 + 2 * vx3 + vx4);
    const ny = y + (dt / 6) * (vy + 2 * vy2 + 2 * vy3 + vy4);
    const nvx = vx + (dt / 6) * (ax1 + 2 * ax2 + 2 * ax3 + ax4);
    const nvy = vy + (dt / 6) * (ay1 + 2 * ay2 + 2 * ay3 + ay4);
    const nr = Math.hypot(nx, ny);
    const ang = Math.atan2(ny, nx);
    let d = ang - prevAng;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;

    // one of three endings, found between this step and the next by linear interpolation
    let f = null;
    if (nr <= R_E) {
      f = (r - R_E) / (r - nr);
      ended = 'land';
    } else if (Math.abs(swept + d) >= TAU) {
      f = (TAU - Math.abs(swept)) / Math.abs(d);
      ended = 'orbit';
    } else if (nr >= CAP) {
      f = (CAP - r) / (nr - r);
      ended = 'away';
    }
    if (f !== null) {
      end = {
        t: t + f * dt,
        x: x + f * (nx - x),
        y: y + f * (ny - y),
        vx: vx + f * (nvx - vx),
        vy: vy + f * (nvy - vy),
      };
      swept += f * d;
      if (ended === 'orbit') {
        end.x = 0;
        end.y = pts[0].y;
      }
      break;
    }

    x = nx;
    y = ny;
    vx = nvx;
    vy = nvy;
    t += dt;
    swept += d;
    prevAng = ang;

    // keep a sample when the body has turned or climbed/dropped noticeably
    const lr = Math.hypot(last.x, last.y);
    let da = Math.abs(ang - lastAng);
    if (da > Math.PI) da = TAU - da;
    const altNow = nr - R_E;
    if (da > 0.004 || Math.abs(nr - lr) > 0.02 * altNow + 120) {
      last = { t, x, y, vx, vy };
      lastAng = ang;
      pts.push(last);
    }
  }
  if (!end) end = { t, x, y, vx, vy };
  pts.push(end);

  const info = classify(v0);
  const closed = ended === 'orbit';
  const durationS = end.t;

  // the part of space the scene should show (km), always with the whole Earth
  let x0 = -1.12 * R_KM;
  let x1 = 1.12 * R_KM;
  let y0 = -1.08 * R_KM;
  let y1 = 1.18 * R_KM;
  let maxAlt = 0;
  for (const p of pts) {
    const xk = p.x / 1000;
    const yk = p.y / 1000;
    if (xk < x0) x0 = xk;
    if (xk > x1) x1 = xk;
    if (yk < y0) y0 = yk;
    if (yk > y1) y1 = yk;
    const alt = Math.hypot(p.x, p.y) - R_E;
    if (alt > maxAlt) maxAlt = alt;
  }
  const mx = (x1 - x0) * 0.06;
  const my = (y1 - y0) * 0.06;
  const box = { x0: x0 - mx, x1: x1 + mx, y0: y0 - my, y1: y1 + my };

  // screen time: a fall in ~3.5 s, an orbit or a long flight in ~8 s
  const scale = niceFactor(durationS / (ended === 'land' ? 3.5 : 8));

  // the h(t) graph: time unit and thinned samples
  const unit = durationS < 600 ? 's' : durationS < 3 * 3600 ? 'min' : 'h';
  const div = unit === 's' ? 1 : unit === 'min' ? 60 : 3600;
  const every = Math.max(1, Math.ceil(pts.length / 400));
  const graph = [];
  for (let i = 0; i < pts.length; i += every) graph.push({ x: pts[i].t / div, y: (Math.hypot(pts[i].x, pts[i].y) - R_E) / 1000 });
  graph.push({ x: end.t / div, y: (Math.hypot(end.x, end.y) - R_E) / 1000 });

  return {
    v0,
    pts,
    ended,
    closed,
    duration: durationS,
    landArc: R_E * Math.abs(swept),
    kind: info.kind,
    apo: info.apo,
    period: info.period,
    box,
    scale,
    graph: { unit, div, pts: graph, xMax: durationS / div, yMax: niceCeil(Math.max(maxAlt / 1000, 1)) },
  };
}

/** The body's state at time t (s) of a shot, by interpolating the samples. */
export function stateAt(shot, t) {
  const pts = shot.pts;
  if (t <= 0) return { ...pts[0], i: 0 };
  const lastP = pts[pts.length - 1];
  if (t >= lastP.t) return { ...lastP, i: pts.length - 1 };
  let lo = 0;
  let hi = pts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = pts[lo];
  const b = pts[hi];
  const u = (t - a.t) / (b.t - a.t || 1);
  return {
    i: lo,
    t,
    x: a.x + (b.x - a.x) * u,
    y: a.y + (b.y - a.y) * u,
    vx: a.vx + (b.vx - a.vx) * u,
    vy: a.vy + (b.vy - a.vy) * u,
  };
}
