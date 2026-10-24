import { Pause, Play, RotateCcw, Timer } from 'lucide-react';

import { Arrow, Btn, fmt, niceStep, useElementSize } from '../kit/ui';
import { PALETTE } from '../kit/scene';

/**
 * Drawing pieces of the sliding-friction lab (lesson "Sirpanish ishqalanish
 * kuchi"): the scene shell of the chosen design, Start/Pause/Reset, a metre
 * ruler, labelled force arrows, blocks and floors of different materials,
 * a lab weight and a formula tile. No words live here — every label arrives
 * through props from the TEXT table of SlidingFriction.jsx.
 */

/** Free-fall acceleration used throughout the lesson, m/s². */
export const G = 9.8;

/** One colour per kind of force, on the light scene and on the dark panels. */
export const FORCE = { mg: '#4338ca', N: '#0e7490', fr: '#dc2626', pull: '#c026d3' };
export const FORCE_TEXT = { mg: '#a5b4fc', N: '#67e8f9', fr: '#fca5a5', pull: '#f0abfc' };

/* ------------------------------------------------------------- numbers */

/** fmt with a true minus sign. */
export function num(n, digits = 1, decimal = '.') {
  return fmt(n, digits, decimal).replace('-', '−');
}

/** Rounds half up at `digits` decimals (1.225 → 1.23), then formats. */
export function round(n, digits = 2, decimal = '.') {
  const p = 10 ** digits;
  return num(Math.round(n * p + 1e-7) / p, digits, decimal);
}

/** Trims to at most `max` decimals: 25 → "25", 2.45 → "2.45", 0.196 → "0.196". */
export function trim(n, decimal = '.', max = 3) {
  for (let k = 0; k <= max; k += 1) {
    const v = Math.round(n * 10 ** k + 1e-7) / 10 ** k;
    if (Math.abs(n - v) < 1e-7) return num(v, k, decimal);
  }
  return round(n, max, decimal);
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

export function hash01(i) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/* ------------------------------------------------------------- controls */

/** Start / Pause / Resume / Again + Reset, in the reference's size. */
export function PlayControls({ labels, running, done, started, onToggle, onReset, startLabel, className = '' }) {
  return (
    <div className={`grid grid-cols-2 gap-2 xl:flex ${className}`}>
      <Btn variant="primary" icon={running ? Pause : Play} onClick={onToggle} className="xl:min-w-[148px] min-h-[52px] text-[15px]">
        {running ? labels.pause : done ? labels.again : started ? labels.resume : startLabel ?? labels.start}
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

/**
 * Text with subscripts: "v₀" and "F_{ishq}" become real <sub> elements (the
 * serif italic used for symbols has no glyph for ₀ and draws it like an "o").
 */
export function Rich({ children }) {
  if (typeof children !== 'string') return children ?? null;
  const parts = [];
  const re = /_\{([^}]*)\}|([₀₁₂])/g;
  let last = 0;
  let m = re.exec(children);
  while (m) {
    if (m.index > last) parts.push(children.slice(last, m.index));
    const sub = m[1] ?? { '₀': '0', '₁': '1', '₂': '2' }[m[2]];
    parts.push(
      <sub key={parts.length} className="text-[0.72em] not-italic">
        {sub}
      </sub>,
    );
    last = re.lastIndex;
    m = re.exec(children);
  }
  if (last < children.length) parts.push(children.slice(last));
  return <>{parts}</>;
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
        {kind === 'ghost' && <rect x="3" y="1" width="14" height="8" rx="1.5" fill="none" stroke={color} strokeWidth="1.3" strokeDasharray="2.5 2" />}
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

/** A chip in the scene's top-right corner (time speed-up, force scale…). */
export function Chip({ icon: Icon = Timer, children, color = '#0891b2' }) {
  return (
    <span className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[11px] sm:text-[12px] font-medium tabular-nums text-slate-600 shadow-sm">
      {Icon && <Icon size={14} style={{ color }} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** The force scale shown in a chip: a bar of `px` pixels and its value. */
export function ScaleBar({ px, label }) {
  const w = Math.max(8, Math.round(px));
  return (
    <span className="flex items-center gap-1.5">
      <svg width={w + 2} height="10" aria-hidden="true">
        <line x1="1" y1="5" x2={w + 1} y2="5" stroke="#334155" strokeWidth="2" />
        <line x1="1" y1="1" x2="1" y2="9" stroke="#334155" strokeWidth="1.5" />
        <line x1={w + 1} y1="1" x2={w + 1} y2="9" stroke="#334155" strokeWidth="1.5" />
      </svg>
      {label}
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

/** Faint lab-paper grid over a band; vertical lines follow the ruler step. */
export function PaperGrid({ view, W, top, bottom, step, rowPx = 28 }) {
  const lines = [];
  const first = Math.ceil(view.wx(0) / step) * step;
  for (let x = first; x <= view.wx(W); x += step) {
    const px = view.sx(x);
    lines.push(<line key={`v${x.toFixed(4)}`} x1={px} x2={px} y1={top} y2={bottom} stroke={PALETTE.grid} strokeWidth={1} />);
  }
  for (let y = bottom; y >= top; y -= rowPx) {
    lines.push(<line key={`h${y}`} x1={0} x2={W} y1={y} y2={y} stroke={PALETTE.grid} strokeWidth={1} />);
  }
  return <g aria-hidden="true">{lines}</g>;
}

/** A metre ruler along y: ticks every `step`, numbers under them and the unit at the right end. */
export function Ruler({ view, W, y, step, unit, decimal = '.', fs = 11, color = '#475569', fromX = 0 }) {
  const items = [];
  const first = Math.ceil(Math.max(view.wx(fromX), view.wx(0)) / step) * step;
  const digits = step < 1 ? (step < 0.1 ? 2 : 1) : 0;
  const unitW = unit ? unit.length * fs * 0.62 + 14 : 0;
  for (let x = first; x <= view.wx(W); x += step) {
    const i = Math.round(x / step);
    const px = view.sx(x);
    items.push(<line key={`t${i}`} x1={px} x2={px} y1={y} y2={y + 7} stroke={color} strokeOpacity={0.9} strokeWidth={1.3} />);
    const half = view.sx(x + step / 2);
    if (half < W) items.push(<line key={`h${i}`} x1={half} x2={half} y1={y} y2={y + 4} stroke={color} strokeOpacity={0.45} strokeWidth={1} />);
    if (px > fromX + 6 && px < W - unitW - 6) {
      items.push(
        <text key={`l${i}`} x={px} y={y + 19} textAnchor="middle" fontSize={fs} fill={color} fontWeight={Math.abs(x) < 1e-9 ? 700 : 500}>
          {num(x, digits, decimal)}
        </text>,
      );
    }
  }
  return (
    <g aria-hidden="true">
      <line x1={fromX} x2={W} y1={y} y2={y} stroke={color} strokeWidth={1.3} />
      {items}
      {unit && (
        <text x={W - 8} y={y + 19} textAnchor="end" fontSize={fs} fontWeight="700" fill={color}>
          {unit}
        </text>
      )}
    </g>
  );
}

/** Picks the ruler step for a view so labels sit at least `minPx` apart. */
export function rulerStep(view, minPx = 64) {
  return niceStep(view.k, minPx);
}

/** A physics symbol in the scene: italic letter with an optional subscript, outlined in white. */
export function SvgSym({ x, y, main, sub, color, fs = 13, anchor = 'start' }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={fs} fontWeight="700" fill={color} stroke="#fff" strokeWidth={3.2} paintOrder="stroke" strokeLinejoin="round">
      <tspan fontStyle="italic">{main}</tspan>
      {sub && (
        <tspan fontSize={fs * 0.74} dy={fs * 0.3}>
          {sub}
        </tspan>
      )}
    </text>
  );
}

/**
 * A force (or velocity / acceleration) arrow from (x, y) by (dx, dy) px with
 * its symbol by the tip. `place` puts the label: 'right' | 'left' | 'above' | 'below'.
 */
export function VecArrow({ x, y, dx, dy, color, main, sub, fs = 13, place = 'right', width = 3, dash }) {
  const len = Math.hypot(dx, dy);
  const tx = x + dx;
  const ty = y + dy;
  const head = Math.max(6, Math.min(11, len * 0.55));
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
      {len >= 2 ? <Arrow x1={x} y1={y} x2={tx} y2={ty} color={color} width={width} head={head} dash={dash} /> : <circle cx={x} cy={y} r={2.5} fill={color} />}
      {main && <SvgSym x={lx} y={ly} main={main} sub={sub} color={color} fs={fs} anchor={anchor} />}
    </g>
  );
}

/* ------------------------------------------------------------ materials */

const MAT = {
  wood: { fill: '#e7b77d', stroke: '#9a6531', grain: '#c98e4f', text: '#5b3a17' },
  rubber: { fill: '#3f4651', stroke: '#111827', grain: '#565e6b', text: '#f8fafc' },
  steel: { fill: '#d5dde7', stroke: '#64748b', grain: '#f1f5f9', text: '#1e293b' },
};

/** A block seen from the side; (x, y) is its top-left corner. `ghost` draws a dashed outline only. */
export function Block({ x, y, w, h, kind = 'wood', label, fs = 11, ghost }) {
  const m = MAT[kind];
  if (ghost) return <rect x={x} y={y} width={w} height={h} rx={3} fill={m.fill} fillOpacity={0.12} stroke={m.stroke} strokeOpacity={0.45} strokeWidth={1.1} strokeDasharray="3 3" />;
  return (
    <g>
      <rect x={x + 2} y={y + 3} width={w} height={h} rx={3} fill="#0f172a" opacity="0.12" />
      <rect x={x} y={y} width={w} height={h} rx={3} fill={m.fill} stroke={m.stroke} strokeWidth={1.3} />
      {kind === 'wood' && (
        <g fill="none" stroke={m.grain} strokeWidth={1.1} opacity={0.9}>
          <path d={`M${x + 4},${y + h * 0.3} q${w * 0.25},${-h * 0.12} ${w * 0.5},0 t${w * 0.46},0`} />
          <path d={`M${x + 4},${y + h * 0.72} q${w * 0.3},${h * 0.1} ${w * 0.55},0 t${w * 0.4},0`} />
        </g>
      )}
      {kind === 'steel' && <rect x={x + 2} y={y + 2} width={w - 4} height={Math.max(2, h * 0.22)} rx={2} fill="#fff" opacity="0.6" />}
      {kind === 'rubber' &&
        Array.from({ length: Math.max(2, Math.floor(w / 9)) }, (_, i) => (
          <line key={i} x1={x + 5 + i * 9} x2={x + 5 + i * 9} y1={y + h - 4} y2={y + h - 1} stroke="#111827" strokeWidth={1.4} />
        ))}
      {label && (
        <text x={x + w / 2} y={y + h / 2 + fs * 0.36} textAnchor="middle" fontSize={fs} fontWeight="700" fill={m.text} className="tabular-nums">
          {label}
        </text>
      )}
    </g>
  );
}

const GROUND = {
  wood: { fill: '#f0dcbc', edge: '#a87a45' },
  dry: { fill: '#6b7280', edge: '#374151' },
  wet: { fill: '#4b5563', edge: '#1f2937' },
  ice: { fill: '#dbeafe', edge: '#60a5fa' },
  snow: { fill: '#f1f5f9', edge: '#94a3b8' },
};

/** A strip of floor seen from the side, its surface at y, `depth` px thick. */
export function Ground({ x0 = 0, x1, y, depth = 14, kind = 'wood', seed = 0 }) {
  const g = GROUND[kind];
  const items = [];
  const span = x1 - x0;
  if (kind === 'wood') {
    for (let px = x0 + 20 + hash01(seed) * 30; px < x1; px += 64) {
      items.push(<line key={`a${px}`} x1={px} x2={px} y1={y + 1} y2={y + depth / 2} stroke={g.edge} strokeOpacity={0.45} strokeWidth={1} />);
      items.push(<line key={`b${px}`} x1={px + 32} x2={px + 32} y1={y + depth / 2} y2={y + depth} stroke={g.edge} strokeOpacity={0.45} strokeWidth={1} />);
    }
    items.push(<line key="mid" x1={x0} x2={x1} y1={y + depth / 2} y2={y + depth / 2} stroke={g.edge} strokeOpacity={0.3} strokeWidth={1} />);
  } else if (kind === 'dry' || kind === 'wet') {
    const n = Math.floor(span / 7);
    for (let i = 0; i < n; i += 1) {
      const px = x0 + hash01(i + seed * 31) * span;
      const py = y + 2 + hash01(i * 3 + seed) * (depth - 4);
      items.push(<circle key={`s${i}`} cx={px} cy={py} r={0.9 + hash01(i + 7) * 0.8} fill={kind === 'wet' ? '#64748b' : '#9ca3af'} />);
    }
    if (kind === 'wet') {
      items.push(<rect key="sheen" x={x0} y={y} width={span} height={3} fill="#93c5fd" opacity="0.55" />);
      for (let px = x0 + 30 + hash01(seed + 5) * 40; px < x1; px += 120) {
        items.push(<ellipse key={`p${px}`} cx={px} cy={y + 1.5} rx={22} ry={2} fill="#bfdbfe" opacity="0.8" />);
      }
    }
  } else if (kind === 'ice') {
    for (let px = x0 + 10 + hash01(seed) * 20; px < x1; px += 46) {
      items.push(<line key={`i${px}`} x1={px} x2={px + 16} y1={y + depth - 3} y2={y + 3} stroke="#fff" strokeWidth={1.6} strokeOpacity={0.9} />);
    }
    items.push(<rect key="hl" x={x0} y={y} width={span} height={2} fill="#fff" opacity="0.8" />);
  } else if (kind === 'snow') {
    for (let px = x0 + hash01(seed) * 10; px < x1; px += 18) {
      items.push(<circle key={`n${px}`} cx={px} cy={y + 1} r={4} fill="#fff" />);
    }
  }
  return (
    <g aria-hidden="true">
      <rect x={x0} y={y} width={span} height={depth} fill={g.fill} />
      {items}
      <line x1={x0} x2={x1} y1={y} y2={y} stroke={g.edge} strokeWidth={1.6} />
      <line x1={x0} x2={x1} y1={y + depth} y2={y + depth} stroke={g.edge} strokeOpacity={0.5} strokeWidth={1} />
    </g>
  );
}

/** A slotted lab weight (brass cylinder) seen from the side, standing on y, centred at cx. */
export function LabWeight({ cx, y, w, h }) {
  const ry = Math.max(1.5, h * 0.18);
  return (
    <g>
      <rect x={cx - w / 2} y={y - h} width={w} height={h} fill="#d4a72c" stroke="#92400e" strokeWidth={1} />
      <ellipse cx={cx} cy={y - h} rx={w / 2} ry={ry} fill="#f0c95b" stroke="#92400e" strokeWidth={1} />
      <rect x={cx - w / 2 + 2} y={y - h + ry} width={Math.max(2, w * 0.12)} height={Math.max(1, h - ry - 2)} fill="#fff" opacity="0.35" />
    </g>
  );
}

/** A small wheel (side view) with a spoke so its rotation shows; `rot` in degrees. */
export function Wheel({ cx, cy, r, rot = 0 }) {
  return (
    <g transform={`translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${rot.toFixed(1)})`}>
      <circle r={r} fill="#1e293b" />
      <circle r={r * 0.5} fill="#cbd5e1" />
      <line x1={-r * 0.85} x2={r * 0.85} y1={0} y2={0} stroke="#64748b" strokeWidth={Math.max(1, r * 0.18)} />
      <circle r={r * 0.15} fill="#334155" />
    </g>
  );
}
