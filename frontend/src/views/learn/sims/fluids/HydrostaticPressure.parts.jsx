import { useState } from 'react';
import { Check, Pause, Play, RotateCcw, Timer } from 'lucide-react';

import { Btn, Segmented, fmt, niceStep, textWidth, useElementSize, useRafLoop } from '../kit/ui';

/**
 * Pieces shared by the four labs of the lesson "Gidrostatik bosim"
 * (HydrostaticPressure): the liquids and their looks, the pressure colours,
 * number formatting with Pa / kPa / MPa, the light scene shell, formula
 * tiles, a dial gauge, a line graph for the dark panel and a damped value.
 * No words live here: every label arrives through props from the lesson's
 * TEXT table.
 */

export const G = 9.8; // m/s²
export const P0 = 101300; // Pa, normal atmospheric pressure

/**
 * The liquids of the lesson (kg/m³) and one look for each, the same in every
 * tab: water translucent blue, sea water teal, kerosene amber, mercury silver.
 */
export const LIQUIDS = {
  water: { rho: 1000, top: '#dbeafe', deep: '#60a5fa', edge: '#2563eb', alpha: 0.8, text: '#93c5fd', chip: '#3b82f6', jet: '#3b82f6' },
  sea: { rho: 1030, top: '#ccfbf1', deep: '#14b8a6', edge: '#0f766e', alpha: 0.82, text: '#5eead4', chip: '#14b8a6', jet: '#0d9488' },
  kerosene: { rho: 800, top: '#fef3c7', deep: '#f59e0b', edge: '#b45309', alpha: 0.78, text: '#fcd34d', chip: '#f59e0b', jet: '#d97706' },
  mercury: { rho: 13600, top: '#f8fafc', deep: '#94a3b8', edge: '#475569', alpha: 1, text: '#e2e8f0', chip: '#94a3b8', jet: '#64748b', metal: true },
};
export const LIQ_IDS = ['water', 'sea', 'kerosene', 'mercury'];

/** Colours of the pressures — the same in every tab of the lesson. */
export const PC = {
  hydro: '#dc2626', // hydrostatic pressure ρgh and pressure forces (force red)
  hydroText: '#fca5a5',
  atm: '#0284c7', // atmospheric pressure p₀
  atmText: '#7dd3fc',
  total: '#7c3aed', // total pressure p₀ + ρgh
  totalText: '#c4b5fd',
  weight: '#db2777', // weight of the liquid
  weightText: '#f9a8d4',
  ink: '#334155', // depth dimension lines
  vel: '#059669', // jet speed (velocity green)
  velText: '#6ee7b7',
};

/* ---------------------------------------------------------------- numbers */

/** fmt with a true minus sign. */
export function num(n, digits = 1, decimal = '.') {
  return fmt(n, digits, decimal).replace('-', '−');
}

/** fmt with the thousands grouped by a no-break space from 10 000 up: 98 000 · 2940. */
export function fmtG(n, digits = 0, decimal = '.') {
  const s = fmt(n, digits, '.');
  const neg = s.startsWith('-');
  const [i, f] = (neg ? s.slice(1) : s).split('.');
  const ii = i.length > 4 ? i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : i;
  return `${neg ? '−' : ''}${ii}${f !== undefined ? decimal + f : ''}`;
}

/** A pressure with a sensible unit: { v, u } — 980 Pa · 98.0 kPa · 3.13 MPa · 20.3 MPa · 111.1 MPa. */
export function fmtPress(p, T, decimal = '.') {
  const a = Math.abs(p);
  if (a < 1000) return { v: fmtG(p, 0, decimal), u: T.Pa };
  if (a < 1e6) return { v: fmtG(p / 1000, 1, decimal), u: T.kPa };
  return { v: fmtG(p / 1e6, a < 1e7 ? 2 : 1, decimal), u: T.MPa };
}

/** A force with a sensible unit: { v, u } — 29.4 N · 980 kN · 3.03 MN · 49.0 MN. */
export function fmtForce(F, T, decimal = '.') {
  const a = Math.abs(F);
  if (a < 1000) return { v: fmtG(F, a < 100 ? 1 : 0, decimal), u: T.N };
  if (a < 1e6) return { v: fmtG(F / 1000, 1, decimal), u: T.kN };
  return { v: fmtG(F / 1e6, a < 1e7 ? 2 : 1, decimal), u: T.MN };
}

/** "Nice" value ≥ v from the 1 / 1.2 / 1.5 / 2 / 2.5 / 3 / 4 / 5 / 6 / 8 × 10ⁿ series. */
export function niceCeil(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v - 1e-9) return m * p;
  return 10 * p;
}

/** How many numbered ticks a dial from 0 to `max` gets so that each step is a round number. */
export function niceMajor(max) {
  const nice = (v) => [1, 2, 2.5, 3, 4, 5].some((m) => Math.abs(v / 10 ** Math.floor(Math.log10(v)) - m) < 1e-9);
  return [5, 4, 6].find((n) => nice(max / n)) ?? 5;
}

/** Drops the underscore of p_A and subscript digits for screen readers. */
export function plain(s) {
  return String(s ?? '')
    .replace(/_(\w)/g, '$1')
    .replace(/₀/g, '0')
    .replace(/₁/g, '1')
    .replace(/₂/g, '2')
    .replace(/₃/g, '3');
}

/* ------------------------------------------------------------------ hooks */

/**
 * A value that follows `target` with a short damped approach (time constant
 * `tau` s) instead of jumping: liquid levels and gauge needles.
 */
export function useSmooth(target, tau = 0.16) {
  const [v, setV] = useState(target);
  const eps = 1e-4 * Math.max(1, Math.abs(target));
  useRafLoop(Math.abs(v - target) > eps, (dt) => {
    setV((cur) => {
      const nx = cur + (target - cur) * (1 - Math.exp(-dt / tau));
      return Math.abs(nx - target) <= eps ? target : nx;
    });
  });
  return Math.abs(v - target) > eps ? v : target;
}

/* --------------------------------------------------------------- symbols */

const SUBS = { '₀': '0', '₁': '1', '₂': '2', '₃': '3' };

/** Renders "p₀", "h₁", "F_A" with real subscripts in HTML. */
export function Rich({ children }) {
  if (typeof children !== 'string') return children ?? null;
  const out = [];
  let buf = '';
  const flush = () => {
    if (buf) out.push(buf);
    buf = '';
  };
  for (let i = 0; i < children.length; i += 1) {
    const ch = children[i];
    if (ch === '_' && i + 1 < children.length && /[a-zA-Z0-9]/.test(children[i + 1])) {
      flush();
      out.push(
        <sub key={out.length} className="text-[0.72em]">
          {children[i + 1]}
        </sub>,
      );
      i += 1;
    } else if (SUBS[ch]) {
      flush();
      out.push(
        <sub key={out.length} className="text-[0.72em] not-italic">
          {SUBS[ch]}
        </sub>,
      );
    } else buf += ch;
  }
  flush();
  return <>{out}</>;
}

/** The SVG twin of Rich: subscripts as shifted <tspan>s. Put inside a <text>. */
export function SvgRich({ text, fs = 12 }) {
  const s = String(text ?? '');
  const out = [];
  let buf = '';
  let shifted = false;
  const flush = () => {
    if (!buf) return;
    out.push(
      <tspan key={out.length} dy={shifted ? -fs * 0.28 : undefined}>
        {buf}
      </tspan>,
    );
    shifted = false;
    buf = '';
  };
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    const sub = ch === '_' && i + 1 < s.length && /[a-zA-Z0-9]/.test(s[i + 1]) ? s[i + 1] : SUBS[ch];
    if (sub) {
      flush();
      out.push(
        <tspan key={out.length} dy={shifted ? 0 : fs * 0.28} fontSize={fs * 0.74}>
          {sub}
        </tspan>,
      );
      shifted = true;
      if (ch === '_') i += 1;
    } else buf += ch;
  }
  if (buf) flush();
  else if (shifted) out.push(<tspan key={out.length} dy={-fs * 0.28} />);
  return <>{out}</>;
}

/** A label pill whose text may carry subscripts; clamped inside `box`. */
export function RichPill({ x, y, text, bg, color = '#fff', size = 12, weight = 600, box, anchor = 'middle' }) {
  if (!text) return null;
  const w = textWidth(plain(text), size, weight) + 16;
  const h = size + 10;
  let left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  let top = y - h / 2;
  if (box) {
    left = Math.min(Math.max(left, 4), box.w - w - 4);
    top = Math.min(Math.max(top, 4), box.h - h - 4);
  }
  return (
    <g pointerEvents="none">
      <rect x={left} y={top} width={w} height={h} rx={h / 2} fill={bg} />
      <text x={left + w / 2} y={top + h / 2 + size * 0.35} textAnchor="middle" fontSize={size} fontWeight={weight} fill={color}>
        <SvgRich text={text} fs={size} />
      </text>
    </g>
  );
}

/* -------------------------------------------------------------- controls */

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

/** ×1 / ×½ / ×¼ time-speed chips. */
export function SpeedPicker({ label, value, onChange }) {
  return (
    <div>
      <p className="mb-1.5 text-sm text-gray-300">{label}</p>
      <Segmented
        label={label}
        className="grid-cols-3"
        value={value}
        onChange={onChange}
        accent="#22d3ee"
        options={[
          { value: 1, label: '×1' },
          { value: 0.5, label: '×½' },
          { value: 0.25, label: '×¼' },
        ]}
      />
    </div>
  );
}

/** Small caption above a group of chips. */
export function GroupLabel({ children }) {
  return <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{children}</p>;
}

/** An on/off switch drawn like the Segmented chips (aria-pressed). */
export function ToggleChip({ label, sub, on, onChange, accent = '#fb923c', disabled }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      style={on ? { borderColor: `${accent}99`, background: `${accent}1f` } : undefined}
      className={`flex w-full min-h-11 items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 disabled:opacity-40 disabled:cursor-not-allowed ${
        on ? 'text-white' : 'border-white/10 bg-white/[0.035] text-gray-300 hover:bg-white/[0.08]'
      }`}
    >
      <span
        className="grid h-5 w-5 shrink-0 place-items-center rounded-md border"
        style={on ? { background: accent, borderColor: accent } : { borderColor: 'rgba(255,255,255,0.3)' }}
        aria-hidden="true"
      >
        {on && <Check size={14} strokeWidth={3} className="text-slate-950" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-tight">{label}</span>
        {sub && <span className="mt-0.5 block text-[11px] leading-tight text-gray-400">{sub}</span>}
      </span>
    </button>
  );
}

/* ---------------------------------------------------------------- scene */

export function LegendItem({ color, label, kind = 'line' }) {
  return (
    <li className="flex items-center gap-1.5">
      <svg width="20" height="10" aria-hidden="true" className="shrink-0">
        {kind === 'dash' && <line x1="1" y1="5" x2="19" y2="5" stroke={color} strokeWidth="2" strokeDasharray="4 3" />}
        {kind === 'dot' && <circle cx="10" cy="5" r="4" fill={color} />}
        {kind === 'swatch' && <rect x="2" y="0.5" width="16" height="9" rx="2" fill={color} stroke="#64748b" strokeWidth="0.6" />}
        {kind === 'dim' && (
          <>
            <line x1="10" y1="1" x2="10" y2="9" stroke={color} strokeWidth="2" />
            <line x1="6" y1="1" x2="14" y2="1" stroke={color} strokeWidth="1.5" />
            <line x1="6" y1="9" x2="14" y2="9" stroke={color} strokeWidth="1.5" />
          </>
        )}
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

/** A chip in the scene's top-right corner (time speed-up, arrow scale …). */
export function Chip({ icon: Icon = Timer, children, color = '#0891b2' }) {
  return (
    <span className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[11px] sm:text-[12px] font-medium tabular-nums text-slate-600 shadow-sm">
      {Icon && <Icon size={14} style={{ color }} aria-hidden="true" />}
      <span>
        <Rich>{children}</Rich>
      </span>
    </span>
  );
}

/**
 * The light scene panel of the chosen design. `height(W, narrow)` sizes the
 * drawing; `children(W, H, narrow)` draws it. The legend floats over the top
 * from `sm` up and moves under the scene on phones.
 */
export function LabScene({ legend = [], chips, height, ariaLabel, children, minW = 280, className = '' }) {
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, minW);
  const narrow = W < 560;
  const H = Math.round(typeof height === 'function' ? height(W, narrow) : height);
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-300/70 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_30px_-12px_rgba(0,0,0,0.6)] ${className}`}
    >
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

/** A formula with its numbers put in: a coloured tag, the general form, the substituted line. */
export function FormulaTile({ tag, color = '#22d3ee', general, filled, ok }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 transition-colors ${ok ? 'bg-emerald-400/[0.06]' : 'bg-black/25'}`}
      style={{ borderColor: ok ? 'rgba(52,211,153,0.45)' : 'rgba(255,255,255,0.08)' }}
    >
      {tag && (
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden="true" />
          <span>
            <Rich>{tag}</Rich>
          </span>
        </p>
      )}
      <p className="mt-1 font-serif text-[15px] italic text-gray-200">
        <Rich>{general}</Rich>
      </p>
      {filled && (
        <p className="mt-0.5 text-[13px] tabular-nums text-gray-400 break-words">
          <Rich>{filled}</Rich>
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ SVG pieces */

/** Vertical fill of a liquid: light at the surface, deeper below; mercury gets a metal sheen. */
export function LiquidGrad({ id, liq, x1 = 0, y1 = 0, x2 = 0, y2 = 1 }) {
  if (liq.metal) {
    return (
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="0.25">
        <stop offset="0%" stopColor="#94a3b8" />
        <stop offset="18%" stopColor="#f1f5f9" />
        <stop offset="42%" stopColor="#cbd5e1" />
        <stop offset="70%" stopColor="#e2e8f0" />
        <stop offset="100%" stopColor="#64748b" />
      </linearGradient>
    );
  }
  return (
    <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
      <stop offset="0%" stopColor={liq.top} stopOpacity={liq.alpha} />
      <stop offset="100%" stopColor={liq.deep} stopOpacity={liq.alpha} />
    </linearGradient>
  );
}

/** A gently rippled surface line from x0 to x1 at y (amplitude `amp` px, phase `ph`). */
export function surfacePath(x0, x1, y, amp = 0, ph = 0, wl = 46) {
  if (amp < 0.05) return `M${x0.toFixed(1)},${y.toFixed(1)} L${x1.toFixed(1)},${y.toFixed(1)}`;
  const n = Math.max(2, Math.ceil((x1 - x0) / 6));
  let d = '';
  for (let i = 0; i <= n; i += 1) {
    const x = x0 + ((x1 - x0) * i) / n;
    const yy = y + amp * Math.sin((x / wl) * 2 * Math.PI + ph) * Math.sin((Math.PI * i) / n) ** 0.35;
    d += `${i ? 'L' : 'M'}${x.toFixed(1)},${yy.toFixed(2)}`;
  }
  return d;
}

/**
 * A dial gauge (manometer) with a light face: a 270° scale from 0 to `max`
 * with `major` numbered ticks, a needle at `value` and a caption inside.
 */
export function Dial({ cx, cy, r, value, max, major = 5, unit, caption, color = PC.hydro, decimal = '.', digits = 0, face = '#ffffff', labels = true }) {
  const a0 = (-225 * Math.PI) / 180;
  const sweep = (270 * Math.PI) / 180;
  const ang = (v) => a0 + (Math.min(Math.max(v, 0), max * 1.04) / max) * sweep;
  const pt = (a, rr) => ({ x: cx + rr * Math.cos(a), y: cy + rr * Math.sin(a) });
  const ticks = [];
  const minor = major * 5;
  for (let i = 0; i <= minor; i += 1) {
    const a = a0 + (i / minor) * sweep;
    const big = i % 5 === 0;
    const p1 = pt(a, r * (big ? 0.76 : 0.83));
    const p2 = pt(a, r * 0.9);
    ticks.push(<line key={`t${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#334155" strokeWidth={big ? 1.6 : 0.8} />);
    if (big && labels) {
      const pl = pt(a, r * 0.6);
      ticks.push(
        <text key={`l${i}`} x={pl.x} y={pl.y + r * 0.05} textAnchor="middle" fontSize={Math.max(8, r * 0.15)} fontWeight="600" fill="#475569">
          {fmtG((max * i) / minor, digits, decimal)}
        </text>,
      );
    }
  }
  const tip = pt(ang(value), r * 0.82);
  const tail = pt(ang(value) + Math.PI, r * 0.16);
  const arcR = r * 0.9;
  const s = pt(a0, arcR);
  const e = pt(ang(value), arcR);
  const large = ang(value) - a0 > Math.PI ? 1 : 0;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r + 5} fill="#cbd5e1" stroke="#64748b" strokeWidth={1.2} />
      <circle cx={cx} cy={cy} r={r} fill={face} stroke="#94a3b8" strokeWidth={1} />
      {value > max * 0.004 && (
        <path d={`M${s.x},${s.y} A${arcR},${arcR} 0 ${large} 1 ${e.x},${e.y}`} fill="none" stroke={color} strokeWidth={r * 0.07} strokeOpacity="0.28" />
      )}
      {ticks}
      {unit && (
        <text x={cx} y={cy + r * 0.42} textAnchor="middle" fontSize={Math.max(8, r * 0.16)} fontWeight="700" fill="#334155">
          {unit}
        </text>
      )}
      {caption && (
        <text x={cx} y={cy + r * 0.66} textAnchor="middle" fontSize={Math.max(7, r * 0.13)} fill="#64748b">
          <SvgRich text={caption} fs={Math.max(7, r * 0.13)} />
        </text>
      )}
      <line x1={tail.x} y1={tail.y} x2={tip.x} y2={tip.y} stroke={color} strokeWidth={Math.max(1.6, r * 0.045)} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={Math.max(3, r * 0.08)} fill="#1e293b" />
    </g>
  );
}

/* ------------------------------------------------------------ line graph */

/**
 * A line graph for the dark panel. `series` = [{ id, color, points: [{x,y}],
 * dash, width, opacity }]; `dots` = [{ id, x, y, color, label? }] mark
 * special points; `marker` draws a dashed vertical at x. Lines are clipped to
 * the plot so a steep series (mercury) leaves through the top edge.
 */
export function LineGraph({
  title,
  legend = [],
  series,
  dots = [],
  xMax,
  yMax,
  xLabel,
  yLabel,
  note,
  height = 220,
  decimal = '.',
  ariaLabel,
  marker,
  xDigits,
  yDigits,
  idKey = 'lg',
}) {
  const [ref, { width }] = useElementSize();
  const H = height;
  const pad = { l: 50, r: 14, t: 20, b: 26 };
  const W = Math.max(width, 220);
  const gx = (v) => pad.l + (v / xMax) * (W - pad.l - pad.r);
  const gy = (v) => H - pad.b - (v / yMax) * (H - pad.t - pad.b);
  const yStep = niceStep((H - pad.t - pad.b) / yMax, 34);
  const yTicks = [];
  for (let v = 0; v <= yMax + 1e-9; v += yStep) yTicks.push(v);
  const xStep = niceStep((W - pad.l - pad.r) / xMax, 56);
  const xTicks = [];
  for (let v = 0; v <= xMax + 1e-9; v += xStep) xTicks.push(v);
  const xd = xDigits ?? (xStep < 1 ? (xStep < 0.1 ? 2 : 1) : 0);
  const yd = yDigits ?? (yStep < 1 ? (yStep < 0.1 ? 2 : 1) : 0);
  const clipId = `${idKey}-clip`;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {title && (
          <p className="text-sm font-semibold text-gray-200">
            <Rich>{title}</Rich>
          </p>
        )}
        {legend.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-xs text-gray-400">
            <span
              className="w-4 rounded"
              style={s.dash ? { borderTop: `2px dashed ${s.color}`, height: 0 } : { background: s.color, height: 2 }}
              aria-hidden="true"
            />
            <span>
              <Rich>{s.label}</Rich>
            </span>
          </span>
        ))}
      </div>
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel ?? plain(title)} className="block overflow-visible">
          <defs>
            <clipPath id={clipId}>
              <rect x={pad.l} y={pad.t - 4} width={W - pad.l - pad.r + 4} height={H - pad.t - pad.b + 4} />
            </clipPath>
          </defs>
          {yTicks.map((v) => (
            <g key={`y${v}`}>
              <line x1={pad.l} x2={W - pad.r} y1={gy(v)} y2={gy(v)} stroke={v === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'} />
              <text x={pad.l - 6} y={gy(v) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                {fmtG(v, yd, decimal)}
              </text>
            </g>
          ))}
          {xTicks.map((v) => (
            <g key={`x${v}`}>
              <line x1={gx(v)} x2={gx(v)} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.05)" />
              <text x={gx(v)} y={H - 6} textAnchor="middle" fontSize="11" fill="#94a3b8">
                {fmtG(v, xd, decimal)}
              </text>
            </g>
          ))}
          {xLabel && (
            <text x={W - pad.r} y={H - pad.b - 6} textAnchor="end" fontSize="11" fill="#64748b">
              {xLabel}
            </text>
          )}
          {yLabel && (
            <text x={pad.l + 6} y={pad.t - 7} fontSize="11" fill="#64748b">
              {yLabel}
            </text>
          )}
          <line x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.2)" />
          {marker !== undefined && marker !== null && (
            <line x1={gx(marker)} x2={gx(marker)} y1={pad.t} y2={H - pad.b} stroke="rgba(34,211,238,0.45)" strokeDasharray="3 4" />
          )}
          <g clipPath={`url(#${clipId})`}>
            {series.map((s) => (
              <polyline
                key={s.id}
                points={s.points.map((p) => `${gx(p.x).toFixed(1)},${gy(p.y).toFixed(1)}`).join(' ')}
                fill="none"
                stroke={s.color}
                strokeWidth={s.width ?? 2.5}
                strokeDasharray={s.dash}
                strokeOpacity={s.opacity ?? 1}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
          </g>
          {dots
            .filter((d) => d.y <= yMax * 1.001 && d.x <= xMax * 1.001)
            .map((d) => (
              <g key={d.id}>
                <circle cx={gx(d.x)} cy={gy(d.y)} r={d.r ?? 4.5} fill={d.color} stroke="#0b0b16" strokeWidth="1.5" />
                {d.label && (
                  <text
                    x={Math.min(gx(d.x) + 8, W - pad.r - textWidth(d.label, 11, 600))}
                    y={gy(d.y) - 8}
                    fontSize="11"
                    fontWeight="600"
                    fill={d.textColor ?? '#cbd5e1'}
                  >
                    {d.label}
                  </text>
                )}
              </g>
            ))}
        </svg>
      </div>
      {note && (
        <p className="mt-1 text-xs leading-snug text-gray-500">
          <Rich>{note}</Rich>
        </p>
      )}
    </div>
  );
}
