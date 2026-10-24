/**
 * Geometry for the transmission simulators, in world units (metres, y up).
 *
 * beltLoop(c1, r1, c2, r2, crossed) - the closed loop of a belt or chain
 *   round two wheels, walked in the direction it moves when wheel 1 turns
 *   clockwise. An open belt turns wheel 2 the same way; a crossed belt the
 *   other way. Both runs are tangent to both wheels.
 * gearOutline(r, z, add, ded) - a gear (or sprocket) outline round (0, 0)
 *   in screen pixels (y down), tooth 0 pointing along +x.
 */

export const TAU = Math.PI * 2;

const SCALES = [1, 0.5, 0.25, 0.2, 0.1, 0.05];

/** The largest of 1, 0.5, 0.25 … that keeps the fastest wheel at or under `limit` turns per second on screen. */
export function slowScale(maxNu, limit = 1.25) {
  for (const s of SCALES) if (maxNu * s <= limit + 1e-9) return s;
  return SCALES[SCALES.length - 1];
}

const rot = (p, c, s) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c });
const polar = (r, a) => ({ x: r * Math.cos(a), y: r * Math.sin(a) });

export function beltLoop(c1, r1, c2, r2, crossed = false) {
  const dx = c2.x - c1.x;
  const dy = c2.y - c1.y;
  const d = Math.hypot(dx, dy);
  const cb = dx / d;
  const sb = dy / d;
  const toWorld = (p) => {
    const q = rot(p, cb, sb);
    return { x: q.x + c1.x, y: q.y + c1.y };
  };
  const C2 = { x: d, y: 0 };
  const segs = [];
  if (!crossed) {
    const th = Math.acos(Math.max(-1, Math.min(1, (r1 - r2) / d)));
    const p1u = polar(r1, th);
    const p2u = { x: d + r2 * Math.cos(th), y: r2 * Math.sin(th) };
    const p2l = { x: d + r2 * Math.cos(-th), y: r2 * Math.sin(-th) };
    const p1l = polar(r1, -th);
    segs.push({ kind: 'line', a: p1u, b: p2u });
    segs.push({ kind: 'arc', c: C2, r: r2, a0: th, sweep: -2 * th });
    segs.push({ kind: 'line', a: p2l, b: p1l });
    segs.push({ kind: 'arc', c: { x: 0, y: 0 }, r: r1, a0: -th, sweep: -(TAU - 2 * th) });
  } else {
    const th = Math.acos(Math.max(-1, Math.min(1, (r1 + r2) / d)));
    const p1u = polar(r1, th);
    const p2x = { x: d - r2 * Math.cos(th), y: -r2 * Math.sin(th) };
    const p2y = { x: d - r2 * Math.cos(th), y: r2 * Math.sin(th) };
    const p1l = polar(r1, -th);
    segs.push({ kind: 'line', a: p1u, b: p2x });
    segs.push({ kind: 'arc', c: C2, r: r2, a0: Math.PI + th, sweep: TAU - 2 * th });
    segs.push({ kind: 'line', a: p2y, b: p1l });
    segs.push({ kind: 'arc', c: { x: 0, y: 0 }, r: r1, a0: -th, sweep: -(TAU - 2 * th) });
  }
  for (const s of segs) s.len = s.kind === 'line' ? Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y) : Math.abs(s.sweep) * s.r;
  const length = segs.reduce((acc, s) => acc + s.len, 0);

  /** Point and unit direction of motion at distance s along the loop. */
  const at = (sIn) => {
    let s = ((sIn % length) + length) % length;
    for (const g of segs) {
      if (s <= g.len || g === segs[segs.length - 1]) {
        const f = g.len > 0 ? Math.min(1, s / g.len) : 0;
        let p;
        let t;
        if (g.kind === 'line') {
          p = { x: g.a.x + (g.b.x - g.a.x) * f, y: g.a.y + (g.b.y - g.a.y) * f };
          t = { x: (g.b.x - g.a.x) / g.len, y: (g.b.y - g.a.y) / g.len };
        } else {
          const a = g.a0 + g.sweep * f;
          const sg = Math.sign(g.sweep);
          p = { x: g.c.x + g.r * Math.cos(a), y: g.c.y + g.r * Math.sin(a) };
          t = { x: -Math.sin(a) * sg, y: Math.cos(a) * sg };
        }
        return { ...toWorld(p), tx: t.x * cb - t.y * sb, ty: t.x * sb + t.y * cb };
      }
      s -= g.len;
    }
    return { ...toWorld(segs[0].a), tx: 1, ty: 0 };
  };

  /** The two straight runs in world coordinates (for labels and arrows). */
  const runs = segs.filter((g) => g.kind === 'line').map((g) => ({ a: toWorld(g.a), b: toWorld(g.b) }));
  return { length, at, runs };
}

/**
 * Gear outline in screen px round (0, 0): z teeth on a pitch radius r (px),
 * teeth reaching `add` px beyond it and roots `ded` px inside it.
 */
export function gearOutline(r, z, add, ded) {
  const rt = r + add;
  const rr = Math.max(r * 0.35, r - ded);
  const p = TAU / z;
  const pts = [];
  for (let k = 0; k < z; k += 1) {
    const th = k * p;
    const seq = [
      [rr, th - 0.5 * p],
      [rr, th - 0.27 * p],
      [rt, th - 0.13 * p],
      [rt, th + 0.13 * p],
      [rr, th + 0.27 * p],
    ];
    for (const [rad, a] of seq) pts.push(`${(rad * Math.cos(a)).toFixed(2)},${(-rad * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
}
