import { Pause, Play, RotateCcw, Timer } from 'lucide-react';

import { Arrow, Btn, Pill, fmt, groupThousands, textWidth, useElementSize } from '../kit/ui';
import { PALETTE } from '../kit/scene';

/**
 * Drawing pieces shared by the tabs of the "Atmospheric pressure" lesson:
 * the scene shell of the chosen design (light lab paper, legend chips on top,
 * chips on the right, the legend under the scene on phones), Start/Pause/
 * Reset, arrows with a white halo, number helpers, the physical constants
 * and the one look per liquid. No words live here — every label arrives
 * through props from the lesson's TEXT table.
 */

export const G = 9.8; // m/s²
export const RHO_HG = 13600; // kg/m³
export const MMHG = (RHO_HG * G) / 1000; // Pa in 1 mm of mercury = 133.28 Pa
export const P0_MM = 760; // normal atmospheric pressure, mm Hg
export const P0 = P0_MM * MMHG; // ≈ 101 300 Pa
export const H_SCALE = 8000; // m, height scale of the isothermal model p = p₀·e^(−h/H)
export const RHO_AIR0 = 1.29; // kg/m³, air at 0 °C and normal pressure
export const HORSE = 1000; // N, assumed steady pull of one horse

/** Pressure at height h (m) in the stated model p = p₀·e^(−h/8000 m). */
export const pAt = (h, p0 = P0) => p0 * Math.exp(-h / H_SCALE);

/** One colour per quantity, the same in every tab, legend and tile. */
export const PC = {
  atm: '#0284c7', // atmospheric pressure (arrows on surfaces)
  atmText: '#7dd3fc',
  col: '#7c3aed', // pressure of the liquid column ρgh
  colText: '#c4b5fd',
  inside: '#9333ea', // air left inside a vessel
  insideText: '#d8b4fe',
  h: PALETTE.disp, // heights, lengths
  hText: PALETTE.dispText,
  F: PALETTE.force, // force of the air pressing the hemispheres together
  FText: '#fca5a5',
  T: '#d97706', // pull of the horses
  TText: '#fcd34d',
  air: '#38bdf8',
  rho: '#0d9488', // air density
  rhoText: '#5eead4',
  time: '#22d3ee',
  timeText: '#a5f3fc',
};

/** One look per liquid, kept across tabs (mercury silver-grey, water blue, oil amber). */
export const LIQUIDS = {
  hg: { rho: 13600, fill: '#9aa6b6', deep: '#5d697b', hi: '#eef2f7', stroke: '#3f4a5a', text: '#334155', ui: '#cbd5e1', convex: true },
  water: { rho: 1000, fill: '#7db7f5', deep: '#3b82f6', hi: '#dbeafe', stroke: '#1d4ed8', text: '#1d4ed8', ui: '#93c5fd', convex: false, alpha: 0.85 },
  oil: { rho: 900, fill: '#fbbf24', deep: '#d97706', hi: '#fef3c7', stroke: '#b45309', text: '#92400e', ui: '#fcd34d', convex: false, alpha: 0.88 },
};

/* -------------------------------------------------------------- numbers */

/** Fixed-point with a real minus sign. */
export function num(n, digits = 1, dec = '.') {
  const s = fmt(n, digits, dec);
  return s.startsWith('-') ? `−${s.slice(1)}` : s;
}

/**
 * A number with up to `digits` decimals, trailing zeros dropped when the
 * value is whole, thousands grouped from 10 000 up.
 */
export function smart(n, dec = '.', digits = 1) {
  if (!Number.isFinite(n)) return '—';
  const p = 10 ** digits;
  const r = Math.round(n * p) / p;
  if (Math.abs(r - Math.round(r)) < 1e-9) {
    const i = Math.round(r);
    return Math.abs(i) >= 10000 ? (i < 0 ? '−' : '') + groupThousands(Math.abs(i)) : num(i, 0, dec);
  }
  return num(r, digits, dec);
}

/** Whole numbers, grouped by thousands from 10 000 up (pascals, newtons). */
export function whole(n, dec = '.') {
  if (!Number.isFinite(n)) return '—';
  const r = Math.round(n);
  if (Math.abs(r) >= 10000) return (r < 0 ? '−' : '') + groupThousands(Math.abs(r));
  return num(r, 0, dec);
}

/** Pascals rounded to the nearest 100 Pa (three significant figures for 101 300 Pa). */
export function pa100(p, dec = '.') {
  return whole(Math.round(p / 100) * 100, dec);
}

/** A graph axis that ends on a round number: 4 equal steps of 1, 1.5, 2, 2.5, 3, 4, 5, 6 or 8 × 10ⁿ. */
export function niceAxis(v) {
  const raw = Math.max(v, 1e-9) / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  let step = 10 * p;
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (m * p >= raw - 1e-9) {
      step = m * p;
      break;
    }
  }
  const digits = Math.abs(step - Math.round(step)) < 1e-9 ? 0 : Math.abs(step * 10 - Math.round(step * 10)) < 1e-9 ? 1 : 2;
  return { max: step * 4, step, digits };
}

/** A small deterministic random generator, so scattered dots stay put between renders. */
export function seeded(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

/* ------------------------------------------------------------- controls */

/** Start / Pause / Resume / Again + Reset, in the reference's size. */
export function PlayControls({ labels, running, done, started, onToggle, onReset, disabled, className = '', startLabel }) {
  return (
    <div className={`grid grid-cols-2 gap-2 xl:flex ${className}`}>
      <Btn variant="primary" icon={running ? Pause : Play} onClick={onToggle} disabled={disabled} className="xl:min-w-[148px] min-h-[52px] text-[15px]">
        {running ? labels.pause : done ? labels.again : started ? labels.resume : (startLabel ?? labels.start)}
      </Btn>
      <Btn icon={RotateCcw} onClick={onReset} disabled={!started && !running} className="min-h-[52px] text-[15px]">
        {labels.reset}
      </Btn>
    </div>
  );
}

/** Small caption above a group of chips. */
export function GroupLabel({ children }) {
  return <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{children}</p>;
}

/* ---------------------------------------------------------------- scene */

export function LegendItem({ color, label, kind = 'line' }) {
  return (
    <li className="flex items-center gap-1.5">
      <svg width="20" height="10" aria-hidden="true" className="shrink-0">
        {kind === 'dash' && <line x1="1" y1="5" x2="19" y2="5" stroke={color} strokeWidth="2" strokeDasharray="4 3" />}
        {kind === 'dot' && <circle cx="10" cy="5" r="4" fill={color} />}
        {kind === 'block' && <rect x="3" y="0.5" width="14" height="9" rx="2" fill={color} stroke="rgba(15,23,42,0.35)" strokeWidth="0.8" />}
        {(kind === 'line' || kind === 'arrow') && (
          <line x1="1" y1="5" x2={kind === 'arrow' ? 13 : 19} y2="5" stroke={color} strokeWidth="3" strokeLinecap="round" />
        )}
        {kind === 'arrow' && <path d="M19,5 L12,1 L12,9 Z" fill={color} />}
      </svg>
      <span>{label}</span>
    </li>
  );
}

/** A chip in the scene's top-right corner (time, model…). */
export function Chip({ icon: Icon = Timer, children, color = '#0891b2', strong }) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] sm:text-[12px] font-medium tabular-nums shadow-sm ${
        strong ? 'text-white' : 'border-slate-200 bg-white/90 text-slate-600'
      }`}
      style={strong ? { background: color, borderColor: color } : undefined}
    >
      {Icon && <Icon size={14} style={{ color: strong ? '#fff' : color }} aria-hidden="true" />}
      {children}
    </span>
  );
}

/**
 * The light scene panel of the chosen design. `height(W, narrow)` sizes the
 * drawing to the measured width; `children(W, H, narrow)` draws it. The
 * legend floats over the top-left from `sm` up and moves under the scene on
 * phones.
 */
export function LabScene({ legend = [], chips, height, ariaLabel, children, minW = 280 }) {
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, minW);
  const narrow = W < 560;
  const H = Math.round(typeof height === 'function' ? height(W, narrow) : height);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-300/70 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_30px_-12px_rgba(0,0,0,0.6)]">
      <div ref={ref} className="w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="cl-scene block select-none">
          {width > 0 && children(W, H, narrow)}
        </svg>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 sm:p-3">
        {legend.length > 0 && (
          <ul className="hidden sm:flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-[12px] text-slate-600 shadow-sm backdrop-blur">
            {legend.map((l) => (
              <LegendItem key={l.label} {...l} />
            ))}
          </ul>
        )}
        {chips && <div className="ml-auto flex flex-col items-end gap-1.5">{chips}</div>}
      </div>
      {legend.length > 0 && (
        <ul className="flex sm:hidden flex-wrap gap-x-3 gap-y-1 border-t border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          {legend.map((l) => (
            <LegendItem key={l.label} {...l} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Faint square grid over a rectangle, lines `cell` px apart, anchored at (ax, ay). */
export function PaperGrid({ x0, y0, x1, y1, cell, ax = x0, ay = y1, color = PALETTE.grid }) {
  if (!(cell > 4)) return null;
  const lines = [];
  for (let x = ax - Math.floor((ax - x0) / cell) * cell; x <= x1 + 0.5; x += cell) {
    lines.push(<line key={`v${x.toFixed(1)}`} x1={x} x2={x} y1={y0} y2={y1} stroke={color} strokeWidth={1} />);
  }
  for (let y = ay - Math.floor((ay - y0) / cell) * cell; y <= y1 + 0.5; y += cell) {
    lines.push(<line key={`h${y.toFixed(1)}`} x1={x0} x2={x1} y1={y} y2={y} stroke={color} strokeWidth={1} />);
  }
  return <g aria-hidden="true">{lines}</g>;
}

/**
 * An arrow drawn from (x1, y1) to (x2, y2): a white halo for contrast on
 * busy drawings, then the coloured arrow, optionally a dot at the tail.
 */
export function ForceArrow({ x1, y1, x2, y2, color, width = 3.5, head = 13, opacity = 1, dot = false, dash }) {
  if (Math.hypot(x2 - x1, y2 - y1) < 3) {
    return dot ? <circle cx={x1} cy={y1} r={width * 0.9 + 1} fill={color} stroke="#fff" strokeWidth={1.5} opacity={opacity} /> : null;
  }
  return (
    <g opacity={opacity}>
      <Arrow x1={x1} y1={y1} x2={x2} y2={y2} color="#ffffff" width={width + 3.5} head={head + 3.5} />
      <Arrow x1={x1} y1={y1} x2={x2} y2={y2} color={color} width={width} head={head} dash={dash} />
      {dot && <circle cx={x1} cy={y1} r={width * 0.9 + 1} fill={color} stroke="#fff" strokeWidth={1.5} />}
    </g>
  );
}

/** A label pill that sits to one side of a point (side = -1 left, 1 right, 0 centred). */
export function SidePill({ x, y, side = 1, gap = 8, text, bg, fs = 12, box, color }) {
  if (!text) return null;
  const w = textWidth(text, fs, 600) + 16;
  return <Pill x={side === 0 ? x : x + side * (gap + w / 2)} y={y} text={text} bg={bg} color={color} size={fs} box={box} />;
}

/** Text with a white halo, for labels drawn over lines and liquids. */
export function HaloText({ x, y, children, color = '#0f172a', fs = 12, anchor = 'middle', weight = 700, italic = false }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={fs}
      fontStyle={italic ? 'italic' : undefined}
      fontWeight={weight}
      fill={color}
      stroke="#fff"
      strokeWidth="3"
      strokeLinejoin="round"
      paintOrder="stroke"
    >
      {children}
    </text>
  );
}

/**
 * A formula in the serif italic of symbols, with digits, signs and brackets
 * kept upright (the italic serif draws 0 like the letter o).
 */
export function Formula({ text }) {
  const parts = String(text).split(/([0-9.,]+|[()=+−·/²³√≈×:<>≥≤]+)/g).filter(Boolean);
  return (
    <span className="font-serif italic">
      {parts.map((p, i) =>
        /^[0-9.,]+$|^[()=+−·/²³√≈×:<>≥≤]+$/.test(p) ? (
          <span key={i} className="font-sans not-italic">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  );
}

/* ---------------------------------------------------------------- graph */

/**
 * The kit's live graph with a few additions this lesson needs: a series can
 * stay out of the legend (`legend: false`), shade the area under itself
 * (`fill`), mark points (`dots: [{ x, y, color, label, anchor, dy }]`), and
 * the x axis can carry its own tick values (`xTicks`).
 */
export function LiveGraph({
  title,
  series,
  xMax,
  yMax,
  yMin = 0,
  xLabel,
  yLabel,
  marker,
  note,
  height = 200,
  decimal = '.',
  ariaLabel,
  xDigits = 0,
  yDigits = 0,
  dots = [],
  xTicks: xTickValues,
}) {
  const [ref, { width }] = useElementSize();
  const H = height;
  const pad = { l: 46, r: 14, t: 18, b: 26 };
  const W = Math.max(width, 220);
  const gx = (v) => pad.l + (v / xMax) * (W - pad.l - pad.r);
  const gy = (v) => H - pad.b - ((v - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => yMin + f * (yMax - yMin));
  const xTicks = xTickValues ?? [0, 0.25, 0.5, 0.75, 1].map((f) => f * xMax);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {title && <p className="text-sm font-semibold text-gray-200">{title}</p>}
        {series
          .filter((s) => s.legend !== false)
          .map((s) => (
            <span key={s.id} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="h-0 w-4 border-t-2" style={{ borderColor: s.color, borderStyle: s.dash ? 'dashed' : 'solid' }} /> {s.label}
            </span>
          ))}
      </div>
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel ?? title} className="block overflow-visible">
          {yTicks.map((v) => (
            <g key={`y${v}`}>
              <line x1={pad.l} x2={W - pad.r} y1={gy(v)} y2={gy(v)} stroke={Math.abs(v) < 1e-9 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'} />
              <text x={pad.l - 6} y={gy(v) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                {fmt(v, yDigits, decimal)}
              </text>
            </g>
          ))}
          {xTicks.map((v) => (
            <text key={`x${v}`} x={gx(v)} y={H - 6} textAnchor="middle" fontSize="11" fill="#94a3b8">
              {fmt(v, xDigits, decimal)}
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
          {series
            .filter((s) => s.fill && s.points.length > 1)
            .map((s) => (
              <polygon
                key={`fill-${s.id}`}
                points={[
                  `${gx(s.points[0].x)},${gy(Math.max(yMin, 0))}`,
                  ...s.points.map((p) => `${gx(p.x)},${gy(p.y)}`),
                  `${gx(s.points[s.points.length - 1].x)},${gy(Math.max(yMin, 0))}`,
                ].join(' ')}
                fill={s.fill.color ?? s.color}
                opacity={s.fill.opacity ?? 0.18}
              />
            ))}
          {marker !== undefined && marker > 0 && (
            <line x1={gx(marker)} x2={gx(marker)} y1={pad.t} y2={H - pad.b} stroke="rgba(34,211,238,0.5)" strokeDasharray="3 4" />
          )}
          {series.map((s) => (
            <g key={s.id}>
              <polyline
                points={s.points.map((p) => `${gx(p.x).toFixed(1)},${gy(p.y).toFixed(1)}`).join(' ')}
                fill="none"
                stroke={s.color}
                strokeWidth={s.width ?? 2.5}
                strokeDasharray={s.dash}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {s.points.length > 0 && s.dot && (
                <circle cx={gx(s.points[s.points.length - 1].x)} cy={gy(s.points[s.points.length - 1].y)} r="4" fill={s.color} stroke="#0b0b16" strokeWidth="1.5" />
              )}
            </g>
          ))}
          {dots.map((d) => (
            <g key={d.id ?? `d-${d.x}-${d.label ?? ''}`}>
              <circle cx={gx(d.x)} cy={gy(d.y)} r={d.r ?? 4} fill={d.color ?? '#e2e8f0'} stroke="#0b0b16" strokeWidth="1.5" />
              {d.label && (
                <text
                  x={Math.min(W - pad.r - 2, Math.max(pad.l + 2, gx(d.x) + (d.dx ?? 0)))}
                  y={gy(d.y) + (d.dy ?? -9)}
                  textAnchor={d.anchor ?? 'middle'}
                  fontSize="11"
                  fontWeight="700"
                  fill={d.textColor ?? d.color ?? '#e2e8f0'}
                  stroke="#0b0b16"
                  strokeWidth="3"
                  paintOrder="stroke"
                >
                  {d.label}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      {note && <p className="mt-1 text-xs text-gray-500">{note}</p>}
    </div>
  );
}

/* --------------------------------------------------------------- liquids */

/**
 * Gradient defs for a liquid: `id` across a tube (so a column reads as a
 * rounded glass of it) and `${id}-v` from the surface down (for a dish).
 */
export function LiquidDefs({ id, liquid }) {
  const L = LIQUIDS[liquid];
  const a = L.alpha ?? 1;
  return (
    <defs>
      <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor={L.deep} stopOpacity={a} />
        <stop offset="0.28" stopColor={L.fill} stopOpacity={a} />
        <stop offset="0.5" stopColor={L.hi} stopOpacity={a} />
        <stop offset="0.72" stopColor={L.fill} stopOpacity={a} />
        <stop offset="1" stopColor={L.deep} stopOpacity={a} />
      </linearGradient>
      <linearGradient id={`${id}-v`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor={L.hi} stopOpacity={a} />
        <stop offset="0.25" stopColor={L.fill} stopOpacity={a} />
        <stop offset="1" stopColor={L.deep} stopOpacity={a} />
      </linearGradient>
    </defs>
  );
}
