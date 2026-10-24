import { Pause, Play, RotateCcw, Timer } from 'lucide-react';

import { Arrow, Btn, clamp, fmt, groupThousands, useElementSize } from '../kit/ui';
import { PALETTE } from '../kit/scene';

/**
 * Drawing pieces of the momentum lab (lesson "Jism impulsi va kuch impulsi"):
 * the scene shell of the chosen design, Start/Pause/Reset, a metre ruler,
 * labelled vector arrows, a lab cart, a wall, formula tiles and an F–t /
 * p–t graph that can shade the area under a pulse. No words live here —
 * every label arrives through props from the TEXT table of Impulse.jsx.
 */

/** Free-fall acceleration, m/s². */
export const G = 9.8;

/**
 * One colour per quantity, on the light scene and on the dark panels:
 * momentum p indigo, change of momentum Δp pink, force red, velocity green.
 */
export const COL = {
  p: '#4f46e5',
  pText: '#a5b4fc',
  dp: '#db2777',
  dpText: '#f9a8d4',
  F: '#dc2626',
  FText: '#fca5a5',
  v: PALETTE.vel,
  vText: PALETTE.velText,
};

/* ------------------------------------------------------------- numbers */

/** fmt with a true minus sign. */
export function num(n, digits = 1, decimal = '.') {
  return fmt(n, digits, decimal).replace('-', '−');
}

/** Rounds to at most `max` decimals and drops trailing zeros: 25 → "25", 2.45 → "2.45". */
export function trim(n, decimal = '.', max = 3) {
  for (let k = 0; k <= max; k += 1) {
    const p = 10 ** k;
    const v = (Math.sign(n) * Math.round(Math.abs(n) * p + 1e-9)) / p;
    if (Math.abs(n - v) < 1e-7 * Math.max(1, Math.abs(n))) return num(v, k, decimal);
  }
  const p = 10 ** max;
  return num((Math.sign(n) * Math.round(Math.abs(n) * p + 1e-9)) / p, max, decimal);
}

/** A value of any size in a readable form: 20000 → "20 000", 10.75 → "10.75", 0.0045 → "0.0045". */
export function smart(n, decimal = '.') {
  const a = Math.abs(n);
  if (a >= 9999.5) return `${n < 0 ? '−' : ''}${groupThousands(a)}`;
  const max = a >= 100 ? 1 : a >= 10 ? 2 : a >= 0.1 ? 3 : a >= 0.01 ? 4 : 5;
  return trim(n, decimal, max);
}

const NICE = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** A "nice" axis maximum ≥ v that splits into `parts` round steps. */
export function niceMax(v, parts = 4) {
  const raw = Math.max(v, 1e-9) / parts;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = NICE.find((k) => k * p >= raw * (1 - 1e-9)) ?? 10;
  return m * p * parts;
}

/** Decimals needed to print multiples of `step`. */
export function digitsFor(step) {
  for (let k = 0; k <= 4; k += 1) if (Math.abs(step * 10 ** k - Math.round(step * 10 ** k)) < 1e-6) return k;
  return 4;
}

/** A round axis range covering [lo, hi] (0 included) in about `parts` steps. */
export function niceRange(lo, hi, parts = 4) {
  const a = Math.min(lo, 0);
  const b = Math.max(hi, 0);
  if (a === 0) {
    const top = niceMax(Math.max(b, 1e-6), parts);
    return { min: 0, max: top, step: top / parts };
  }
  if (b === 0) {
    const bot = niceMax(-a, parts);
    return { min: -bot, max: 0, step: bot / parts };
  }
  const raw = (b - a) / parts;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((k) => k * p >= raw * (1 - 1e-9)) ?? 10) * p;
  return { min: Math.floor(a / step + 1e-9) * step, max: Math.ceil(b / step - 1e-9) * step, step };
}

/** The member of `list` closest to `target` on a log scale (for slow-motion factors). */
export function pickNice(target, list) {
  return list.reduce((best, k) => (Math.abs(Math.log(k / target)) < Math.abs(Math.log(best / target)) ? k : best), list[0]);
}

/** A 1-2-5 step so that `pxPerUnit · step` is at least `minPx`. */
export function niceUnit(pxPerUnit, minPx) {
  const raw = minPx / Math.max(pxPerUnit, 1e-9);
  const p = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 5, 10]) if (m * p >= raw * (1 - 1e-9)) return m * p;
  return 10 * p;
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
 * Text with subscripts: "v₁" and "F_{o'rt}" become real <sub> elements (the
 * serif italic used for symbols has no glyph for ₁ and draws it oddly).
 */
export function Rich({ children }) {
  if (typeof children !== 'string') return children ?? null;
  const parts = [];
  const re = /_\{([^}]*)\}|([₀₁₂ₓ])/g;
  let last = 0;
  let m = re.exec(children);
  while (m) {
    if (m.index > last) parts.push(children.slice(last, m.index));
    const sub = m[1] ?? { '₀': '0', '₁': '1', '₂': '2', 'ₓ': 'x' }[m[2]];
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

/** A formula with its numbers put in: a coloured tag, the general form, the substituted line and the result. */
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

/** A dark panel of the lower area. */
export function Panel({ className = '', children }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4 ${className}`}>{children}</div>;
}

/** A small titled list of key numbers: items = [[term, value, colour]]. */
export function InfoBox({ title, items, cols = 'grid-cols-3' }) {
  return (
    <div className="rounded-xl bg-black/25 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{title}</p>
      <dl className={`mt-1.5 grid ${cols} gap-2 text-center`}>
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
        {kind === 'dasharrow' && (
          <>
            <line x1="1" y1="5" x2="13" y2="5" stroke={color} strokeWidth="2.4" strokeDasharray="3 2.5" />
            <path d="M19,5 L12,1 L12,9 Z" fill={color} opacity="0.6" />
          </>
        )}
        {kind === 'dot' && <circle cx="10" cy="5" r="4" fill={color} />}
        {kind === 'area' && <rect x="2" y="1" width="16" height="8" rx="1.5" fill={color} opacity="0.35" stroke={color} strokeWidth="1" />}
        {(kind === 'line' || kind === 'arrow') && (
          <line x1="1" y1="5" x2={kind === 'arrow' ? 13 : 19} y2="5" stroke={color} strokeWidth="3" strokeLinecap="round" />
        )}
        {kind === 'arrow' && <path d="M19,5 L12,1 L12,9 Z" fill={color} />}
      </svg>
      <span>
        <Rich>{label}</Rich>
      </span>
    </li>
  );
}

/** A chip in the scene's top-right corner (time slow-down, scales…). */
export function Chip({ icon: Icon = Timer, children, color = '#0891b2', strong }) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] sm:text-[12px] font-medium tabular-nums shadow-sm transition-colors ${
        strong ? 'border-cyan-300 bg-cyan-50 text-cyan-900' : 'border-slate-200 bg-white/90 text-slate-600'
      }`}
    >
      {Icon && <Icon size={14} style={{ color }} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** A scale shown in a chip: a bar of `px` pixels and its value. */
export function ScaleBar({ px, label, color = '#334155' }) {
  const w = Math.max(8, Math.round(px));
  return (
    <span className="flex items-center gap-1.5">
      <svg width={w + 2} height="10" aria-hidden="true">
        <line x1="1" y1="5" x2={w + 1} y2="5" stroke={color} strokeWidth="2" />
        <line x1="1" y1="1" x2="1" y2="9" stroke={color} strokeWidth="1.5" />
        <line x1={w + 1} y1="1" x2={w + 1} y2="9" stroke={color} strokeWidth="1.5" />
      </svg>
      <Rich>{label}</Rich>
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
    lines.push(<line key={`v${x.toFixed(5)}`} x1={px} x2={px} y1={top} y2={bottom} stroke={PALETTE.grid} strokeWidth={1} />);
  }
  for (let y = bottom; y >= top; y -= rowPx) {
    lines.push(<line key={`h${y}`} x1={0} x2={W} y1={y} y2={y} stroke={PALETTE.grid} strokeWidth={1} />);
  }
  return <g aria-hidden="true">{lines}</g>;
}

/** A metre ruler along y: ticks every `step`, numbers under them and the unit at the right end. */
export function Ruler({ view, W, y, step, unit, decimal = '.', fs = 11, color = '#475569' }) {
  const items = [];
  const first = Math.ceil(view.wx(0) / step) * step;
  const digits = digitsFor(step);
  const unitW = unit ? unit.length * fs * 0.62 + 14 : 0;
  for (let x = first; x <= view.wx(W); x += step) {
    const i = Math.round(x / step);
    const px = view.sx(x);
    items.push(<line key={`t${i}`} x1={px} x2={px} y1={y} y2={y + 7} stroke={color} strokeOpacity={0.9} strokeWidth={1.3} />);
    const half = view.sx(x + step / 2);
    if (half < W) items.push(<line key={`h${i}`} x1={half} x2={half} y1={y} y2={y + 4} stroke={color} strokeOpacity={0.45} strokeWidth={1} />);
    if (px > 10 && px < W - unitW - 6) {
      items.push(
        <text key={`l${i}`} x={px} y={y + 19} textAnchor="middle" fontSize={fs} fill={color} fontWeight={Math.abs(x) < 1e-9 ? 700 : 500}>
          {num(x, digits, decimal)}
        </text>,
      );
    }
  }
  return (
    <g aria-hidden="true">
      <line x1={0} x2={W} y1={y} y2={y} stroke={color} strokeWidth={1.3} />
      {items}
      {unit && (
        <text x={W - 8} y={y + 19} textAnchor="end" fontSize={fs} fontWeight="700" fill={color}>
          {unit}
        </text>
      )}
    </g>
  );
}

/** A physics symbol in the scene: italic letter with an optional subscript, outlined in white. */
export function SvgSym({ x, y, main, sub, color, fs = 13, anchor = 'start', after }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={fs} fontWeight="700" fill={color} stroke="#fff" strokeWidth={3.2} paintOrder="stroke" strokeLinejoin="round">
      <tspan fontStyle="italic">{main}</tspan>
      {sub && (
        <tspan fontSize={fs * 0.74} dy={fs * 0.3}>
          {sub}
        </tspan>
      )}
      {after && (
        <tspan dy={sub ? -fs * 0.3 : 0} fontWeight="600">
          {after}
        </tspan>
      )}
    </text>
  );
}

/**
 * A vector arrow from (x, y) by (dx, dy) px with its symbol by the tip.
 * `place`: 'right' | 'left' | 'above' | 'below'. A zero-length vector draws a dot.
 */
export function VecArrow({ x, y, dx, dy, color, main, sub, after, fs = 13, place = 'right', width = 3, dash, opacity = 1 }) {
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
    lx = x + dx / 2;
    ly = ty - 8;
    anchor = 'middle';
  } else if (place === 'below') {
    lx = x + dx / 2;
    ly = ty + fs + 5;
    anchor = 'middle';
  }
  return (
    <g opacity={opacity}>
      {len >= 2 ? <Arrow x1={x} y1={y} x2={tx} y2={ty} color={color} width={width} head={head} dash={dash} /> : <circle cx={x} cy={y} r={3} fill={color} />}
      {main && <SvgSym x={lx} y={ly} main={main} sub={sub} after={after} color={color} fs={fs} anchor={anchor} />}
    </g>
  );
}

/* ----------------------------------------------------------------- graph */

/**
 * A graph for the dark panels with shaded pulses: `series` = [{ id, color,
 * points: [{x, y}], fill?, fillOpacity?, dash?, width?, dot? }], a dashed
 * `threshold` = { y, label, color }, text `labels` = [{ x, y, text, color }]
 * in data units, vertical `brackets` = [{ x, y1, y2, color, label }] and a
 * time `marker`. `legend` = [{ color, label, kind }].
 */
export function PulseGraph({
  title,
  legend = [],
  series,
  xMin = 0,
  xMax,
  yMin = 0,
  yMax,
  xStep,
  yStep,
  xLabel,
  yLabel,
  marker,
  threshold,
  labels = [],
  brackets = [],
  height = 200,
  decimal = '.',
  ariaLabel,
  note,
}) {
  const [ref, { width }] = useElementSize();
  const H = height;
  const pad = { l: 46, r: 14, t: 20, b: 26 };
  const W = Math.max(width, 220);
  const gx = (v) => pad.l + ((v - xMin) / (xMax - xMin)) * (W - pad.l - pad.r);
  const gy = (v) => H - pad.b - ((v - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
  const xs = xStep ?? (xMax - xMin) / 4;
  const ys = yStep ?? (yMax - yMin) / 4;
  const xd = digitsFor(xs);
  const yd = digitsFor(ys);
  const xTicks = [];
  for (let i = 0; xMin + i * xs <= xMax + xs * 1e-6; i += 1) xTicks.push(xMin + i * xs);
  const yTicks = [];
  for (let i = 0; yMin + i * ys <= yMax + ys * 1e-6; i += 1) yTicks.push(yMin + i * ys);
  const base = gy(clamp(0, yMin, yMax));
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {title && (
          <p className="text-sm font-semibold text-gray-200">
            <Rich>{title}</Rich>
          </p>
        )}
        {legend.map((l) => (
          <span key={l.label} className="flex items-center gap-1.5 text-xs text-gray-400">
            {l.kind === 'area' ? (
              <span className="h-2.5 w-4 rounded-sm" style={{ background: `${l.color}55`, border: `1px solid ${l.color}` }} />
            ) : l.kind === 'dash' ? (
              <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: l.color }} />
            ) : (
              <span className="h-0.5 w-4 rounded" style={{ background: l.color }} />
            )}
            <Rich>{l.label}</Rich>
          </span>
        ))}
      </div>
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel ?? title} className="block overflow-visible">
          {yTicks.map((v) => (
            <g key={`y${v.toFixed(6)}`}>
              <line
                x1={pad.l}
                x2={W - pad.r}
                y1={gy(v)}
                y2={gy(v)}
                stroke={Math.abs(v) < 1e-9 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.08)'}
              />
              <text x={pad.l - 6} y={gy(v) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                {num(v, yd, decimal)}
              </text>
            </g>
          ))}
          {xTicks.map((v) => (
            <text key={`x${v.toFixed(6)}`} x={gx(v)} y={H - 6} textAnchor="middle" fontSize="11" fill="#94a3b8">
              {num(v, xd, decimal)}
            </text>
          ))}
          {xLabel && (
            <text x={W - pad.r} y={base - 6} textAnchor="end" fontSize="11" fill="#64748b">
              {xLabel}
            </text>
          )}
          {yLabel && (
            <text x={pad.l + 6} y={pad.t - 7} fontSize="11" fill="#64748b">
              {yLabel}
            </text>
          )}
          <line x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.2)" />
          {series
            .filter((s) => s.fill && s.points.length > 1)
            .map((s) => (
              <polygon
                key={`f-${s.id}`}
                points={[
                  `${gx(s.points[0].x).toFixed(1)},${base.toFixed(1)}`,
                  ...s.points.map((p) => `${gx(p.x).toFixed(1)},${gy(p.y).toFixed(1)}`),
                  `${gx(s.points[s.points.length - 1].x).toFixed(1)},${base.toFixed(1)}`,
                ].join(' ')}
                fill={s.fill}
                opacity={s.fillOpacity ?? 0.3}
              />
            ))}
          {threshold && threshold.y <= yMax && (
            <g>
              <line x1={pad.l} x2={W - pad.r} y1={gy(threshold.y)} y2={gy(threshold.y)} stroke={threshold.color} strokeWidth="1.5" strokeDasharray="6 4" />
              <text
                x={W - pad.r - 4}
                y={gy(threshold.y) - 5}
                textAnchor="end"
                fontSize="11"
                fontWeight="600"
                fill={threshold.color}
                stroke="#0b0b16"
                strokeWidth="3"
                paintOrder="stroke"
              >
                {threshold.label}
              </text>
            </g>
          )}
          {marker !== undefined && marker > xMin && marker < xMax && (
            <line x1={gx(marker)} x2={gx(marker)} y1={pad.t} y2={H - pad.b} stroke="rgba(34,211,238,0.5)" strokeDasharray="3 4" />
          )}
          {series.map((s) => (
            <g key={s.id}>
              {s.points.length > 1 && (
                <polyline
                  points={s.points.map((p) => `${gx(p.x).toFixed(1)},${gy(p.y).toFixed(1)}`).join(' ')}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={s.width ?? 2.5}
                  strokeDasharray={s.dash}
                  strokeOpacity={s.opacity ?? 1}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {s.dot && s.points.length > 0 && (
                <circle
                  cx={gx(s.points[s.points.length - 1].x)}
                  cy={gy(s.points[s.points.length - 1].y)}
                  r="4"
                  fill={s.color}
                  stroke="#0b0b16"
                  strokeWidth="1.5"
                />
              )}
            </g>
          ))}
          {brackets.map((b) => {
            const bx = gx(b.x);
            const right = bx < W - 90;
            return (
              <g key={`b${b.label}`}>
                <Arrow x1={bx} y1={gy(b.y1)} x2={bx} y2={gy(b.y2)} color={b.color} width={2.4} head={9} />
                <text
                  x={right ? bx + 7 : bx - 7}
                  y={(gy(b.y1) + gy(b.y2)) / 2 + 4}
                  textAnchor={right ? 'start' : 'end'}
                  fontSize="12"
                  fontWeight="700"
                  fill={b.color}
                  stroke="#0b0b16"
                  strokeWidth="3"
                  paintOrder="stroke"
                >
                  {b.label}
                </text>
              </g>
            );
          })}
          {labels.map((l) => (
            <text
              key={`l${l.text}`}
              x={clamp(gx(l.x), pad.l + 4, W - pad.r - 4)}
              y={gy(l.y)}
              textAnchor={l.anchor ?? 'middle'}
              fontSize={l.size ?? 12}
              fontWeight="700"
              fill={l.color}
              stroke="#0b0b16"
              strokeWidth="3"
              paintOrder="stroke"
            >
              {l.text}
            </text>
          ))}
        </svg>
      </div>
      {note && <p className="mt-1 text-xs leading-snug text-gray-500">{note}</p>}
    </div>
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
        <rect x={bx} y={by} width={g.bw} height={h} rx={2} fill="url(#imp-steel)" stroke="#475569" strokeWidth={1} />
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
        <linearGradient id="imp-steel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cbd5e1" />
          <stop offset="1" stopColor="#94a3b8" />
        </linearGradient>
      </defs>
      <ellipse cx={cx} cy={y + 1} rx={len * 0.46} ry={2.5} fill="#0f172a" opacity={0.12} />
      {blocks}
      <rect x={left} y={y + g.bodyTop} width={len} height={g.bodyH} rx={5} fill="#334155" />
      <rect x={left + 3} y={y + g.bodyTop + 2} width={len - 6} height={3} rx={1.5} fill="#64748b" />
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

/* ---------------------------------------------------------------- walls */

/** A concrete wall seen from the side or from above: a grey slab from x to x + w with speckles. */
export function ConcreteWall({ x, y, w, h, seed = 1 }) {
  const dots = [];
  const n = Math.max(6, Math.round((w * h) / 90));
  for (let i = 0; i < n; i += 1) {
    const a = Math.sin((i + 1) * 127.1 * seed + 311.7) * 43758.5453;
    const b = Math.sin((i + 1) * 269.5 * seed + 183.3) * 43758.5453;
    dots.push(<circle key={i} cx={x + 3 + (a - Math.floor(a)) * (w - 6)} cy={y + 3 + (b - Math.floor(b)) * (h - 6)} r={1.1} fill="#64748b" opacity={0.55} />);
  }
  return (
    <g aria-hidden="true">
      <rect x={x} y={y} width={w} height={h} fill="#cbd5e1" />
      {dots}
      <line x1={x} x2={x} y1={y} y2={y + h} stroke="#475569" strokeWidth={2} />
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="#94a3b8" strokeWidth={1} />
    </g>
  );
}
