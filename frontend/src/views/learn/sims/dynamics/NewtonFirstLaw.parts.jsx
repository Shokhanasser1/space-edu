import { memo } from 'react';
import { Lightbulb, Pause, Play, RotateCcw, Timer } from 'lucide-react';

import { Btn, Explain, clamp, fmt, niceStep, textWidth, useElementSize } from '../kit/ui';

/**
 * Drawing pieces for the lesson "Kuch. Nyutonning birinchi qonuni": the scene
 * shell of the chosen design (light lab paper, legend on top, chips on the
 * right, legend under the scene on phones), Start/Pause/Reset, a metre ruler,
 * labels with subscripts (F_ishq) for SVG and HTML, and number helpers.
 * No words live here — every label arrives through props.
 */

/* ------------------------------------------------------------- numbers */

/** fmt with a true minus sign. */
export function num(n, digits = 1, decimal = '.') {
  return fmt(n, digits, decimal).replace('-', '−');
}

/** fmt with an explicit sign: +2.5, −1.5, 0.0. */
export function signed(n, digits = 1, decimal = '.') {
  const s = num(n, digits, decimal);
  return n >= 0.5 * 10 ** -digits ? `+${s}` : s;
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

/**
 * The live explanation, re-rendered only when its key, text or tone change:
 * the simulators re-render every animation frame, and a re-render in the
 * middle of the text's exit animation kept restarting it.
 */
export const LiveExplain = memo(function LiveExplain({ id, tone, text }) {
  return (
    <Explain icon={Lightbulb} id={id} tone={tone}>
      {text}
    </Explain>
  );
});

/** Small caption above a group of chips. */
export function GroupLabel({ children }) {
  return <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{children}</p>;
}

/** A symbol with a subscript for HTML text: <Sym s="F" sub="ishq" /> → F with "ishq" below. */
export function Sym({ s, sub, className = '' }) {
  return (
    <span className={`whitespace-nowrap ${className}`}>
      <span className="font-serif italic">{s}</span>
      {sub && <sub className="text-[0.7em] not-italic">{sub}</sub>}
    </span>
  );
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
        {kind === 'arrow' && <path d="M19,5 L12,1 L12,9 Z" fill={color} />}
        {kind === 'box' && <rect x="3" y="1" width="14" height="8" rx="2" fill={color} />}
      </svg>
      <span>{label}</span>
    </li>
  );
}

/** A chip in the scene's top-right corner (time, scale…). */
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

/** A force-scale chip: a short arrow `px` long and its value. */
export function ScaleChip({ px, color, children }) {
  const w = Math.max(10, Math.round(px));
  return (
    <span className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[11px] sm:text-[12px] font-medium tabular-nums text-slate-600 shadow-sm">
      <svg width={w + 2} height="10" aria-hidden="true" className="shrink-0">
        <line x1="1" y1="5" x2={w - 5} y2="5" stroke={color} strokeWidth="2.5" />
        <path d={`M${w + 1},5 L${w - 6},1.5 L${w - 6},8.5 Z`} fill={color} />
        <line x1="1" y1="1.5" x2="1" y2="8.5" stroke={color} strokeWidth="1.5" />
      </svg>
      {children}
    </span>
  );
}

/**
 * The light scene panel of the chosen design. `height(W, narrow)` sizes the
 * drawing to the measured width; `children(W, H, narrow)` draws it. The
 * legend floats over the top-left from `sm` up and moves under the scene on
 * phones, so the top ~50 px (≈34 px on phones) should stay quiet.
 */
export function LabScene({ legend = [], chips, height, ariaLabel, children, minW = 280, below }) {
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, minW);
  const narrow = W < 560;
  const H = Math.round(typeof height === 'function' ? height(W, narrow) : height);
  const chipNode = typeof chips === 'function' ? chips(W, narrow) : chips;
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
            {legend.map((l, i) => (
              <LegendItem key={i} {...l} />
            ))}
          </ul>
        )}
        {chipNode && <div className="ml-auto flex flex-col items-end gap-1.5">{chipNode}</div>}
      </div>
      {legend.length > 0 && (
        <ul className="flex sm:hidden flex-wrap gap-x-3 gap-y-1 border-t border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          {legend.map((l, i) => (
            <LegendItem key={i} {...l} />
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

/** A metre ruler along y: ticks every `step`, numbers on the major ticks, the unit at the right end. */
export function Ruler({ view, W, y, step, unit, decimal = '.', digits = 0, color = '#475569', fs = 11, minorDiv = 0, labelEvery = 1 }) {
  const items = [];
  const first = Math.ceil(view.wx(0) / step) * step;
  const unitW = unit ? textWidth(unit, fs, 700) + 16 : 0;
  for (let x = first; x <= view.wx(W); x += step) {
    const i = Math.round(x / step);
    const px = view.sx(x);
    const major = i % labelEvery === 0;
    items.push(<line key={`t${i}`} x1={px} x2={px} y1={y} y2={y + (major ? 8 : 5)} stroke={color} strokeOpacity={major ? 0.9 : 0.5} strokeWidth={major ? 1.4 : 1} />);
    if (minorDiv > 1) {
      for (let m = 1; m < minorDiv; m += 1) {
        const mx = view.sx(x + (m * step) / minorDiv);
        if (mx < W) items.push(<line key={`m${i}-${m}`} x1={mx} x2={mx} y1={y} y2={y + 3} stroke={color} strokeOpacity={0.35} strokeWidth={1} />);
      }
    }
    if (major && px > 10 && px < W - unitW - 4) {
      items.push(
        <text key={`l${i}`} x={px} y={y + 20} textAnchor="middle" fontSize={fs} fill={color} fontWeight={Math.abs(x) < 1e-9 ? 700 : 500}>
          {num(x, digits, decimal)}
        </text>,
      );
    }
  }
  return (
    <g aria-hidden="true">
      <line x1={0} x2={W} y1={y} y2={y} stroke={color} strokeWidth={1.4} />
      {items}
      {unit && (
        <text x={W - 8} y={y + 20} textAnchor="end" fontSize={fs} fontWeight="700" fill={color}>
          {unit}
        </text>
      )}
    </g>
  );
}

/** Picks a ruler step so labels sit at least `minPx` apart. */
export function rulerStep(k, minPx = 64) {
  return niceStep(k, minPx);
}

/**
 * A rounded label pill for SVG whose text may carry subscripts:
 * parts = [{ t: 'F' }, { t: 'ishq', sub: true }, { t: ' = 2.45 N' }].
 * Clamped inside `box` = { w, h } when given. `anchor` 'middle' | 'start' | 'end'.
 */
export function TagPill({ x, y, parts, bg, color = '#fff', size = 12, box, anchor = 'middle', opacity = 1 }) {
  if (!parts?.length) return null;
  // SVG drops leading/trailing spaces of a <text>: keep them as no-break spaces
  parts = parts.map((p) => ({ ...p, t: p.t.replace(/^ +| +$/g, (m) => ' '.repeat(m.length)) }));
  const subSize = size * 0.74;
  const widths = parts.map((p) => textWidth(p.t, p.sub ? subSize : size, p.sub ? 600 : 650));
  const tw = widths.reduce((a, b) => a + b, 0);
  const w = tw + 16;
  const h = size + 10;
  let left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  let top = y - h / 2;
  if (box) {
    left = clamp(left, 4, box.w - w - 4);
    top = clamp(top, 4, box.h - h - 4);
  }
  const base = top + h / 2 + size * 0.35;
  let cx = left + 8;
  return (
    <g pointerEvents="none" opacity={opacity}>
      <rect x={left} y={top} width={w} height={h} rx={h / 2} fill={bg} />
      {parts.map((p, i) => {
        const el = (
          <text
            key={i}
            x={cx}
            y={p.sub ? base + size * 0.22 : base}
            fontSize={p.sub ? subSize : size}
            fontWeight={p.sub ? 600 : 650}
            fontStyle={p.italic ? 'italic' : undefined}
            fill={color}
          >
            {p.t}
          </text>
        );
        cx += widths[i];
        return el;
      })}
    </g>
  );
}

/** Pseudo-random 0…1 from an integer (stable decoration). */
export function hash01(i) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
