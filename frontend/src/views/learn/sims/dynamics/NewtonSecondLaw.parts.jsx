import { Pause, Play, RotateCcw, Timer } from 'lucide-react';

import { Btn, fmt, useElementSize } from '../kit/ui';
import { PALETTE } from '../kit/scene';

/**
 * Drawing pieces of the "Newton's second law" lab (the three tabs share
 * them): the scene shell of the chosen design, Start/Pause/Reset, a lab cart
 * with slotted weights, a straight track with a metre ruler, and small
 * number helpers. No words live here - every label arrives through props.
 */

/* ---------------------------------------------------------------- colours */

/** Colours of this lab: the kit's palette plus one colour per extra force. */
export const COL = {
  ...PALETTE,
  f1: '#dc2626', // force (F, F1) - red, as PALETTE.force
  f1Text: '#fca5a5',
  f2: '#0891b2', // second force - teal
  f2Text: '#67e8f9',
  f3: '#9333ea', // third force - purple
  f3Text: '#d8b4fe',
  res: '#0f172a', // resultant - ink, drawn thicker
  resText: '#f1f5f9',
  mass: '#94a3b8', // mass slider / weights
};

/* ------------------------------------------------------------- controls */

/** Start / Pause / Resume / Again + Reset, in the reference's size. */
export function PlayControls({ labels, running, done, started, onToggle, onReset, disabled, className = '' }) {
  return (
    <div className={`grid grid-cols-2 gap-2 xl:flex ${className}`}>
      <Btn variant="primary" icon={running ? Pause : Play} onClick={onToggle} disabled={disabled} className="xl:min-w-[148px] min-h-[52px] text-[15px]">
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

/* ---------------------------------------------------------------- scene */

export function LegendItem({ color, label, kind = 'line' }) {
  return (
    <li className="flex items-center gap-1.5">
      <svg width="20" height="10" aria-hidden="true" className="shrink-0">
        {kind === 'dash' && <line x1="1" y1="5" x2="19" y2="5" stroke={color} strokeWidth="2" strokeDasharray="4 3" />}
        {kind === 'dot' && <circle cx="10" cy="5" r="4" fill={color} />}
        {kind === 'ring' && <circle cx="10" cy="5" r="3.5" fill="#fff" stroke={color} strokeWidth="2" />}
        {(kind === 'line' || kind === 'arrow') && (
          <line x1="1" y1="5" x2={kind === 'arrow' ? 13 : 19} y2="5" stroke={color} strokeWidth="3" strokeLinecap="round" />
        )}
        {kind === 'bold' && <line x1="1" y1="5" x2="12" y2="5" stroke={color} strokeWidth="4.5" strokeLinecap="round" />}
        {(kind === 'arrow' || kind === 'bold') && <path d="M19,5 L12,0.5 L12,9.5 Z" fill={color} />}
        {kind === 'box' && <rect x="3" y="1" width="14" height="8" rx="2" fill={color} />}
      </svg>
      <span>{label}</span>
    </li>
  );
}

/** A chip in the scene's top-right corner (time speed-up, scale, camera…). */
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

/** A chip that shows the force scale: a red bar of `px` pixels and its value. */
export function ScaleChip({ px, text, color = COL.force }) {
  return (
    <span className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[11px] sm:text-[12px] font-medium tabular-nums text-slate-600 shadow-sm">
      <svg width={px + 8} height="10" aria-hidden="true" className="shrink-0">
        <line x1="1" y1="2" x2="1" y2="8" stroke={color} strokeWidth="1.5" />
        <line x1="1" y1="5" x2={px + 1} y2="5" stroke={color} strokeWidth="3" />
        <line x1={px + 1} y1="2" x2={px + 1} y2="8" stroke={color} strokeWidth="1.5" />
      </svg>
      {text}
    </span>
  );
}

/**
 * The light scene panel of the chosen design. `height(W, narrow)` sizes the
 * drawing to the measured width; `children(W, H, narrow)` draws it.
 * The legend floats over the top-left from `sm` up and moves under the
 * scene on phones. `chips` may be a function `(W, narrow) => nodes` (a scale
 * bar that follows the drawing's scale). `svgProps` go to the <svg>
 * (pointer handlers for dragging).
 */
export function LabScene({ legend = [], chips, height, ariaLabel, children, minW = 280, svgProps, below }) {
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, minW);
  const narrow = W < 560;
  const H = Math.round(typeof height === 'function' ? height(W, narrow) : height);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-300/70 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_30px_-12px_rgba(0,0,0,0.6)]">
      <div ref={ref} className="w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="cl-scene block select-none" {...svgProps}>
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
      {below}
    </div>
  );
}

/** A 1D view: world metres [x0, x1] → [padL, W − padR] pixels. */
export function lineView(x0, x1, W, padL, padR) {
  const k = (W - padL - padR) / Math.max(1e-9, x1 - x0);
  return { k, x0, x1, sx: (x) => padL + (x - x0) * k, wx: (px) => x0 + (px - padL) / k };
}

/* ------------------------------------------------------------- numbers */

const SUBS = { '₀': '0', '₁': '1', '₂': '2', '₃': '3' };

/**
 * Renders subscript digits (F₁, v₀) as real <sub> elements: the serif
 * italic used for symbols has no glyph for ₀ and draws it like an "o".
 */
export function Rich({ children }) {
  if (typeof children !== 'string') return children ?? null;
  const parts = [];
  let buf = '';
  let run = '';
  const flushSub = () => {
    if (run) parts.push(<sub key={parts.length} className="text-[0.72em] not-italic">{run}</sub>);
    run = '';
  };
  const flushBuf = () => {
    if (buf) parts.push(buf);
    buf = '';
  };
  for (const ch of children) {
    if (SUBS[ch]) {
      flushBuf();
      run += SUBS[ch];
    } else {
      flushSub();
      buf += ch;
    }
  }
  flushSub();
  flushBuf();
  return <>{parts}</>;
}

/** fmt with a true minus sign. */
export function num(n, digits = 1, decimal = '.') {
  return fmt(n, digits, decimal).replace('-', '−');
}

/** Trims to at most `max` decimals: 25 → "25", 2.5 → "2.5", 0.333 → "0.33". */
export function trim(n, decimal = '.', max = 2) {
  for (let k = 0; k <= max; k += 1) if (Math.abs(n * 10 ** k - Math.round(n * 10 ** k)) < 1e-9) return num(n, k, decimal);
  return num(n, max, decimal);
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

/* ---------------------------------------------------------------- track */

/**
 * A straight, smooth (frictionless) track seen from the side: the rail from
 * world x0 to x1 with its feet, an end stop at x1, and a metre ruler under it.
 * `y` is the top of the rail (where the wheels roll).
 */
export function Track({ view, W, y, x0, x1, step = 1, minor = 0, unit, decimal = '.', fs = 11, digits = 0, stopAt }) {
  const a = view.sx(x0) - 18;
  const b = view.sx(x1) + 18;
  const items = [];
  const first = Math.ceil((x0 - 1e-9) / step) * step;
  for (let x = first; x <= x1 + 1e-9; x += step) {
    const px = view.sx(x);
    items.push(<line key={`t${x.toFixed(3)}`} x1={px} x2={px} y1={y + 16} y2={y + 25} stroke="#475569" strokeWidth={1.4} />);
    items.push(
      <text key={`l${x.toFixed(3)}`} x={px} y={y + 39} textAnchor="middle" fontSize={fs} fill="#475569" fontWeight={Math.abs(x) < 1e-9 ? 700 : 500}>
        {num(x, digits, decimal)}
      </text>,
    );
    if (minor > 1 && x < x1 - 1e-9) {
      for (let k = 1; k < minor; k += 1) {
        const mx = view.sx(x + (k * step) / minor);
        items.push(<line key={`m${x.toFixed(3)}-${k}`} x1={mx} x2={mx} y1={y + 16} y2={y + 21} stroke="#94a3b8" strokeWidth={1} />);
      }
    }
  }
  const feet = [];
  const nFeet = Math.max(2, Math.round((b - a) / 160));
  for (let i = 0; i <= nFeet; i += 1) {
    const fx = a + 14 + ((b - a - 28) * i) / nFeet;
    feet.push(<path key={`f${i}`} d={`M${fx - 7},${y + 14} L${fx - 3},${y + 9} L${fx + 3},${y + 9} L${fx + 7},${y + 14} Z`} fill="#94a3b8" />);
  }
  const stopX = stopAt !== undefined ? view.sx(stopAt) : null;
  return (
    <g aria-hidden="true">
      {feet}
      <rect x={a} y={y} width={b - a} height={9} rx={3} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={1} />
      <line x1={a + 3} x2={b - 3} y1={y + 1} y2={y + 1} stroke="#64748b" strokeWidth={1.6} />
      <line x1={a} x2={b} y1={y + 16} y2={y + 16} stroke="#475569" strokeWidth={1.4} />
      {items}
      {stopX !== null && (
        <g>
          <rect x={stopX} y={y - 30} width={10} height={30} rx={2} fill="#334155" />
          <path d={`M${stopX},${y - 24} l-6,3 l6,3 l-6,3 l6,3 l-6,3`} fill="none" stroke="#64748b" strokeWidth={1.5} />
        </g>
      )}
      {unit && (
        <text x={W - 8} y={y + 39} textAnchor="end" fontSize={fs} fontWeight="700" fill="#475569">
          {unit}
        </text>
      )}
    </g>
  );
}

/* ----------------------------------------------------------------- cart */

/** Blocks on the cart: one per kilogram above the cart's own 1 kg, plus a half block for 0.5 kg. */
function blockCount(mass) {
  const extra = Math.max(0, mass - 1);
  const whole = Math.floor(extra + 1e-9);
  return whole + (extra - whole > 0.25 ? 1 : 0);
}

/** Geometry of the cart drawn by <Cart>, for placing arrows around it. */
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
export function Cart({ cx, y, len, mass, label, rot = 0, fs = 12 }) {
  const g = cartGeom(len, mass);
  const extra = Math.max(0, mass - 1);
  const whole = Math.floor(extra + 1e-9);
  const half = extra - whole > 0.25;
  const blocks = [];
  const n = blockCount(mass);
  const rowW = 4 * g.bw + 3 * 2;
  const left0 = cx - rowW / 2;
  for (let i = 0; i < n; i += 1) {
    const row = Math.floor(i / 4);
    const col = i % 4;
    const isHalf = half && i === n - 1;
    const h = isHalf ? g.bh * 0.5 : g.bh;
    const bx = left0 + col * (g.bw + 2);
    const by = y + g.bodyTop - (row + 1) * (g.bh + 1.5) + (g.bh - h);
    blocks.push(
      <g key={i}>
        <rect x={bx} y={by} width={g.bw} height={h} rx={2} fill="url(#nsl-steel)" stroke="#475569" strokeWidth={1} />
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
      <defs>
        <linearGradient id="nsl-steel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cbd5e1" />
          <stop offset="1" stopColor="#94a3b8" />
        </linearGradient>
      </defs>
      <ellipse cx={cx} cy={y + 1} rx={len * 0.46} ry={2.5} fill="#0f172a" opacity={0.12} />
      {blocks}
      <rect x={left} y={y + g.bodyTop} width={len} height={g.bodyH} rx={5} fill="#334155" />
      <rect x={left + 3} y={y + g.bodyTop + 2} width={len - 6} height={3} rx={1.5} fill="#64748b" />
      <circle cx={left + len + 4} cy={y + g.midY} r={3.5} fill="none" stroke="#334155" strokeWidth={2} />
      {label && (
        <text x={cx} y={y + g.midY + fs * 0.36 + 1} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#fff">
          {label}
        </text>
      )}
      {wheel(left + len * 0.2)}
      {wheel(left + len * 0.8)}
    </g>
  );
}
