import { Pause, Play, RotateCcw, Timer } from 'lucide-react';

import { Arrow, Btn, fmt, niceStep, textWidth, useElementSize } from '../kit/ui';
import { PALETTE } from '../kit/scene';

/**
 * Pieces shared by the three labs of the lesson "Gorizontal otilgan jismning
 * harakati" (HorizontalThrow.jsx): the physics constants, the scene shell of
 * the chosen design (light lab paper, legend on top, chips on the right), a
 * left/bottom-anchored metre view, grid, axis numbers, soil, balls,
 * stroboscope rings, dimension lines, a velocity scale bar and the formula
 * tile. No words live here: every label arrives through props.
 */

export const G = 9.8; // m/s²

/** Flight time of a body thrown horizontally from height h (no air): t = √(2h/g). */
export const flightTime = (h) => Math.sqrt((2 * Math.max(h, 0)) / G);

/** Colours, consistent across the three tabs. */
export const COL = {
  path: PALETTE.path, // trajectory
  pathText: PALETTE.pathText,
  x: PALETTE.disp, // horizontal motion, projection on the x axis
  xText: PALETTE.dispText,
  y: PALETTE.second, // vertical motion, projection on the y axis
  yText: PALETTE.secondText,
  vel: PALETTE.vel,
  velLight: '#10b981',
  velText: PALETTE.velText,
  acc: PALETTE.acc,
  accText: PALETTE.accText,
  time: PALETTE.time,
  third: '#0d9488',
  thirdText: '#5eead4',
  ink: PALETTE.ink,
  muted: '#475569',
  grid: PALETTE.grid,
  paper: '#fbfcfe',
  soil: '#ecfccb',
  soilLine: '#65a30d',
  soilText: '#3f6212',
};

/**
 * Stroboscope interval: the largest "round" Δt that still gives at least four
 * whole intervals in the flight, so the 1 : 3 : 5 : 7 pattern is visible.
 */
export function strobeStep(tf) {
  for (const dt of [1, 0.5, 0.25, 0.2, 0.1, 0.05]) if (Math.floor(tf / dt + 1e-9) >= 4) return dt;
  return 0.05;
}

/** Slow-motion factor (1, ½, ¼, 1/10) so a flight lasts at least `minSec` on screen. */
export function slowFactor(tf, minSec = 2.8) {
  for (const s of [1, 0.5, 0.25, 0.1]) if (tf / s >= minSec) return s;
  return 0.1;
}

/** fmt with a true minus sign. */
export function num(n, digits = 1, decimal = '.') {
  return fmt(n, digits, decimal).replace('-', '−');
}

/** Trims to at most `max` decimals: 2 → "2", 0.5 → "0.5", 0.25 → "0.25". */
export function trim(n, decimal = '.', max = 2) {
  for (let k = 0; k <= max; k += 1) if (Math.abs(n * 10 ** k - Math.round(n * 10 ** k)) < 1e-9) return num(n, k, decimal);
  return num(n, max, decimal);
}

/** Decimals for a length: 2 below 1 m, else 1. */
export function lenDigits(v) {
  return Math.abs(v) < 1 - 1e-9 ? 2 : 1;
}

/** A length with sensible decimals. */
export function len(v, decimal = '.') {
  return num(v, lenDigits(v), decimal);
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

/* ------------------------------------------------------------- controls */

/** Start / Pause / Resume / Again + Reset, in the reference's size. */
export function PlayControls({ labels, running, done, started, onToggle, onReset, disabled, className = '' }) {
  return (
    <div className={`grid grid-cols-2 gap-2 xl:flex ${className}`}>
      <Btn variant="primary" icon={running ? Pause : Play} onClick={onToggle} disabled={disabled} className="xl:min-w-[160px] min-h-[52px] text-[15px]">
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

/* ------------------------------------------------------------ rich text */

const SUBS = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', ₓ: 'x' };

/**
 * Renders subscripts as real <sub> elements: "v₀", "Δy₁", "vₓ" and the
 * markers "v_x" / "v_y" (there is no Unicode subscript y). Digits outside
 * subscripts are set upright so formulas in the serif italic stay legible.
 */
export function Rich({ children }) {
  if (typeof children !== 'string') return children ?? null;
  const parts = [];
  let buf = '';
  let digits = '';
  const flushBuf = () => {
    if (buf) parts.push(buf);
    buf = '';
  };
  const flushDigits = () => {
    if (digits) parts.push(<span key={parts.length} className="font-sans not-italic">{digits}</span>);
    digits = '';
  };
  const sub = (s) => {
    flushBuf();
    flushDigits();
    parts.push(
      <sub key={parts.length} className="text-[0.72em] not-italic">
        {s}
      </sub>,
    );
  };
  const chars = [...children];
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    if (SUBS[ch]) sub(SUBS[ch]);
    else if (ch === '_' && /[a-z0-9]/i.test(chars[i + 1] ?? '')) {
      sub(chars[i + 1]);
      i += 1;
    } else if (/[0-9]/.test(ch) || (digits && /[.,]/.test(ch) && /[0-9]/.test(chars[i + 1] ?? ''))) {
      flushBuf();
      digits += ch;
    } else {
      flushDigits();
      buf += ch;
    }
  }
  flushDigits();
  flushBuf();
  return <>{parts}</>;
}

/** A formula card: tag, the general formula, the numbers put in, the result. */
export function FormulaTile({ tag, color = '#22d3ee', general, filled, result, ok, dim }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 transition-colors ${ok ? 'bg-emerald-400/[0.06]' : 'bg-black/25'} ${dim ? 'opacity-50' : ''}`}
      style={{ borderColor: ok ? 'rgba(52,211,153,0.45)' : 'rgba(255,255,255,0.08)' }}
    >
      {tag && (
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden="true" />
          {tag}
        </p>
      )}
      <p className="mt-1 font-serif text-[16px] italic text-gray-100">
        <Rich>{general}</Rich>
      </p>
      {filled && (
        <p className="mt-0.5 text-[13px] tabular-nums text-gray-400">
          <Rich>{filled}</Rich>
        </p>
      )}
      {result && <p className="mt-1 text-lg font-bold tabular-nums text-white">{result}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

export function LegendItem({ color, label, kind = 'line', color2 }) {
  return (
    <li className="flex items-center gap-1.5">
      <svg width="20" height="10" aria-hidden="true" className="shrink-0">
        {kind === 'dash' && <line x1="1" y1="5" x2="19" y2="5" stroke={color} strokeWidth="2" strokeDasharray="4 3" />}
        {kind === 'dot' && <circle cx="10" cy="5" r="4" fill={color} />}
        {kind === 'dots' && (
          <>
            <circle cx="5" cy="5" r="3.5" fill={color} />
            <circle cx="15" cy="5" r="3.5" fill={color2} />
          </>
        )}
        {kind === 'ring' && <circle cx="10" cy="5" r="3.6" fill="#fff" stroke={color} strokeWidth="1.8" />}
        {(kind === 'line' || kind === 'arrow') && (
          <line x1="1" y1="5" x2={kind === 'arrow' ? 13 : 19} y2="5" stroke={color} strokeWidth="3" strokeLinecap="round" />
        )}
        {kind === 'arrow' && <path d="M19,5 L12,1 L12,9 Z" fill={color} />}
        {kind === 'box' && <rect x="3" y="1" width="14" height="8" rx="2" fill={color} />}
      </svg>
      <span>
        <Rich>{label}</Rich>
      </span>
    </li>
  );
}

/** A chip in the scene's top-right corner (time speed-up, score…). */
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
          <ul className="hidden sm:flex max-w-[72%] flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-[12px] text-slate-600 shadow-sm backdrop-blur">
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

/**
 * A true-scale view anchored at the bottom-left: world x = xMin sits at
 * `left` px, y = 0 (the ground) at `groundY` px; 1 m is `k` px both ways.
 */
export function fitView({ xMin = 0, xMax, yMax, left, right, top, groundY }) {
  const k = Math.max(1e-6, Math.min((right - left) / Math.max(1e-6, xMax - xMin), (groundY - top) / Math.max(1e-6, yMax)));
  return {
    k,
    groundY,
    sx: (x) => left + (x - xMin) * k,
    sy: (y) => groundY - y * k,
    wx: (px) => xMin + (px - left) / k,
    wy: (py) => (groundY - py) / k,
  };
}

/** Faint metre grid above the ground; vertical lines only right of `fromPx`. */
export function SceneGrid({ view, W, top = 0, step, fromPx = 0 }) {
  const lines = [];
  const x0 = Math.ceil(view.wx(fromPx) / step) * step;
  for (let x = x0; view.sx(x) <= W; x += step) {
    const px = view.sx(x);
    lines.push(<line key={`v${x.toFixed(4)}`} x1={px} x2={px} y1={top} y2={view.groundY} stroke={COL.grid} strokeWidth={1} />);
  }
  for (let y = step; view.sy(y) >= top; y += step) {
    const py = view.sy(y);
    lines.push(<line key={`h${y.toFixed(4)}`} x1={0} x2={W} y1={py} y2={py} stroke={COL.grid} strokeWidth={1} />);
  }
  return <g aria-hidden="true">{lines}</g>;
}

/** Decimals needed to print multiples of a grid step (2.5 → 1, 0.25 → 2). */
export function stepDigits(step) {
  for (let k = 0; k <= 3; k += 1) if (Math.abs(step * 10 ** k - Math.round(step * 10 ** k)) < 1e-6) return k;
  return 3;
}

/** Height numbers along the left edge (right-aligned at `x`) and the axis name. */
export function AxisY({ view, x, step, top, unit, decimal = '.', fs = 11 }) {
  const digits = stepDigits(step);
  const items = [];
  for (let y = 0; view.sy(y) >= top + 6; y += step) {
    items.push(
      <text key={y.toFixed(4)} x={x} y={view.sy(y) + 4} textAnchor="end" fontSize={fs} fill={COL.muted} fontWeight={y === 0 ? 700 : 400}>
        {fmt(y, digits, decimal)}
      </text>,
    );
  }
  return (
    <g aria-hidden="true">
      {items}
      {unit && (
        <text x={4} y={top - 6} fontSize={fs} fontWeight="700" fill={COL.muted}>
          {unit}
        </text>
      )}
    </g>
  );
}

/** Distance numbers at `y` for x ≥ 0 and the axis name at the right end. */
export function AxisX({ view, W, y, step, unit, decimal = '.', fs = 11, fromX = 0, color = COL.soilText }) {
  const digits = stepDigits(step);
  const unitW = unit ? textWidth(unit, fs, 700) + 14 : 0;
  const items = [];
  for (let x = Math.ceil(fromX / step) * step; view.sx(x) < W - unitW - 8; x += step) {
    const px = view.sx(x);
    if (px < 10) continue;
    items.push(
      <text key={x.toFixed(4)} x={px} y={y} textAnchor="middle" fontSize={fs} fill={color} fontWeight={Math.abs(x) < 1e-9 ? 700 : 500}>
        {fmt(x, digits, decimal)}
      </text>,
    );
  }
  return (
    <g aria-hidden="true">
      {items}
      {unit && (
        <text x={W - 8} y={y} textAnchor="end" fontSize={fs} fontWeight="700" fill={color}>
          {unit}
        </text>
      )}
    </g>
  );
}

/** The ground: a light-green strip under `groundY` with its edge line. */
export function Soil({ W, H, groundY }) {
  return (
    <g aria-hidden="true">
      <rect x={0} y={groundY} width={W} height={H - groundY} fill={COL.soil} />
      <line x1={0} x2={W} y1={groundY} y2={groundY} stroke={COL.soilLine} strokeWidth={2} />
    </g>
  );
}

/** A shaded ball. */
export function Ball({ cx, cy, r, color, stroke = '#1e1b4b' }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={color} stroke={stroke} strokeWidth={1.2} />
      <circle cx={cx - r * 0.32} cy={cy - r * 0.34} r={r * 0.34} fill="#fff" opacity={0.5} />
    </g>
  );
}

/** A stroboscope mark: where the ball was at one tick. */
export function StrobeRing({ cx, cy, r, color = COL.ink, opacity = 0.55 }) {
  return <circle cx={cx} cy={cy} r={r} fill="#fff" fillOpacity={0.9} stroke={color} strokeOpacity={opacity} strokeWidth={1.6} />;
}

/** SVG text with a halo and an optional subscript: base="v", sub="x". */
export function Sym({ x, y, base, sub, tail, color, fs = 13, anchor = 'start', italic = true, weight = 700 }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={fs}
      fontStyle={italic ? 'italic' : 'normal'}
      fontWeight={weight}
      fill={color}
      stroke="#fff"
      strokeWidth={3}
      paintOrder="stroke"
      strokeLinejoin="round"
    >
      {base}
      {sub && (
        <tspan fontSize={fs * 0.72} dy={fs * 0.28}>
          {sub}
        </tspan>
      )}
      {tail && (
        <tspan dy={sub ? -fs * 0.28 : 0} fontStyle="normal" className="tabular-nums">
          {tail}
        </tspan>
      )}
    </text>
  );
}

/** Plain SVG label with a white halo. */
export function Label({ x, y, text, color = COL.muted, fs = 11, anchor = 'middle', weight = 600 }) {
  if (!text) return null;
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={fs} fontWeight={weight} fill={color} stroke="#fff" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round" className="tabular-nums">
      {text}
    </text>
  );
}

/** A horizontal dimension line with arrowheads at both ends and a label in the middle. */
export function DimLine({ x1, x2, y, color, label, fs = 11, bg = '#fff' }) {
  const a = Math.min(x1, x2);
  const b = Math.max(x1, x2);
  if (b - a < 4) return null;
  const head = Math.min(7, (b - a) / 3);
  const w = textWidth(label ?? '', fs, 700) + 12;
  const mid = (a + b) / 2;
  const fits = b - a > w + 2 * head + 6;
  return (
    <g aria-hidden="true">
      <line x1={a} x2={b} y1={y} y2={y} stroke={color} strokeWidth={1.6} />
      <line x1={a} x2={a} y1={y - 6} y2={y + 6} stroke={color} strokeWidth={1.4} />
      <line x1={b} x2={b} y1={y - 6} y2={y + 6} stroke={color} strokeWidth={1.4} />
      <path d={`M${a},${y} l${head},${-head * 0.5} l0,${head} Z`} fill={color} />
      <path d={`M${b},${y} l${-head},${-head * 0.5} l0,${head} Z`} fill={color} />
      {label && (
        <>
          <rect x={fits ? mid - w / 2 : b + 6} y={y - fs / 2 - 4} width={w} height={fs + 8} rx={(fs + 8) / 2} fill={bg} stroke={color} strokeWidth={1} />
          <text x={fits ? mid : b + 6 + w / 2} y={y + fs * 0.36} textAnchor="middle" fontSize={fs} fontWeight="700" fill={color} className="tabular-nums">
            {label}
          </text>
        </>
      )}
    </g>
  );
}

/** A scale bar for velocity arrows: a green arrow of a round speed with its value. */
export function VelScale({ x, y, vk, label, fs = 11, color = COL.vel, anchor = 'end' }) {
  if (!(vk > 0)) return null;
  const step = niceStep(vk, 34); // a round speed whose arrow is at least 34 px long
  const len = step * vk;
  const x1 = anchor === 'end' ? x - len : x;
  return (
    <g aria-hidden="true">
      <Arrow x1={x1} y1={y} x2={x1 + len} y2={y} color={color} width={2.5} head={8} />
      <line x1={x1} x2={x1} y1={y - 5} y2={y + 5} stroke={color} strokeWidth={1.5} />
      <text x={x1 + len / 2} y={y - 8} textAnchor="middle" fontSize={fs} fontWeight="700" fill={color} className="tabular-nums">
        {label(step)}
      </text>
    </g>
  );
}

/**
 * Velocity of a thrown body drawn from its centre: the components vₓ and v_y
 * (dashed) and the vector v (solid), with the parallelogram's dotted sides.
 */
export function VelocityArrows({ px, py, vx, vy, vk, r, fs = 12, showComp = true, labels = true }) {
  const ax = vx * vk;
  const ay = vy * vk;
  const vLen = Math.hypot(ax, ay);
  if (vLen < 4) return null;
  const ux = ax / vLen;
  const uy = ay / vLen;
  const comp = showComp && ax > 6 && ay > 6;
  return (
    <g>
      {comp && (
        <>
          <line x1={px + ax} y1={py} x2={px + ax} y2={py + ay} stroke={COL.velLight} strokeWidth={1} strokeDasharray="2 3" />
          <line x1={px} y1={py + ay} x2={px + ax} y2={py + ay} stroke={COL.velLight} strokeWidth={1} strokeDasharray="2 3" />
          <Arrow x1={px} y1={py} x2={px + ax} y2={py} color={COL.velLight} width={2.25} head={9} dash="5 3" />
          <Arrow x1={px} y1={py} x2={px} y2={py + ay} color={COL.velLight} width={2.25} head={9} dash="5 3" />
        </>
      )}
      <Arrow x1={px + ux * (r * 0.4)} y1={py + uy * (r * 0.4)} x2={px + ax} y2={py + ay} color={COL.vel} width={3.25} head={12} />
      {labels && (
        <>
          <Sym x={px + ax + ux * 10 + 2} y={py + ay + uy * 10 + 5} base="v" color={COL.vel} fs={fs + 1} />
          {comp && <Sym x={px + ax + 4} y={py - 7} base="v" sub="x" color={COL.vel} fs={fs} />}
          {comp && <Sym x={px - 6} y={py + ay - 2} base="v" sub="y" color={COL.vel} fs={fs} anchor="end" />}
        </>
      )}
    </g>
  );
}
