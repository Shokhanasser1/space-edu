import { Pause, Play, RotateCcw, Timer } from 'lucide-react';

import { Arrow, Btn, fmt, niceStep, useElementSize } from '../kit/ui';
import { PALETTE } from '../kit/scene';

/**
 * Drawing pieces of the "Kinetik energiya" lab (the three tabs share them):
 * the scene shell of the chosen design, Start/Pause/Reset, a lab cart with
 * steel weights, a top-view car, a metre ruler, labelled arrows, a formula
 * tile and number helpers. No words live here - every label arrives through
 * props from the TEXT table of KineticEnergy.jsx.
 */

/** Colours of this lab: the kit's palette plus the energy colours shared by the statics lessons. */
export const COL = {
  ...PALETTE,
  ek: '#059669', // kinetic energy - green
  ekFill: '#10b981',
  ekText: '#6ee7b7',
  work: '#d97706', // work A - amber
  workFill: '#f59e0b',
  workText: '#fcd34d',
  heat: '#ea580c', // heat Q - orange
  heatFill: '#f97316',
  heatText: '#fdba74',
  force: '#dc2626',
  forceText: '#fca5a5',
};

/* ------------------------------------------------------------- numbers */

/** fmt with a true minus sign. */
export function num(n, digits = 1, decimal = '.') {
  return fmt(n, digits, decimal).replace('-', '−');
}

/** Rounds half up at `digits` decimals (1.225 → 1.23), then formats. */
export function round(n, digits = 2, decimal = '.') {
  const p = 10 ** digits;
  const v = Math.sign(n) * (Math.round(Math.abs(n) * p + 1e-7) / p);
  return num(v, digits, decimal);
}

/** Trims to at most `max` decimals: 25 → "25", 2.5 → "2.5", 7.0711 → "7.07". */
export function trim(n, decimal = '.', max = 2) {
  for (let k = 0; k <= max; k += 1) {
    const v = Math.round(n * 10 ** k) / 10 ** k;
    if (Math.abs(n - v) < 1e-7) return num(v, k, decimal);
  }
  return round(n, max, decimal);
}

/** An energy with a sensible unit: J below 1 kJ, then kJ, then MJ. `units` = { J, kJ, MJ }. */
export function energyParts(E, units, decimal = '.') {
  const a = Math.abs(E);
  if (a < 999.5) return { v: trim(E, decimal, a < 10 ? 2 : a < 100 ? 1 : 0), u: units.J };
  if (a < 999500) return { v: trim(E / 1000, decimal, a < 1e4 ? 2 : 1), u: units.kJ };
  return { v: trim(E / 1e6, decimal, 2), u: units.MJ };
}

/** "138.9 kJ" */
export function energyText(E, units, decimal = '.') {
  const p = energyParts(E, units, decimal);
  return `${p.v} ${p.u}`;
}

const NICE = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** A "nice" axis maximum ≥ v that splits into `parts` round steps. */
export function niceMax(v, parts = 4) {
  const raw = Math.max(v, 1e-6) / parts;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = NICE.find((k) => k * p >= raw - 1e-12) ?? 10;
  return m * p * parts;
}

/** Decimals needed to print the ticks of an axis 0…max split into `parts`. */
export function tickDigits(max, parts = 4) {
  const step = max / parts;
  for (let k = 0; k <= 3; k += 1) if (Math.abs(step * 10 ** k - Math.round(step * 10 ** k)) < 1e-6) return k;
  return 3;
}

/** Deterministic pseudo-random number in [0, 1) for scenery. */
export function hash01(i) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/* ------------------------------------------------------------- controls */

/** Start / Pause / Resume / Again + Reset, in the reference's size. */
export function PlayControls({ labels, running, done, started, onToggle, onReset, className = '' }) {
  return (
    <div className={`grid grid-cols-2 gap-2 xl:flex ${className}`}>
      <Btn variant="primary" icon={running ? Pause : Play} onClick={onToggle} className="xl:min-w-[148px] min-h-[52px] text-[15px]">
        {running ? labels.pause : done ? labels.again : started ? labels.resume : labels.start}
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

const SUB_DIGITS = { '₀': '0', '₁': '1', '₂': '2', '₃': '3' };

/**
 * Text with subscripts: "v₀" and "E_{k1}" become real <sub> elements (the
 * serif italic used for symbols has no glyph for ₀ and draws it like an "o").
 */
export function Rich({ children }) {
  if (typeof children !== 'string') return children ?? null;
  const parts = [];
  const re = /_\{([^}]*)\}|([₀₁₂₃])/g;
  let last = 0;
  let m = re.exec(children);
  while (m) {
    if (m.index > last) parts.push(children.slice(last, m.index));
    parts.push(
      <sub key={parts.length} className="text-[0.72em] not-italic">
        {m[1] ?? SUB_DIGITS[m[2]]}
      </sub>,
    );
    last = re.lastIndex;
    m = re.exec(children);
  }
  if (last < children.length) parts.push(children.slice(last));
  return <>{parts}</>;
}

/** The same text without markup, for aria-labels: "E_{k1}" → "Ek1". */
export function plain(s) {
  return String(s).replace(/_\{([^}]*)\}/g, '$1');
}

/**
 * A formula with its numbers put in: a coloured tag, the general form, the
 * substituted line and the result. `ok` adds a green check style.
 */
export function FormulaTile({ tag, color = '#22d3ee', general, filled, result, ok }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 transition-colors ${ok ? 'bg-emerald-400/[0.06]' : 'bg-black/25'}`}
      style={{ borderColor: ok ? 'rgba(52,211,153,0.45)' : 'rgba(255,255,255,0.08)' }}
    >
      {tag && (
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden="true" />
          {tag}
        </p>
      )}
      <p className="mt-1 font-serif text-[15px] italic text-gray-200">
        <Rich>{general}</Rich>
      </p>
      {filled && (
        <p className="mt-0.5 text-[13px] tabular-nums text-gray-400">
          <Rich>{filled}</Rich>
        </p>
      )}
      {result && (
        <p className="mt-1 text-lg font-bold tabular-nums text-white">
          <Rich>{result}</Rich>
        </p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

export function LegendItem({ color, label, kind = 'line' }) {
  return (
    <li className="flex items-center gap-1.5">
      <svg width="20" height="10" aria-hidden="true" className="shrink-0">
        {kind === 'dash' && <line x1="1" y1="5" x2="19" y2="5" stroke={color} strokeWidth="2" strokeDasharray="4 3" />}
        {kind === 'dot' && <circle cx="10" cy="5" r="4" fill={color} />}
        {(kind === 'line' || kind === 'arrow') && (
          <line x1="1" y1="5" x2={kind === 'arrow' ? 13 : 19} y2="5" stroke={color} strokeWidth="3" strokeLinecap="round" />
        )}
        {kind === 'arrow' && <path d="M19,5 L12,1 L12,9 Z" fill={color} />}
        {kind === 'box' && <rect x="3" y="0.5" width="14" height="9" rx="2" fill={color} />}
        {kind === 'zone' && <rect x="1" y="1" width="18" height="8" rx="2" fill={color} fillOpacity="0.22" stroke={color} strokeWidth="1.2" strokeDasharray="3 2" />}
      </svg>
      <span>
        <Rich>{label}</Rich>
      </span>
    </li>
  );
}

/** A chip in the scene's top-right corner (time speed-up, force scale…). */
export function Chip({ icon: Icon = Timer, children, color = '#0891b2' }) {
  return (
    <span className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[11px] sm:text-[12px] font-medium tabular-nums text-slate-600 shadow-sm">
      {Icon && <Icon size={14} style={{ color }} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** A chip that shows a vector scale: a bar of `px` pixels and its value. */
export function ScaleChip({ px, text, color = COL.force }) {
  const w = Math.max(8, Math.round(px));
  return (
    <span className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[11px] sm:text-[12px] font-medium tabular-nums text-slate-600 shadow-sm">
      <svg width={w + 4} height="10" aria-hidden="true" className="shrink-0">
        <line x1="1" y1="2" x2="1" y2="8" stroke={color} strokeWidth="1.5" />
        <line x1="1" y1="5" x2={w + 1} y2="5" stroke={color} strokeWidth="3" />
        <line x1={w + 1} y1="2" x2={w + 1} y2="8" stroke={color} strokeWidth="1.5" />
      </svg>
      {text}
    </span>
  );
}

/**
 * The light scene panel of the chosen design. `height(W, narrow)` sizes the
 * drawing to the measured width; `children(W, H, narrow)` draws it. The
 * legend floats over the top-left from `sm` up and moves under the scene on
 * phones. `chips` may be a function `(W, narrow) => nodes`.
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
        {chips && <div className="ml-auto flex flex-col items-end gap-1.5">{typeof chips === 'function' ? chips(W, narrow) : chips}</div>}
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

/** A 1D view: world metres [x0, x1] → [padL, W − padR] pixels. */
export function lineView(x0, x1, W, padL, padR) {
  const k = (W - padL - padR) / Math.max(1e-9, x1 - x0);
  return { k, x0, x1, sx: (x) => padL + (x - x0) * k, wx: (px) => x0 + (px - padL) / k };
}

/** Picks the ruler step for a view so labels sit at least `minPx` apart. */
export function rulerStep(view, minPx = 64) {
  return niceStep(view.k, minPx);
}

/** A metre ruler along y from px `fromX` to `toX`: ticks every `step`, numbers under them and the unit at the right end. */
export function Ruler({ view, y, step, unit, decimal = '.', fs = 11, color = '#475569', fromX = 0, toX, unitX }) {
  const items = [];
  const right = toX ?? view.sx(view.x1);
  const first = Math.ceil((view.wx(fromX) - 1e-9) / step) * step;
  const digits = step < 1 ? (step < 0.1 ? 2 : 1) : 0;
  const ux = unitX ?? right;
  const unitW = unit ? unit.length * fs * 0.62 + 10 : 0;
  for (let x = first; view.sx(x) <= right + 0.5; x += step) {
    const i = Math.round(x / step);
    const px = view.sx(x);
    items.push(<line key={`t${i}`} x1={px} x2={px} y1={y} y2={y + 7} stroke={color} strokeOpacity={0.9} strokeWidth={1.3} />);
    const half = view.sx(x + step / 2);
    if (half < right) items.push(<line key={`h${i}`} x1={half} x2={half} y1={y} y2={y + 4} stroke={color} strokeOpacity={0.45} strokeWidth={1} />);
    if (px > fromX + 4 && px < ux - unitW - 4) {
      items.push(
        <text key={`l${i}`} x={px} y={y + 19} textAnchor="middle" fontSize={fs} fill={color} fontWeight={Math.abs(x) < 1e-9 ? 700 : 500}>
          {num(x, digits, decimal)}
        </text>,
      );
    }
  }
  return (
    <g aria-hidden="true">
      <line x1={fromX} x2={right} y1={y} y2={y} stroke={color} strokeWidth={1.3} />
      {items}
      {unit && (
        <text x={ux} y={y + 19} textAnchor="end" fontSize={fs} fontWeight="700" fill={color}>
          {unit}
        </text>
      )}
    </g>
  );
}

/** A physics symbol in the scene: italic letter with an optional subscript, outlined in white. */
export function SvgSym({ x, y, main, sub, rest, color, fs = 13, anchor = 'start', weight = 700 }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={fs} fontWeight={weight} fill={color} stroke="#fff" strokeWidth={3.2} paintOrder="stroke" strokeLinejoin="round">
      <tspan fontStyle="italic">{main}</tspan>
      {sub && (
        <tspan fontSize={fs * 0.74} dy={fs * 0.3}>
          {sub}
        </tspan>
      )}
      {rest && (
        <tspan dy={sub ? -fs * 0.3 : 0} fontStyle="normal">
          {rest}
        </tspan>
      )}
    </text>
  );
}

/**
 * A force or velocity arrow from (x, y) by (dx, dy) px with its label by the
 * tip. `place` puts the label: 'right' | 'left' | 'above' | 'below'.
 */
export function VecArrow({ x, y, dx, dy, color, main, sub, rest, fs = 13, place = 'right', width = 3 }) {
  const len = Math.hypot(dx, dy);
  const tx = x + dx;
  const ty = y + dy;
  const head = Math.max(6, Math.min(12, len * 0.5));
  let lx = tx + 6;
  let ly = ty + fs * 0.35;
  let anchor = 'start';
  if (place === 'left') {
    lx = tx - 6;
    anchor = 'end';
  } else if (place === 'above') {
    lx = tx;
    ly = ty - 7;
    anchor = 'middle';
  } else if (place === 'below') {
    lx = tx;
    ly = ty + fs + 4;
    anchor = 'middle';
  }
  return (
    <g>
      {len >= 2 ? <Arrow x1={x} y1={y} x2={tx} y2={ty} color={color} width={width} head={head} /> : <circle cx={x} cy={y} r={2.5} fill={color} />}
      {main && <SvgSym x={lx} y={ly} main={main} sub={sub} rest={rest} color={color} fs={fs} anchor={anchor} />}
    </g>
  );
}

/* ----------------------------------------------------------------- cart */

/** Weights on the cart: one steel block per kilogram above the cart's own 1 kg, a half block for 0.5 kg. */
function blockCount(mass) {
  const extra = Math.max(0, mass - 1);
  const whole = Math.floor(extra + 1e-9);
  return whole + (extra - whole > 0.25 ? 1 : 0);
}

/** Geometry of the cart drawn by <Cart>, for placing arrows around it (y offsets from the rail top). */
export function cartGeom(len, mass) {
  const r = len * 0.1;
  const bodyH = len * 0.27;
  const bodyBottom = -r * 1.25;
  const bodyTop = bodyBottom - bodyH;
  const bw = len * 0.19;
  const bh = len * 0.15;
  const rows = Math.ceil(blockCount(mass) / 4);
  const top = bodyTop - rows * (bh + 1.5);
  return { r, bodyH, bodyBottom, bodyTop, bw, bh, top, midY: bodyBottom - bodyH / 2 };
}

/**
 * A lab cart seen from the side, centred on `cx`, wheels on the rail top `y`.
 * The cart itself is 1 kg; every 1 kg above that is a steel block on top
 * (four to a row), and a half block shows 0.5 kg. `label` sits on the body.
 */
export function Cart({ cx, y, len, mass, label, rot = 0, fs = 12, body = '#334155' }) {
  const g = cartGeom(len, mass);
  const extra = Math.max(0, mass - 1);
  const whole = Math.floor(extra + 1e-9);
  const half = extra - whole > 0.25;
  const n = blockCount(mass);
  const rowW = 4 * g.bw + 3 * 2;
  const left0 = cx - rowW / 2;
  const blocks = [];
  for (let i = 0; i < n; i += 1) {
    const row = Math.floor(i / 4);
    const col = i % 4;
    const isHalf = half && i === n - 1;
    const h = isHalf ? g.bh * 0.5 : g.bh;
    const bx = left0 + col * (g.bw + 2);
    const by = y + g.bodyTop - (row + 1) * (g.bh + 1.5) + (g.bh - h);
    blocks.push(
      <g key={i}>
        <rect x={bx} y={by} width={g.bw} height={h} rx={2} fill="url(#ke-steel)" stroke="#475569" strokeWidth={1} />
        <line x1={bx + 2} x2={bx + g.bw - 2} y1={by + 2} y2={by + 2} stroke="#f8fafc" strokeOpacity={0.7} strokeWidth={1} />
      </g>,
    );
  }
  const left = cx - len / 2;
  const wheel = (wx) => (
    <g transform={`translate(${wx.toFixed(1)} ${(y - g.r).toFixed(1)})`}>
      <circle r={g.r} fill="#1e293b" />
      <circle r={g.r * 0.45} fill="#cbd5e1" />
      <line x1={0} y1={0} x2={g.r * 0.85 * Math.cos(rot)} y2={g.r * 0.85 * Math.sin(rot)} stroke="#94a3b8" strokeWidth={1.5} />
    </g>
  );
  return (
    <g>
      <ellipse cx={cx} cy={y + 1} rx={len * 0.46} ry={2.5} fill="#0f172a" opacity={0.12} />
      {blocks}
      <rect x={left} y={y + g.bodyTop} width={len} height={g.bodyH} rx={5} fill={body} />
      <rect x={left + 3} y={y + g.bodyTop + 2} width={len - 6} height={3} rx={1.5} fill="#ffffff" opacity={0.25} />
      {label && (
        <text x={cx} y={y + g.midY + fs * 0.36 + 1} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#fff" className="tabular-nums">
          {label}
        </text>
      )}
      {wheel(left + len * 0.2)}
      {wheel(left + len * 0.8)}
    </g>
  );
}

/** Gradient used by the cart's steel weights; put once inside the scene's svg. */
export function CartDefs() {
  return (
    <defs>
      <linearGradient id="ke-steel" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#cbd5e1" />
        <stop offset="1" stopColor="#94a3b8" />
      </linearGradient>
      <pattern id="ke-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="7" height="7" fill="#fef3c7" />
        <line x1="0" y1="0" x2="0" y2="7" stroke="#d97706" strokeWidth="2.4" />
      </pattern>
    </defs>
  );
}

/** A straight rail seen from the side between px `a` and `b`, its top at y (where the wheels roll). */
export function Rail({ a, b, y, feet = true }) {
  const items = [];
  if (feet) {
    const n = Math.max(2, Math.round((b - a) / 160));
    for (let i = 0; i <= n; i += 1) {
      const fx = a + 14 + ((b - a - 28) * i) / n;
      items.push(<path key={`f${i}`} d={`M${fx - 7},${y + 14} L${fx - 3},${y + 9} L${fx + 3},${y + 9} L${fx + 7},${y + 14} Z`} fill="#94a3b8" />);
    }
  }
  return (
    <g aria-hidden="true">
      {items}
      <rect x={a} y={y} width={b - a} height={9} rx={3} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={1} />
      <line x1={a + 3} x2={b - 3} y1={y + 1} y2={y + 1} stroke="#64748b" strokeWidth={1.6} />
    </g>
  );
}

/* ------------------------------------------------------------------ car */

/** Top view of a car, centre at (x, y), facing right. */
export function TopCar({ x, y, len, wid, color, braking }) {
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
      <rect x={-len / 2 + 1.5} y={-wid / 2 + 2} width={len} height={wid} rx={wid * 0.3} fill="#0f172a" opacity="0.22" />
      <rect x={-len / 2} y={-wid / 2} width={len} height={wid} rx={wid * 0.3} fill={color} stroke="#0f172a" strokeOpacity="0.55" strokeWidth={1.1} />
      <path d={`M${len * 0.1},${-wid * 0.38} L${len * 0.24},${-wid * 0.32} L${len * 0.24},${wid * 0.32} L${len * 0.1},${wid * 0.38} Z`} fill="#e0f2fe" opacity="0.95" />
      <path d={`M${-len * 0.3},${-wid * 0.34} L${-len * 0.2},${-wid * 0.3} L${-len * 0.2},${wid * 0.3} L${-len * 0.3},${wid * 0.34} Z`} fill="#e0f2fe" opacity="0.8" />
      <rect x={-len * 0.2} y={-wid * 0.34} width={len * 0.3} height={wid * 0.68} rx={2} fill="#fff" opacity="0.18" />
      <rect x={len / 2 - 3} y={-wid / 2 + 2} width={2.5} height={wid * 0.22} rx={1} fill="#fde68a" />
      <rect x={len / 2 - 3} y={wid / 2 - 2 - wid * 0.22} width={2.5} height={wid * 0.22} rx={1} fill="#fde68a" />
      <rect x={-len / 2 + 0.5} y={-wid / 2 + 2} width={2.5} height={wid * 0.22} rx={1} fill={braking ? '#ef4444' : '#991b1b'} />
      <rect x={-len / 2 + 0.5} y={wid / 2 - 2 - wid * 0.22} width={2.5} height={wid * 0.22} rx={1} fill={braking ? '#ef4444' : '#991b1b'} />
      {braking && (
        <>
          <circle cx={-len / 2} cy={-wid * 0.3} r={wid * 0.28} fill="#ef4444" opacity="0.3" />
          <circle cx={-len / 2} cy={wid * 0.3} r={wid * 0.28} fill="#ef4444" opacity="0.3" />
        </>
      )}
    </g>
  );
}
