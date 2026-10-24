import { useState } from 'react';
import { Gauge, Timer, TrendingDown, TrendingUp, Undo2 } from 'lucide-react';
import { Arrow, clamp, fmt, niceStep, useElementSize, useRafLoop } from '../kit/ui';
import { PALETTE } from '../kit/scene';

/**
 * Shared pieces of the "graphs of uniformly accelerated motion" simulators:
 * the motion maths, the light scene frame with its legend, a horizontal
 * track with the moving cart, and a graph frame drawn on the lab paper.
 */

export const C = PALETTE;

/**
 * Ready-made motions. "example" is the lesson's worked example: the v–t line
 * starts at 0 and reaches 12 m/s after 6 s, so a = 12/6 = 2 m/s² and the
 * area under it is (6 · 12)/2 = 36 m.
 */
export const PRESETS = [
  { id: 'example', v0: 0, a: 2, T: 6, icon: TrendingUp },
  { id: 'start', v0: 4, a: 1.5, T: 6, icon: Gauge },
  { id: 'brake', v0: 12, a: -2, T: 6, icon: TrendingDown },
  { id: 'back', v0: 6, a: -2, T: 6, icon: Undo2 },
];

/** Real-time playback of one run of length `dur` seconds, with scrubbing. */
export function usePlayback(dur) {
  const [sim, setSim] = useState({ t: 0, running: false });
  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = p.t + dt;
      return t >= dur ? { t: dur, running: false } : { t, running: true };
    });
  });
  const t = Math.min(sim.t, dur);
  const done = t >= dur - 1e-9;
  return {
    t,
    running: sim.running,
    done,
    toggle: () =>
      setSim((p) => {
        if (p.running) return { ...p, running: false };
        const cur = Math.min(p.t, dur);
        return { t: cur >= dur - 1e-9 ? 0 : cur, running: true };
      }),
    reset: () => setSim({ t: 0, running: false }),
    scrub: (x) => setSim({ t: clamp(x, 0, dur), running: false }),
  };
}

/* ------------------------------------------------------------------ maths */

/** x(t) and v(t) of uniformly accelerated motion that starts at x = 0. */
export function motionAt(v0, a, t) {
  return { x: v0 * t + 0.5 * a * t * t, v: v0 + a * t };
}

/** Smallest and largest x over 0 ≤ t ≤ T (the turning point counts). */
export function xExtent(v0, a, T) {
  const xs = [0, motionAt(v0, a, T).x];
  if (Math.abs(a) > 1e-9) {
    const tv = -v0 / a;
    if (tv > 0 && tv < T) xs.push(motionAt(v0, a, tv).x);
  }
  return [Math.min(...xs), Math.max(...xs)];
}

/** Areas under v(t) on [0, t]: above the axis (pos ≥ 0), below it (neg ≤ 0), and where v crosses 0. */
export function areaParts(v0, a, t) {
  const cuts = [0];
  let tc = null;
  if (Math.abs(a) > 1e-9) {
    const c = -v0 / a;
    if (c > 1e-9 && c < t - 1e-9) {
      cuts.push(c);
      tc = c;
    }
  }
  cuts.push(t);
  let pos = 0;
  let neg = 0;
  for (let i = 0; i < cuts.length - 1; i += 1) {
    const s = motionAt(v0, a, cuts[i + 1]).x - motionAt(v0, a, cuts[i]).x;
    if (s >= 0) pos += s;
    else neg += s;
  }
  return { pos, neg, tc };
}

/** An axis from `lo` to `hi` with a "nice" step at least `minPx` apart over `px` pixels. */
export function axisRange(lo, hi, px, minPx) {
  let a = lo;
  let b = hi;
  if (b - a < 1e-6) b = a + 1;
  let step = niceStep(px / (b - a), minPx);
  a = Math.floor(a / step + 1e-9) * step;
  b = Math.ceil(b / step - 1e-9) * step;
  if (b - a < step) b = a + step;
  step = niceStep(px / (b - a), minPx);
  a = Math.floor(lo / step + 1e-9) * step;
  b = Math.max(a + step, Math.ceil(hi / step - 1e-9) * step);
  return { min: a, max: b, step };
}

/** Maps graph values into the pixel rectangle `r` = { x, y, w, h }. */
export function makePlot(r, xr, yr) {
  return {
    ...r,
    xr,
    yr,
    gx: (v) => r.x + ((v - xr.min) / (xr.max - xr.min)) * r.w,
    gy: (v) => r.y + r.h - ((v - yr.min) / (yr.max - yr.min)) * r.h,
    vx: (px) => xr.min + ((px - r.x) / r.w) * (xr.max - xr.min),
  };
}

/** A number for a worked formula: few decimals, a real minus sign, brackets when negative. */
export function num(n, decimal = '.', brackets = false) {
  const r = Math.round(n * 100) / 100;
  const digits = Math.abs(r - Math.round(r)) < 1e-9 ? 0 : Math.abs(r * 10 - Math.round(r * 10)) < 1e-9 ? 1 : 2;
  const s = fmt(r, digits, decimal).replace('-', '−');
  return brackets && s.startsWith('−') ? `(${s})` : s;
}

/** Centroid of a polygon given as [[x, y], ...] (pixels). */
export function centroid(pts) {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-6) {
    const n = pts.length || 1;
    return { x: pts.reduce((s, p) => s + p[0], 0) / n, y: pts.reduce((s, p) => s + p[1], 0) / n, area: 0 };
  }
  return { x: cx / (3 * a), y: cy / (3 * a), area: Math.abs(a / 2) };
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
  if (kind === 'dot') return <span className="h-2.5 w-2.5 rounded-full border-2 bg-white" style={{ borderColor: color }} aria-hidden="true" />;
  if (kind === 'area')
    return <span className="h-3 w-4 rounded-[3px] border" style={{ background: `${color}33`, borderColor: `${color}99` }} aria-hidden="true" />;
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
 * The light lab-paper panel: legend chips on top (below the drawing on
 * phones), a chip on the right, and `children(W, H, narrow)` drawn into an
 * SVG that is exactly as wide as the panel. `height` may be a function of W.
 */
export function LabScene({ legend = [], chip, height, ariaLabel, children, footer }) {
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 260);
  const narrow = W < 560;
  const H = Math.round(typeof height === 'function' ? height(W, narrow) : height);
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-300/70 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_30px_-12px_rgba(0,0,0,0.6)]">
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
      {footer}
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

/* ------------------------------------------------------------- the track */

function Cart({ cx, roadY, dir, narrow }) {
  const w = narrow ? 30 : 36;
  const h = narrow ? 14 : 16;
  const r = narrow ? 3.6 : 4.2;
  const top = roadY - r * 2 - h + 2;
  const front = dir >= 0 ? cx + w / 2 - 9 : cx - w / 2 + 3;
  return (
    <g>
      <rect x={cx - w / 2} y={top} width={w} height={h} rx={5} fill={C.ink} />
      <rect x={front} y={top + 3} width={6} height={h - 8} rx={1.5} fill="#7dd3fc" />
      <rect x={cx - w / 2 + 2} y={top + h - 5} width={w - 4} height={2} fill="#22d3ee" opacity="0.8" />
      {[-1, 1].map((s) => (
        <g key={s}>
          <circle cx={cx + s * (w / 2 - 7)} cy={roadY - r} r={r} fill="#334155" stroke="#0f172a" strokeWidth="1" />
          <circle cx={cx + s * (w / 2 - 7)} cy={roadY - r} r={r * 0.38} fill="#e2e8f0" />
        </g>
      ))}
    </g>
  );
}

/**
 * A straight road seen from the side, with an x axis in metres, the cart at
 * `x`, its velocity (green) and acceleration (orange) arrows, and a dot where
 * it was at every whole second (`marks` = [{ k, x }]).
 */
export function Track({ rect, xr, x, v, a, marks = [], narrow, kv, ka, labels, decimal = '.', W }) {
  const fs = narrow ? 11 : 12;
  const gx = (m) => rect.x + ((m - xr.min) / (xr.max - xr.min)) * rect.w;
  const roadY = rect.y + rect.h - 26;
  const cx = gx(x);
  const ticks = [];
  for (let m = xr.min, i = 0; m <= xr.max + 1e-9 && i < 200; m += xr.step, i += 1) {
    const px = gx(m);
    const zero = Math.abs(m) < 1e-9;
    ticks.push(<line key={`t${i}`} x1={px} x2={px} y1={roadY + 8} y2={roadY + 14} stroke={zero ? C.ink : '#94a3b8'} strokeWidth={zero ? 1.6 : 1} />);
    if (px < W - 44)
      ticks.push(
        <text key={`l${i}`} x={px} y={roadY + 26} textAnchor="middle" fontSize={fs - 1} fill={zero ? C.ink : C.muted} fontWeight={zero ? 700 : 400}>
          {fmt(m, Number.isInteger(Math.round(m * 1000) / 1000) ? 0 : 1, decimal).replace('-', '−')}
        </text>,
      );
  }
  // second labels: stacked in up to three rows when the body passes the same place again
  const placed = [];
  const markLabels = marks.map((m) => {
    const px = gx(m.x);
    if (Math.abs(px - cx) < 24) return null;
    for (let level = 0; level < 3; level += 1) {
      if (!placed.some((q) => q.level === level && Math.abs(q.px - px) < (narrow ? 22 : 26))) {
        placed.push({ px, level });
        return level;
      }
    }
    return null;
  });
  const vLen = v * kv;
  const aLen = a * ka;
  const vy = roadY - (narrow ? 34 : 38);
  const ay = roadY - (narrow ? 52 : 60);
  return (
    <g>
      <rect x={rect.x - 16} y={roadY} width={rect.w + 32} height={8} rx={2} fill="#e2e8f0" />
      <line x1={rect.x - 16} x2={rect.x + rect.w + 16} y1={roadY} y2={roadY} stroke="#94a3b8" strokeWidth="1.5" />
      <line x1={gx(0)} x2={gx(0)} y1={roadY - 2} y2={roadY + 8} stroke={C.ink} strokeWidth="2" />
      {ticks}
      <text x={W - 8} y={roadY + 26} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill="#475569">
        {labels.axis}
      </text>
      {marks.map((m, i) => (
        <g key={m.k}>
          <circle cx={gx(m.x)} cy={roadY + 4} r={narrow ? 2.6 : 3.2} fill="#fff" stroke={C.ink} strokeWidth="1.6" />
          {markLabels[i] !== null && (
            <text x={gx(m.x)} y={roadY - 5 - markLabels[i] * 11} textAnchor="middle" fontSize={fs - 2} fill={C.muted}>
              {labels.mark(m.k)}
            </text>
          )}
        </g>
      ))}
      <Cart cx={cx} roadY={roadY} dir={v} narrow={narrow} />
      {Math.abs(vLen) > 5 && (
        <>
          <Arrow x1={cx} y1={vy} x2={cx + vLen} y2={vy} color={C.vel} width={3} head={10} />
          <text
            x={cx + vLen + Math.sign(vLen) * 10}
            y={vy + 4}
            textAnchor="middle"
            fontSize={fs + 1}
            fontStyle="italic"
            fontWeight="700"
            fill={C.vel}
            stroke="#fff"
            strokeWidth="3"
            paintOrder="stroke"
          >
            v
          </text>
        </>
      )}
      {Math.abs(aLen) > 5 && (
        <>
          <Arrow x1={cx} y1={ay} x2={cx + aLen} y2={ay} color={C.acc} width={3} head={10} />
          <text
            x={cx + aLen + Math.sign(aLen) * 10}
            y={ay + 4}
            textAnchor="middle"
            fontSize={fs + 1}
            fontStyle="italic"
            fontWeight="700"
            fill={C.acc}
            stroke="#fff"
            strokeWidth="3"
            paintOrder="stroke"
          >
            a
          </text>
        </>
      )}
    </g>
  );
}

/**
 * The x range of the track: the run from `lo` to `hi` metres plus room at the
 * ends for the arrows (longest forward arrow `fwdPx`, backward `backPx`).
 */
export function trackRange(lo, hi, fwdPx, backPx, px, minPx) {
  let a = lo;
  let b = Math.max(hi, lo + 8);
  for (let i = 0; i < 3; i += 1) {
    const k = px / (b - a);
    b = Math.max(hi, lo + 8) + (fwdPx > 0 ? (fwdPx + 24) / k : 0);
    a = lo - (backPx > 0 ? (backPx + 24) / k : 0);
  }
  return axisRange(a, b, px, minPx);
}

/** Picks a scale for the velocity arrow so the largest speed of the run fits. */
export function arrowScale(vAbsMax, narrow) {
  return clamp((narrow ? 64 : 96) / Math.max(vAbsMax, 1), 1.5, narrow ? 7 : 9);
}

/* -------------------------------------------------------------- the graph */

/** Grid, axes, tick numbers and unit labels of a graph on the lab paper. */
export function PlotGrid({ plot, xLabel, yLabel, narrow, decimal = '.' }) {
  const fs = narrow ? 11 : 12;
  const { xr, yr, gx, gy } = plot;
  const els = [];
  const digits = (s) => (Math.abs(s - Math.round(s)) < 1e-6 ? 0 : Math.abs(s * 10 - Math.round(s * 10)) < 1e-6 ? 1 : 2);
  for (let v = xr.min, i = 0; v <= xr.max + 1e-9 && i < 200; v += xr.step, i += 1) {
    const px = gx(v);
    els.push(<line key={`gx${i}`} x1={px} x2={px} y1={plot.y} y2={plot.y + plot.h} stroke={C.grid} strokeWidth="1" />);
    els.push(
      <text key={`lx${i}`} x={px} y={plot.y + plot.h + 16} textAnchor="middle" fontSize={fs - 1} fill={Math.abs(v) < 1e-9 ? C.ink : C.muted}>
        {fmt(v, digits(xr.step), decimal)}
      </text>,
    );
  }
  for (let v = yr.min, i = 0; v <= yr.max + 1e-9 && i < 200; v += yr.step, i += 1) {
    const py = gy(v);
    els.push(<line key={`gy${i}`} x1={plot.x} x2={plot.x + plot.w} y1={py} y2={py} stroke={C.grid} strokeWidth="1" />);
    els.push(
      <text key={`ly${i}`} x={plot.x - 7} y={py + 4} textAnchor="end" fontSize={fs - 1} fill={Math.abs(v) < 1e-9 ? C.ink : C.muted} fontWeight={Math.abs(v) < 1e-9 ? 700 : 400}>
        {fmt(v, digits(yr.step), decimal).replace('-', '−')}
      </text>,
    );
  }
  const y0 = gy(clamp(0, yr.min, yr.max));
  return (
    <g aria-hidden="true">
      <rect x={plot.x} y={plot.y} width={plot.w} height={plot.h} fill="#fff" />
      {els}
      <rect x={plot.x} y={plot.y} width={plot.w} height={plot.h} fill="none" stroke="#cbd5e1" />
      <line x1={plot.x} x2={plot.x + plot.w + 10} y1={y0} y2={y0} stroke="#475569" strokeWidth="1.5" />
      <path d={`M${plot.x + plot.w + 16},${y0} L${plot.x + plot.w + 8},${y0 - 4} L${plot.x + plot.w + 8},${y0 + 4} Z`} fill="#475569" />
      <line x1={plot.x} x2={plot.x} y1={plot.y + plot.h} y2={plot.y - 10} stroke="#475569" strokeWidth="1.5" />
      <path d={`M${plot.x},${plot.y - 16} L${plot.x - 4},${plot.y - 8} L${plot.x + 4},${plot.y - 8} Z`} fill="#475569" />
      <text x={plot.x + plot.w + 19} y={y0 + 4} fontSize={fs - 1} fontWeight="700" fill="#475569">
        {xLabel}
      </text>
      <text x={plot.x + 10} y={plot.y - 6} fontSize={fs} fontWeight="700" fill="#475569">
        {yLabel}
      </text>
    </g>
  );
}

/**
 * A transparent layer over a graph: press and drag along it to pick a time.
 * Vertical swipes still scroll the page on touch screens.
 */
export function ScrubArea({ plot, W, tMax, onScrub, label }) {
  const pick = (e) => {
    const svg = e.currentTarget.ownerSVGElement;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / Math.max(r.width, 1)) * W;
    onScrub(clamp(plot.vx(px), 0, tMax));
  };
  return (
    <rect
      x={plot.x}
      y={plot.y - 10}
      width={plot.w}
      height={plot.h + 20}
      fill="transparent"
      style={{ cursor: 'ew-resize', touchAction: 'pan-y' }}
      aria-label={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        pick(e);
      }}
      onPointerMove={(e) => {
        if (e.buttons) pick(e);
      }}
    />
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
