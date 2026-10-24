import { Pause, Play, RotateCcw, Timer } from 'lucide-react';

import { Arrow, Btn, fmt, niceStep, useElementSize } from '../kit/ui';
import { PALETTE } from '../kit/scene';

/**
 * Shared pieces of the lab "Jismga qo'yilgan kuchlarning ishi. Mexanik
 * energiyaning issiqlikka aylanishi": the scene shell of the chosen design,
 * Start/Pause/Reset, a metre ruler, labelled force arrows, a formula tile,
 * live energy bars with a constant-total line, an energy graph, a
 * thermometer and the glowing heat trail left by friction. No words live
 * here - every label arrives through props from the TEXT table of
 * FrictionWorkHeat.jsx.
 */

/** Free-fall acceleration used throughout the lesson, m/s². */
export const G = 9.8;

/** One colour per force, on the light scene and on the dark panels. */
export const FORCE = { mg: '#4338ca', N: '#0e7490', fr: '#dc2626' };
export const FORCE_TEXT = { mg: '#a5b4fc', N: '#67e8f9', fr: '#fca5a5' };

/** One colour per form of energy - the same in every tab. */
export const ENERGY = { k: '#10b981', p: '#3b82f6', q: '#f97316', tot: '#cbd5e1' };
export const ENERGY_TEXT = { k: '#6ee7b7', p: '#93c5fd', q: '#fdba74', tot: '#f1f5f9' };

/** Heat on the light scene (glowing trail, shimmer). */
export const HEAT = '#f97316';

/** Keyframes for the heat shimmer and the jiggling particles (CSS, so they keep moving after the run). */
export const HEAT_CSS = `
@keyframes fwh-rise{0%{transform:translateY(2px);opacity:0}25%{opacity:var(--o,.8)}100%{transform:translateY(-18px);opacity:0}}
.fwh-rise{animation:fwh-rise 1.7s ease-out infinite}
@keyframes fwh-jig{0%{transform:translate(0,0)}20%{transform:translate(calc(var(--a,1)*1px),calc(var(--a,1)*-.7px))}45%{transform:translate(calc(var(--a,1)*-.8px),calc(var(--a,1)*.6px))}70%{transform:translate(calc(var(--a,1)*.5px),calc(var(--a,1)*.9px))}100%{transform:translate(0,0)}}
.fwh-jig{animation:fwh-jig var(--d,.8s) linear infinite}
@keyframes fwh-glow{0%,100%{opacity:.55}50%{opacity:.9}}
.fwh-glow{animation:fwh-glow 1.4s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.fwh-rise,.fwh-jig,.fwh-glow{animation:none}}
`;

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

/** Trims to at most `max` decimals: 25 → "25", 2.45 → "2.45", 0.196 → "0.196". */
export function trim(n, decimal = '.', max = 3) {
  for (let k = 0; k <= max; k += 1) {
    const v = Math.round(n * 10 ** k + 1e-7) / 10 ** k;
    if (Math.abs(n - v) < 1e-7) return num(v, k, decimal);
  }
  return round(n, max, decimal);
}

/** An energy in joules with sensible decimals: 16 → "16.0", 588 → "588", 0.43 → "0.43". */
export function joule(n, decimal = '.') {
  const a = Math.abs(n);
  return round(n, a >= 100 ? 0 : a >= 10 ? 1 : 2, decimal);
}
const jouleFmt = joule;

/** Decimals for every energy of one run, chosen from its largest value (so digits do not jump mid-run). */
export function eDigits(ref) {
  return ref >= 100 ? 0 : ref >= 10 ? 1 : 2;
}

const NICE = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

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

/** Mixes two #rrggbb colours: f = 0 → a, f = 1 → b. */
export function mix(a, b, f) {
  const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a);
  const [r2, g2, b2] = p(b);
  const t = Math.min(1, Math.max(0, f));
  const h = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${h(r1, r2)}${h(g1, g2)}${h(b1, b2)}`;
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

/** The same for SVG text: tspans with a lowered, smaller subscript. */
export function SvgRich({ text, fs }) {
  const out = [];
  const re = /_\{([^}]*)\}|([₀₁₂])/g;
  let last = 0;
  let k = 0;
  let low = false;
  let m = re.exec(text);
  while (m) {
    if (m.index > last) {
      out.push(
        <tspan key={k++} dy={low ? -fs * 0.28 : undefined}>
          {text.slice(last, m.index)}
        </tspan>,
      );
      low = false;
    }
    const sub = m[1] ?? { '₀': '0', '₁': '1', '₂': '2' }[m[2]];
    out.push(
      <tspan key={k++} fontSize={fs * 0.72} dy={low ? 0 : fs * 0.28} fontStyle="normal">
        {sub}
      </tspan>,
    );
    low = true;
    last = re.lastIndex;
    m = re.exec(text);
  }
  if (last < text.length) {
    out.push(
      <tspan key={k++} dy={low ? -fs * 0.28 : undefined}>
        {text.slice(last)}
      </tspan>,
    );
  }
  return out;
}

/**
 * A formula with its numbers put in: a coloured tag, the general form, the
 * substituted line and the result. `ok` adds a green check style.
 */
export function FormulaTile({ tag, color = '#22d3ee', general, filled, result, ok, note }) {
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
      {note && (
        <p className="mt-0.5 text-[11px] leading-snug text-gray-500">
          <Rich>{note}</Rich>
        </p>
      )}
    </div>
  );
}

/** A small info box of three label / value pairs (the reference's "about the route" box). */
export function InfoBox({ title, items }) {
  return (
    <div className="rounded-xl bg-black/25 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{title}</p>
      <dl className={`mt-1.5 grid gap-2 text-center ${items.length === 4 ? 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-2' : 'grid-cols-3'}`}>
        {items.map(([k, v, c]) => (
          <div key={k}>
            <dt className="text-[11px] leading-tight text-gray-500">
              <Rich>{k}</Rich>
            </dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums" style={{ color: c }}>
              <Rich>{v}</Rich>
            </dd>
          </div>
        ))}
      </dl>
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
        {kind === 'heat' && (
          <>
            <rect x="1" y="6" width="18" height="3" rx="1.5" fill={color} opacity="0.85" />
            <path d="M5,5 q1.5,-2 0,-4 M10,5 q1.5,-2 0,-4 M15,5 q1.5,-2 0,-4" fill="none" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
          </>
        )}
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
export function LabScene({ legend = [], chips, height, ariaLabel, children, footer, minW = 280 }) {
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, minW);
  const narrow = W < 560;
  const H = Math.round(typeof height === 'function' ? height(W, narrow) : height);
  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl border border-slate-300/70 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_30px_-12px_rgba(0,0,0,0.6)]">
      <div ref={ref} className="w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="cl-scene block select-none">
          {width > 0 && children(W, H, narrow)}
        </svg>
      </div>
      {footer && (
        <div className="flex flex-1 items-center justify-center border-t border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700">{footer}</div>
      )}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 sm:p-3">
        {legend.length > 0 && (
          <ul className="hidden sm:flex max-w-[70%] flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-[12px] text-slate-600 shadow-sm backdrop-blur">
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

/**
 * The live energy equation along the foot of the scene (it also fills the
 * paper when the panel beside it is taller): a caption, then terms such as
 * E_k₀ = E_k + Q with their values, then an optional extra formula.
 * `terms` = [{ sym, value, color } | { op }].
 */
export function EqBand({ title, terms, extra }) {
  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-x-5 gap-y-2" aria-live="off">
      {title && <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</span>}
      <span className="flex flex-wrap items-end justify-center gap-x-2.5 gap-y-1">
        {terms.map((tm, i) =>
          tm.op ? (
            <span key={i} className="pb-0.5 text-xl font-light text-slate-400">
              {tm.op}
            </span>
          ) : (
            <span key={i} className="flex flex-col items-center leading-none">
              <span className="font-serif text-[13px] italic" style={{ color: tm.color }}>
                <Rich>{tm.sym}</Rich>
              </span>
              <span className="mt-1 text-lg sm:text-xl font-bold tabular-nums" style={{ color: tm.color }}>
                {tm.value}
              </span>
            </span>
          ),
        )}
      </span>
      {extra && (
        <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[13px] tabular-nums text-slate-600">
          <Rich>{extra}</Rich>
        </span>
      )}
    </div>
  );
}

/** Energy colours on the light scene (darker, for text on white). */
export const ENERGY_INK = { k: '#059669', p: '#2563eb', q: '#ea580c', tot: '#334155' };

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
 * A force (or velocity) arrow from (x, y) by (dx, dy) px with its symbol by
 * the tip. `place` puts the label: 'right' | 'left' | 'above' | 'below'.
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

/**
 * The glow friction leaves on a surface, from (x1, y1) to (x2, y2): a warm
 * strip and a few wisps of heat rising from it (CSS animation, so they keep
 * shimmering after the body has stopped). `level` 0…1 sets the brightness.
 */
export function HeatTrail({ x1, y1, x2, y2, level = 0.6, width = 4, spacing = 34, seed = 0 }) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 1.5) return null;
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const wisps = [];
  for (let d = spacing * (0.4 + 0.4 * hash01(seed)); d < len - 4; d += spacing) {
    const px = x1 + ux * d;
    const py = y1 + uy * d - width;
    const i = Math.round(d / spacing);
    wisps.push(
      <path
        key={i}
        d={`M${px.toFixed(1)},${py.toFixed(1)} q3,-4 0,-8 q-3,-4 0,-8`}
        fill="none"
        stroke={HEAT}
        strokeWidth={1.4}
        strokeLinecap="round"
        className="fwh-rise"
        style={{ '--o': 0.35 + 0.55 * level, animationDelay: `${(-hash01(i + seed * 7) * 1.7).toFixed(2)}s` }}
      />,
    );
  }
  return (
    <g pointerEvents="none" aria-hidden="true">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={HEAT} strokeOpacity={0.18 + 0.2 * level} strokeWidth={width + 8} strokeLinecap="round" />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={HEAT} strokeOpacity={0.45 + 0.5 * level} strokeWidth={width} strokeLinecap="round" />
      {level > 0.02 && wisps}
    </g>
  );
}

/**
 * A thermometer drawn on the light scene: tube from `top` down `h` px with a
 * bulb under it, filled to `value` on a min…max scale with ticks every `step`.
 */
export function Thermometer({ x, top, h, value, min, max, step, unit, decimal = '.', fs = 10, tubeW = 10 }) {
  const bulbR = tubeW * 0.95;
  const yOf = (v) => top + h - ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * h;
  const yv = yOf(value);
  const ticks = [];
  for (let v = min; v <= max + 1e-9; v += step) ticks.push(v);
  return (
    <g aria-hidden="true">
      <rect x={x - tubeW / 2 - 2} y={top - 4} width={tubeW + 4} height={h + 8} rx={(tubeW + 4) / 2} fill="#fff" stroke="#94a3b8" strokeWidth={1.2} />
      <circle cx={x} cy={top + h + bulbR * 0.85} r={bulbR + 2} fill="#fff" stroke="#94a3b8" strokeWidth={1.2} />
      <rect x={x - tubeW / 2 + 1.5} y={yv} width={tubeW - 3} height={top + h - yv + bulbR * 0.6} fill="#dc2626" />
      <circle cx={x} cy={top + h + bulbR * 0.85} r={bulbR - 0.5} fill="#dc2626" />
      <rect x={x - tubeW / 2 + 2.5} y={top} width={2} height={h} fill="#fff" opacity="0.6" />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={x + tubeW / 2 + 2} x2={x + tubeW / 2 + 7} y1={yOf(v)} y2={yOf(v)} stroke="#64748b" strokeWidth={1} />
          <text x={x + tubeW / 2 + 9} y={yOf(v) + fs * 0.35} fontSize={fs} fill="#475569" className="tabular-nums">
            {num(v, 0, decimal)}
          </text>
        </g>
      ))}
      {unit && (
        <text x={x} y={top - 9} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#334155">
          {unit}
        </text>
      )}
    </g>
  );
}

/* ---------------------------------------------------------- energy bars */

/**
 * Live energy bars on the dark panel. `items` = [{ id, label, value, color,
 * text }] are drawn side by side; the last, stacked bar piles the `stack`
 * ids on top of each other and always reaches the dashed line of the
 * constant total.
 */
export function EnergyBars({ items, stack, total, max, decimal = '.', digits, stackLabel, height = 200, ariaLabel }) {
  const joule = (v, d) => (digits === undefined ? jouleFmt(v, d) : round(v, digits, d));
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 200);
  const H = height;
  const pad = { l: 6, r: 6, t: 24, b: 34 };
  const n = items.length + 1;
  const slot = (W - pad.l - pad.r) / n;
  const bw = Math.min(48, slot * 0.62);
  const base = H - pad.b;
  const k = (H - pad.t - pad.b) / max;
  const yTot = base - total * k;
  const fs = 12;
  const cxOf = (i) => pad.l + slot * (i + 0.5);
  const stackItems = stack.map((id) => items.find((it) => it.id === id)).filter(Boolean);
  let acc = 0;
  return (
    <div ref={ref} className="w-full">
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="block overflow-visible">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={pad.l} x2={W - pad.r} y1={base - f * total * k} y2={base - f * total * k} stroke="rgba(255,255,255,0.06)" />
        ))}
        <line x1={pad.l + slot * items.length} x2={pad.l + slot * items.length} y1={pad.t - 6} y2={base} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 4" />
        {items.map((it, i) => {
          const v = Math.max(0, it.value);
          const h = v * k;
          const cx = cxOf(i);
          return (
            <g key={it.id}>
              <rect x={cx - bw / 2} y={pad.t - 4} width={bw} height={base - pad.t + 4} rx={6} fill="rgba(255,255,255,0.035)" />
              {h > 0.4 && <rect x={cx - bw / 2} y={base - h} width={bw} height={h} rx={Math.min(6, h / 2)} fill={it.color} />}
              <text x={cx} y={Math.min(base - h, yTot) - 7} textAnchor="middle" fontSize={fs} fontWeight="700" fill={it.text} className="tabular-nums">
                {joule(v, decimal)}
              </text>
              <text x={cx} y={base + 18} textAnchor="middle" fontSize={14} fontWeight="700" fill={it.text} fontStyle="italic" fontFamily="ui-serif, Georgia, serif">
                <SvgRich text={it.label} fs={14} />
              </text>
            </g>
          );
        })}
        {/* stacked bar: the total, made of its parts */}
        <g>
          {stackItems.map((it) => {
            const v = Math.max(0, it.value);
            const h = v * k;
            const y = base - (acc + v) * k;
            acc += v;
            return h > 0.3 ? <rect key={it.id} x={cxOf(items.length) - bw / 2} y={y} width={bw} height={h} fill={it.color} /> : null;
          })}
          <rect x={cxOf(items.length) - bw / 2} y={yTot} width={bw} height={base - yTot} rx={4} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={1.5} />
          <text x={cxOf(items.length)} y={yTot - 7} textAnchor="middle" fontSize={fs} fontWeight="700" fill={ENERGY_TEXT.tot} className="tabular-nums">
            {joule(total, decimal)}
          </text>
          <text x={cxOf(items.length)} y={base + 18} textAnchor="middle" fontSize={12} fontWeight="700" fill={ENERGY_TEXT.tot} fontStyle="italic" fontFamily="ui-serif, Georgia, serif">
            <SvgRich text={stackLabel} fs={12} />
          </text>
        </g>
        <line x1={pad.l} x2={W - pad.r} y1={yTot} y2={yTot} stroke="rgba(255,255,255,0.7)" strokeWidth={1.4} strokeDasharray="6 5" />
        <line x1={pad.l} x2={W - pad.r} y1={base} y2={base} stroke="rgba(255,255,255,0.3)" />
      </svg>
    </div>
  );
}

/** The dark panel beside the scene: a title row, the bars and whatever the tab adds under them. */
export function EnergyPanel({ title, unit, children }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-200">{title}</p>
        {unit && <span className="rounded-md border border-white/10 bg-black/30 px-2 py-0.5 text-[11px] font-semibold text-gray-400">{unit}</span>}
      </div>
      {children}
    </div>
  );
}

/** One line under the bars: a dashed swatch and the balance, e.g. "E_k + Q = 9.4 + 6.6 = 16.0 J". */
export function BalanceLine({ children }) {
  return (
    <p className="flex items-start gap-2 text-[13px] leading-snug tabular-nums text-gray-300">
      <svg width="18" height="10" className="mt-1 shrink-0" aria-hidden="true">
        <line x1="1" y1="5" x2="17" y2="5" stroke="rgba(255,255,255,0.75)" strokeWidth="1.6" strokeDasharray="4 3" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

/** "Work of each force" rows: a coloured symbol, the value, a short reason. */
export function WorkList({ title, rows }) {
  return (
    <div className="rounded-xl bg-black/25 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{title}</p>
      <ul className="mt-1.5 space-y-1">
        {rows.map((r) => (
          <li key={r.id} className="flex items-baseline gap-2 text-[13px] tabular-nums">
            <span className="w-16 shrink-0 font-serif italic" style={{ color: r.color }}>
              <Rich>{r.sym}</Rich>
            </span>
            <span className="whitespace-nowrap font-semibold text-white">
              <Rich>{r.value}</Rich>
            </span>
            <span className="ml-auto text-right text-[11px] leading-tight text-gray-500">
              <Rich>{r.note}</Rich>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------------------------------------- energy graph */

/**
 * Energy against position or time on the dark panel. Each series has a
 * dashed `plan` (the whole run, faint) and a solid `live` part up to now.
 */
export function EnergyGraph({ title, series, xMax, yMax, xLabel, yLabel, marker, note, decimal = '.', xDigits = 0, yDigits = 0, height = 210, ariaLabel }) {
  const [ref, { width }] = useElementSize();
  const H = height;
  const pad = { l: 46, r: 14, t: 18, b: 26 };
  const W = Math.max(width, 220);
  const gx = (v) => pad.l + (v / xMax) * (W - pad.l - pad.r);
  const gy = (v) => H - pad.b - (v / yMax) * (H - pad.t - pad.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const line = (pts) => pts.map((p) => `${gx(p.x).toFixed(1)},${gy(p.y).toFixed(1)}`).join(' ');
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {title && <p className="text-sm font-semibold text-gray-200">{title}</p>}
        {series.map((s) => (
          <span key={s.id} className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className={`w-4 ${s.dash ? 'border-t-2 border-dashed' : 'h-0.5 rounded'}`} style={s.dash ? { borderColor: s.color } : { background: s.color }} />
            <Rich>{s.label}</Rich>
          </span>
        ))}
      </div>
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel ?? title} className="block overflow-visible">
          {ticks.map((f) => (
            <g key={`y${f}`}>
              <line x1={pad.l} x2={W - pad.r} y1={gy(f * yMax)} y2={gy(f * yMax)} stroke={f === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'} />
              <text x={pad.l - 6} y={gy(f * yMax) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                {fmt(f * yMax, yDigits, decimal)}
              </text>
            </g>
          ))}
          {ticks.map((f) => (
            <text key={`x${f}`} x={gx(f * xMax)} y={H - 6} textAnchor="middle" fontSize="11" fill="#94a3b8">
              {fmt(f * xMax, xDigits, decimal)}
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
          {marker !== undefined && marker > 0 && (
            <line x1={gx(marker)} x2={gx(marker)} y1={pad.t} y2={H - pad.b} stroke="rgba(34,211,238,0.45)" strokeDasharray="3 4" />
          )}
          {series.map(
            (s) =>
              s.plan &&
              s.plan.length > 1 && (
                <polyline
                  key={`p-${s.id}`}
                  points={line(s.plan)}
                  fill="none"
                  stroke={s.color}
                  strokeOpacity={s.dash ? 0.85 : 0.32}
                  strokeWidth={s.dash ? 1.6 : 1.8}
                  strokeDasharray={s.dash ? '6 5' : '4 5'}
                />
              ),
          )}
          {series.map(
            (s) =>
              s.live &&
              s.live.length > 0 && (
                <g key={`l-${s.id}`}>
                  {s.live.length > 1 && (
                    <polyline points={line(s.live)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                  )}
                  <circle cx={gx(s.live[s.live.length - 1].x)} cy={gy(s.live[s.live.length - 1].y)} r="4" fill={s.color} stroke="#0b0b16" strokeWidth="1.5" />
                </g>
              ),
          )}
        </svg>
      </div>
      {note && (
        <p className="mt-1 text-xs text-gray-500">
          <Rich>{note}</Rich>
        </p>
      )}
    </div>
  );
}
