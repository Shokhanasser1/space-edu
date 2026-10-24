import { Timer } from 'lucide-react';
import { Arrow, fmt, niceStep, useElementSize } from '../kit/ui';
import { PALETTE } from '../kit/scene';

/**
 * Shared pieces of the "thrown at an angle" simulators: the physics of a body
 * launched from the ground with no air resistance, the light lab-paper frame,
 * the field (metre grid above a hatched ground line, axis numbers), the
 * launcher, and a small dark graph frame for the panels under the scene.
 */

/* --------------------------------------------------------------- physics */

export const G = 9.8; // m/s²
export const DEG = Math.PI / 180;

/**
 * Everything about one throw from the ground at speed v0 (m/s) and angle
 * aDeg (degrees): v₀ₓ = v₀cosα, v₀ᵧ = v₀sinα, T = 2v₀sinα/g,
 * H = v₀²sin²α/(2g), L = v₀²sin2α/g, the top is reached at T/2.
 */
export function flight(v0, aDeg) {
  const a = aDeg * DEG;
  const vx = v0 * Math.cos(a);
  const vy = v0 * Math.sin(a);
  return {
    v0,
    alpha: aDeg,
    vx,
    vy,
    T: (2 * vy) / G,
    tTop: vy / G,
    H: (vy * vy) / (2 * G),
    L: (v0 * v0 * Math.sin(2 * a)) / G,
  };
}

/** x = v₀cosα·t, y = v₀sinα·t − gt²/2 */
export const posAt = (f, t) => ({ x: f.vx * t, y: f.vy * t - (G * t * t) / 2 });
/** vₓ stays v₀cosα, vᵧ = v₀sinα − gt */
export const velAt = (f, t) => ({ vx: f.vx, vy: f.vy - G * t });

/**
 * Drag coefficient k = ρ·C·A / (2m) of a football (m = 0.43 kg, d = 22 cm,
 * C ≈ 0.25, air ρ = 1.2 kg/m³) — about 0.013 1/m. With it a = −g − k|v|v.
 */
export const K_FOOTBALL = (0.5 * 1.2 * 0.25 * Math.PI * 0.11 * 0.11) / 0.43;

/** The same throw in air (quadratic drag k), integrated numerically; points every ~0.02 s. */
export function dragFlight(v0, aDeg, k = K_FOOTBALL) {
  const dt = 0.002;
  let x = 0;
  let y = 0;
  let vx = v0 * Math.cos(aDeg * DEG);
  let vy = v0 * Math.sin(aDeg * DEG);
  let t = 0;
  let H = 0;
  const pts = [{ x: 0, y: 0 }];
  for (let i = 0; i < 20000; i += 1) {
    const v = Math.hypot(vx, vy);
    const vxm = vx + (-k * v * vx * dt) / 2;
    const vym = vy + ((-G - k * v * vy) * dt) / 2;
    const vm = Math.hypot(vxm, vym);
    const nx = x + vxm * dt;
    const ny = y + vym * dt;
    vx += -k * vm * vxm * dt;
    vy += (-G - k * vm * vym) * dt;
    t += dt;
    if (ny < 0 && t > 0.01) {
      const f = y / (y - ny);
      const L = x + (nx - x) * f;
      pts.push({ x: L, y: 0 });
      return { pts, L, H, T: t - dt + dt * f };
    }
    x = nx;
    y = ny;
    H = Math.max(H, y);
    if (i % 10 === 9) pts.push({ x, y });
  }
  return { pts, L: x, H, T: t };
}

/** A round axis top whose quarters are round numbers. */
export function niceTop(hi) {
  for (const m of [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10, 12.5, 15, 20, 25, 30, 40, 50]) if (m * 4 >= hi - 1e-9) return m * 4;
  return Math.ceil(hi / 100) * 100;
}

/** A round strobe interval that gives about 8–14 dots over a flight of T seconds. */
export function strobeStep(T) {
  for (const s of [0.05, 0.1, 0.2, 0.25, 0.5, 1]) if (s >= T / 14) return s;
  return 1;
}

/** The next round number (1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8 × 10ⁿ) at or above v. */
export function niceCeil(v) {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v - 1e-9) return m * p;
  return 10 * p;
}

/** The width of the visible field, picked from round numbers so the scale does not jitter. */
export function fieldSpan(need) {
  for (const s of [10, 12, 15, 20, 25, 30, 40, 50, 60, 70, 80, 100, 120]) if (s >= need - 1e-9) return s;
  return Math.ceil(need / 20) * 20;
}

/* ---------------------------------------------------------------- colours */

export const C = {
  ...PALETTE,
  vx: '#0891b2', // horizontal component vₓ
  vxText: '#67e8f9',
  vy: '#65a30d', // vertical component vᵧ
  vyText: '#bef264',
  g: PALETTE.acc,
  air: '#b45309',
  airText: '#fcd34d',
  ground: '#334155',
  preview: '#94a3b8',
};

/* -------------------------------------------------------------- the view */

/**
 * World metres → SVG px with the origin (launch point) at the bottom left:
 * x = 0 sits `pad.l` from the left edge, the ground `pad.b` above the bottom.
 * The scale fits xMax across and yMax up, whichever is tighter; extra room
 * simply shows more field to the right.
 */
export function fieldView(W, H, xMax, yMax, pad) {
  const k = Math.max(0.0001, Math.min((W - pad.l - pad.r) / xMax, (H - pad.t - pad.b) / yMax));
  const gy = H - pad.b;
  return {
    k,
    sx: (x) => pad.l + x * k,
    sy: (y) => gy - y * k,
    wx: (px) => (px - pad.l) / k,
    wy: (py) => (gy - py) / k,
  };
}

/** A scene height that fits xMax × yMax at the width-limited scale, kept between lo and hi. */
export function fitHeight(W, xMax, yMax, pad, lo, hi) {
  const k = (W - pad.l - pad.r) / xMax;
  return Math.round(Math.min(hi, Math.max(lo, pad.t + pad.b + yMax * k)));
}

/* ----------------------------------------------------------- scene frame */

function LegendMark({ kind, color }) {
  if (kind === 'arrow')
    return (
      <svg width="18" height="8" aria-hidden="true">
        <line x1="1" y1="4" x2="12" y2="4" stroke={color} strokeWidth="2.5" />
        <path d="M17,4 L11,1 L11,7 Z" fill={color} />
      </svg>
    );
  if (kind === 'dash') return <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: color }} aria-hidden="true" />;
  if (kind === 'dot') return <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden="true" />;
  return <span className="h-1 w-4 rounded" style={{ background: color }} aria-hidden="true" />;
}

export function LegendList({ items, className = '' }) {
  return (
    <ul className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] sm:text-[12px] text-slate-600 ${className}`}>
      {items.map((l) => (
        <li key={l.label} className="flex items-center gap-1.5">
          <LegendMark kind={l.kind} color={l.color} />
          <span>{l.label}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The light lab-paper panel: legend on top (below the drawing on phones), a
 * chip on the right, and `children(W, H, narrow)` drawn into an SVG exactly
 * as wide as the panel. `height` may be a function of (W, narrow).
 */
export function LabScene({ legend = [], chip, height, ariaLabel, children, className = '', below }) {
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 260);
  const narrow = W < 560;
  const H = Math.round(typeof height === 'function' ? height(W, narrow) : height);
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-300/70 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_30px_-12px_rgba(0,0,0,0.6)] ${className}`}
    >
      <div ref={ref} className="cl-scene relative w-full">
        <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex items-start justify-between gap-2 sm:inset-x-3 sm:top-3">
          {!narrow && legend.length > 0 && (
            <LegendList items={legend} className="rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 shadow-sm backdrop-blur" />
          )}
          {chip && (
            <span className="ml-auto flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[11px] sm:text-[12px] font-medium tabular-nums text-slate-600 shadow-sm">
              {chip}
            </span>
          )}
        </div>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="block select-none">
          <rect width={W} height={H} fill="#fbfcfe" />
          {width > 0 && children(W, H, narrow)}
        </svg>
      </div>
      {narrow && legend.length > 0 && <LegendList items={legend} className="border-t border-slate-200 bg-slate-50 px-3 py-2" />}
      {below}
    </div>
  );
}

export function TimeChip({ text }) {
  return (
    <>
      <Timer size={14} className="text-cyan-600" aria-hidden="true" />
      <span>{text}</span>
    </>
  );
}

/** Text with a white halo, for labels drawn over lines on the paper. */
export function Label({ x, y, children, color = C.ink, size = 12, anchor = 'middle', weight = 700, italic }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={size}
      fontWeight={weight}
      fontStyle={italic ? 'italic' : undefined}
      fill={color}
      stroke="#fff"
      strokeWidth="3.5"
      strokeLinejoin="round"
      paintOrder="stroke"
    >
      {children}
    </text>
  );
}

/* ----------------------------------------------------------------- field */

/**
 * The metre grid above the ground, the ground line with hatching under it,
 * the y axis through the launch point and the axis numbers.
 */
export function Field({ view, W, H, narrow, xUnit, yUnit, dec, minPx, yUnitAt }) {
  const step = niceStep(view.k, minPx ?? (narrow ? 26 : 34));
  const gy = view.sy(0);
  const ox = view.sx(0);
  const top = 0;
  const vert = [];
  const horiz = [];
  for (let i = 0; view.sx(i * step) <= W; i += 1) vert.push(i * step);
  for (let j = 1; view.sy(j * step) >= top; j += 1) horiz.push(j * step);
  const fs = narrow ? 10 : 11;
  const every = Math.max(1, Math.ceil((narrow ? 30 : 38) / (step * view.k)));
  const digits = Number.isInteger(step) ? 0 : Number.isInteger(step * 10) ? 1 : 2;
  const hatch = [];
  for (let x = -10; x < W + 10; x += 9) hatch.push(<line key={x} x1={x} y1={gy + 9} x2={x + 9} y2={gy} stroke="#94a3b8" strokeWidth="1" />);
  return (
    <g aria-hidden="true">
      {vert.map((x) => (
        <line key={`v${x}`} x1={view.sx(x)} x2={view.sx(x)} y1={top} y2={gy} stroke={C.grid} strokeWidth="1" />
      ))}
      {horiz.map((y) => (
        <line key={`h${y}`} x1={ox} x2={W} y1={view.sy(y)} y2={view.sy(y)} stroke={C.grid} strokeWidth="1" />
      ))}
      <rect x={0} y={gy} width={W} height={H - gy} fill="#f8fafc" />
      <g>{hatch}</g>
      <line x1={0} x2={W} y1={gy} y2={gy} stroke={C.ground} strokeWidth="2" />
      <line x1={ox} x2={ox} y1={top + 4} y2={gy} stroke="#94a3b8" strokeWidth="1.2" />
      {vert
        .filter((x, i) => i % every === 0 && view.sx(x) < W - (narrow ? 26 : 34))
        .map((x) => (
          <text key={`nx${x}`} x={view.sx(x)} y={gy + (narrow ? 22 : 25)} textAnchor="middle" fontSize={fs} fill={x === 0 ? C.ink : C.muted} fontWeight={x === 0 ? 700 : 400}>
            {fmt(x, Number.isInteger(x) ? 0 : digits, dec)}
          </text>
        ))}
      {horiz
        .filter((y, j) => (j + 1) % every === 0 && view.sy(y) > (yUnitAt ?? (narrow ? 14 : 18)) + 8)
        .map((y) => (
          <text key={`ny${y}`} x={ox - 7} y={view.sy(y) + 4} textAnchor="end" fontSize={fs} fill={C.muted}>
            {fmt(y, Number.isInteger(y) ? 0 : digits, dec)}
          </text>
        ))}
      <text x={W - 8} y={gy + (narrow ? 22 : 25)} textAnchor="end" fontSize={fs} fontWeight="700" fill="#475569">
        {xUnit}
      </text>
      {yUnit && (
        <text x={ox + 6} y={yUnitAt ?? (narrow ? 14 : 18)} fontSize={fs} fontWeight="700" fill="#475569" stroke="#fbfcfe" strokeWidth="3" paintOrder="stroke">
          {yUnit}
        </text>
      )}
    </g>
  );
}

/**
 * The launcher at the origin: a half-disc base and a barrel tilted by alpha,
 * with an optional angle arc and its label.
 */
export function Launcher({ view, alpha, narrow, arcLabel, arc = true }) {
  const ox = view.sx(0);
  const oy = view.sy(0);
  const a = alpha * DEG;
  const len = narrow ? 24 : 32;
  const wid = narrow ? 8 : 10;
  const rb = narrow ? 9 : 12;
  const ux = Math.cos(a);
  const uy = -Math.sin(a);
  const nx = -uy;
  const ny = ux;
  const p = (s, w) => `${ox + ux * s + nx * w},${oy + uy * s + ny * w}`;
  const barrel = `M${p(-4, wid / 2)} L${p(len, wid / 2)} L${p(len, -wid / 2)} L${p(-4, -wid / 2)} Z`;
  const ra = narrow ? 34 : 46;
  const arcPath = `M${ox + ra},${oy} A${ra},${ra} 0 0 0 ${ox + ra * Math.cos(a)},${oy - ra * Math.sin(a)}`;
  const la = a / 2;
  const lr = ra + (narrow ? 14 : 18);
  return (
    <g>
      {arc && alpha > 3 && (
        <>
          <path d={arcPath} fill="none" stroke={C.ink} strokeWidth="1.3" />
          {arcLabel && (
            <Label x={ox + lr * Math.cos(la) + 6} y={oy - lr * Math.sin(la) + 4} size={narrow ? 11 : 12} anchor="start">
              {arcLabel}
            </Label>
          )}
        </>
      )}
      <path d={barrel} fill="#475569" stroke={C.ink} strokeWidth="1.5" strokeLinejoin="round" />
      <path d={`M${ox - rb},${oy} A${rb},${rb} 0 0 1 ${ox + rb},${oy} Z`} fill={C.ink} />
      <circle cx={ox} cy={oy - 2} r={2.2} fill="#cbd5e1" />
    </g>
  );
}

/** The ball. */
export function Ball({ x, y, r = 7, color = C.ink, pulse }) {
  return (
    <g>
      {pulse && <circle cx={x} cy={y} r={r + 6} fill={C.path} className="cl-pulse" />}
      <circle cx={x} cy={y} r={r} fill={color} stroke="#fff" strokeWidth="2" />
      <circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.3} fill="#fff" opacity="0.5" />
    </g>
  );
}

/** A labelled vector: arrow from (x, y) by (dx, dy) px with an italic name past its tip. */
export function Vec({ x, y, dx, dy, color, label, width = 3, head = 11, size = 13, dash, labelOffset = 12 }) {
  const len = Math.hypot(dx, dy);
  if (len < 3) return null;
  const ux = dx / len;
  const uy = dy / len;
  return (
    <g>
      <Arrow x1={x} y1={y} x2={x + dx} y2={y + dy} color={color} width={width} head={head} dash={dash} />
      {label && (
        <Label x={x + dx + ux * labelOffset} y={y + dy + uy * labelOffset + size * 0.35} color={color} size={size} italic>
          {label}
        </Label>
      )}
    </g>
  );
}

/** A small bar showing how long a velocity of `value` is drawn, e.g. "10 m/s". */
export function VelScale({ x, y, px, text, color = C.vel }) {
  return (
    <g aria-hidden="true">
      <line x1={x - px} x2={x} y1={y} y2={y} stroke={color} strokeWidth="3" strokeLinecap="round" />
      <line x1={x - px} x2={x - px} y1={y - 4} y2={y + 4} stroke={color} strokeWidth="1.5" />
      <line x1={x} x2={x} y1={y - 4} y2={y + 4} stroke={color} strokeWidth="1.5" />
      <text x={x - px / 2} y={y - 7} textAnchor="middle" fontSize="11" fontWeight="600" fill={color} stroke="#fbfcfe" strokeWidth="3" paintOrder="stroke">
        {text}
      </text>
    </g>
  );
}

/** Polyline points of the vacuum parabola from t0 to t1, in screen px. */
export function parabolaPts(view, f, t0, t1, n = 80) {
  const out = [];
  for (let i = 0; i <= n; i += 1) {
    const t = t0 + ((t1 - t0) * i) / n;
    const p = posAt(f, t);
    out.push(`${view.sx(p.x).toFixed(1)},${view.sy(Math.max(0, p.y)).toFixed(1)}`);
  }
  return out.join(' ');
}

/* ------------------------------------------------------------ dark graph */

/**
 * The frame of a graph for the dark panels: title, legend chips, grid with
 * tick numbers at quarters, axis labels, and `children(gx, gy, W, H, pad)`
 * drawing the curves. `onScrub(x)` lets the reader click or drag along it.
 */
export function DarkGraph({ title, legend = [], xMax, yMin = 0, yMax, xLabel, yLabel, xTicks, dec = '.', xDigits = 0, yDigits = 0, height = 200, ariaLabel, onScrub, note, children }) {
  const [ref, { width }] = useElementSize();
  const H = height;
  const pad = { l: 40, r: 14, t: 18, b: 26 };
  const W = Math.max(width, 220);
  const gx = (v) => pad.l + (v / xMax) * (W - pad.l - pad.r);
  const gy = (v) => H - pad.b - ((v - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
  const yT = [0, 0.25, 0.5, 0.75, 1].map((f) => yMin + f * (yMax - yMin));
  const xT = xTicks ?? [0, 0.25, 0.5, 0.75, 1].map((f) => f * xMax);
  const scrub = (e) => {
    if (!onScrub) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    onScrub(Math.min(xMax, Math.max(0, ((px - pad.l) / (W - pad.l - pad.r)) * xMax)));
  };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {title && <p className="text-sm font-semibold text-gray-200">{title}</p>}
        {legend.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-xs text-gray-400">
            {s.dash ? (
              <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: s.color }} />
            ) : (
              <span className="h-0.5 w-4 rounded" style={{ background: s.color }} />
            )}
            {s.label}
          </span>
        ))}
      </div>
      <div ref={ref} className="mt-2 w-full">
        <svg
          width="100%"
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={ariaLabel ?? title}
          className={`block overflow-visible ${onScrub ? 'cursor-ew-resize touch-none' : ''}`}
          onPointerDown={(e) => {
            if (!onScrub) return;
            e.currentTarget.setPointerCapture?.(e.pointerId);
            scrub(e);
          }}
          onPointerMove={(e) => {
            if (onScrub && e.buttons) scrub(e);
          }}
        >
          {yT.map((v) => (
            <g key={`y${v}`}>
              <line x1={pad.l} x2={W - pad.r} y1={gy(v)} y2={gy(v)} stroke={Math.abs(v) < 1e-9 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.08)'} />
              <text x={pad.l - 6} y={gy(v) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                {fmt(v, yDigits, dec)}
              </text>
            </g>
          ))}
          {xT.map((v) => (
            <text key={`x${v}`} x={gx(v)} y={H - 6} textAnchor="middle" fontSize="11" fill="#94a3b8">
              {fmt(v, xDigits, dec)}
            </text>
          ))}
          {xLabel && (
            <text x={W - pad.r} y={H - pad.b - 6} textAnchor="end" fontSize="11" fill="#64748b">
              {xLabel}
            </text>
          )}
          {yLabel && (
            <text x={pad.l + 6} y={pad.t - 6} fontSize="11" fill="#64748b">
              {yLabel}
            </text>
          )}
          <line x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.2)" />
          {width > 0 && children(gx, gy, W, H, pad)}
        </svg>
      </div>
      {note && <p className="mt-1 text-xs leading-snug text-gray-500">{note}</p>}
    </div>
  );
}

/** A dark-panel row "name … value" used in the formula lists. */
export function FormulaRow({ name, value, color = '#e2e8f0' }) {
  return (
    <div className="rounded-lg bg-black/25 px-3 py-1.5">
      <dt className="text-[13px] font-semibold text-gray-300">{name}</dt>
      <dd className="mt-0.5 text-right font-mono text-[13px] font-semibold tabular-nums" style={{ color }}>
        {value}
      </dd>
    </div>
  );
}
