import { Check, Pause, Play, RotateCcw, Timer } from 'lucide-react';

import { Arrow, Btn, fmt, niceStep, useElementSize } from '../kit/ui';
import { PALETTE } from '../kit/scene';

/**
 * Pieces shared by the three labs of the lesson "Jismning og'irlik kuchi
 * ta'sirida tik harakati" (VerticalMotion): the scene shell of the chosen
 * design, Start/Pause/Reset, a formula tile, and the vertical lab paper —
 * a height ruler on the left, the ground, and an h(t) graph on the right
 * that shares the ruler's height scale, so the ball and its graph point sit
 * on the same horizontal line. No words live here; labels arrive via props.
 */

/** Free-fall acceleration used in every tab, m/s². */
export const G = 9.8;
/** Every run is shown at half speed. */
export const SLOW = 0.5;

/** Extra colours of this lesson (forces get their own, as in the dynamics brief). */
export const COL = {
  weight: '#dc2626', // og'irlik kuchi mg
  weightText: '#fca5a5',
  curve: '#2563eb', // h(t) on the paper
  ballA: '#db2777',
  ballB: '#2563eb',
};

/* ---------------------------------------------------------------- numbers */

/** fmt with a true minus sign. */
export function num(n, digits = 1, decimal = '.') {
  return fmt(n, digits, decimal).replace('-', '−');
}

/** Smallest multiple of `step` that is ≥ v. */
export function ceilTo(v, step) {
  return Math.ceil(v / step - 1e-9) * step;
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

/** Small caption above a group of chips. */
export function GroupLabel({ children }) {
  return <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{children}</p>;
}

/** An on/off switch drawn like the Segmented chips (aria-pressed). */
export function ToggleChip({ label, sub, on, onChange, accent = '#fb923c' }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      style={on ? { borderColor: `${accent}99`, background: `${accent}1f` } : undefined}
      className={`flex w-full min-h-11 items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 ${
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
        {kind === 'ring' && <circle cx="10" cy="5" r="3.5" fill="#fff" stroke={color} strokeWidth="2" />}
        {(kind === 'line' || kind === 'arrow') && (
          <line x1="1" y1="5" x2={kind === 'arrow' ? 13 : 19} y2="5" stroke={color} strokeWidth="3" strokeLinecap="round" />
        )}
        {kind === 'arrow' && <path d="M19,5 L12,1 L12,9 Z" fill={color} />}
      </svg>
      <span>{label}</span>
    </li>
  );
}

/** A chip in the scene's top-right corner (time slow-down …). */
export function Chip({ icon: Icon = Timer, children, color = '#0891b2' }) {
  return (
    <span className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[11px] sm:text-[12px] font-medium tabular-nums text-slate-600 shadow-sm">
      {Icon && <Icon size={14} style={{ color }} aria-hidden="true" />}
      {children}
    </span>
  );
}

/**
 * The light scene panel of the chosen design. `height(W, narrow)` sizes the
 * drawing; `children(W, H, narrow)` draws it. The legend floats over the top
 * from `sm` up and moves under the scene on phones.
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

const SUBS = { '₀': '0', '₁': '1', '₂': '2' };

/** Renders subscript digits (v₀) as real <sub> elements — the serif italic has no glyph for ₀. */
export function Rich({ children }) {
  if (typeof children !== 'string') return children ?? null;
  const parts = [];
  let buf = '';
  let run = '';
  const flushSub = () => {
    if (run) parts.push(<sub key={parts.length} className="text-[0.72em] not-italic">{run}</sub>);
    run = '';
  };
  let digits = '';
  const flushDigits = () => {
    if (digits) parts.push(<span key={parts.length} className="font-sans not-italic">{digits}</span>);
    digits = '';
  };
  const flushBuf = () => {
    if (buf) parts.push(buf);
    buf = '';
  };
  for (const ch of children) {
    if (SUBS[ch]) {
      flushBuf();
      flushDigits();
      run += SUBS[ch];
    } else if (/[0-9]/.test(ch) || (digits && /[.,]/.test(ch))) {
      flushSub();
      flushBuf();
      digits += ch;
    } else {
      flushSub();
      flushDigits();
      buf += ch;
    }
  }
  flushSub();
  flushDigits();
  flushBuf();
  return <>{parts}</>;
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
          {tag}
        </p>
      )}
      <p className="mt-1 font-serif text-[15px] italic text-gray-200">
        <Rich>{general}</Rich>
      </p>
      {filled && <p className="mt-0.5 text-[13px] tabular-nums text-gray-400">{filled}</p>}
    </div>
  );
}

/* ------------------------------------------------- vertical lab paper */

/**
 * Layout of a vertical-motion scene: world heights 0…hTop metres map onto
 * groundY…padT pixels; the h(t) graph spans plotX0…plotX1 for 0…tMax s.
 * `cols` = { ruler, plot0 } in px from the left; `ballCols` are free for
 * the caller.
 */
export function makeVView({ W, H, narrow, hTop, tMax, ruler, plot0 }) {
  const padT = narrow ? 66 : 84;
  const padB = 46;
  const groundY = H - padB;
  const k = (groundY - padT) / Math.max(hTop, 1e-6);
  const plotX0 = plot0;
  const plotX1 = W - (narrow ? 16 : 30);
  const pk = (plotX1 - plotX0) / Math.max(tMax, 1e-6);
  return {
    padT,
    groundY,
    k,
    rulerX: ruler,
    plotX0,
    plotX1,
    tMax,
    pk,
    gy: (m) => groundY - m * k,
    gx: (t) => plotX0 + t * pk,
  };
}

/** Time step of the graph's axis so its labels stay ≥ minPx apart. */
export function timeStep(pk, minPx = 44) {
  for (const s of [0.5, 1, 2, 5]) if (s * pk >= minPx) return s;
  return 10;
}

/**
 * Background of a vertical scene: paper lines at the ruler ticks, the height
 * ruler, the ground band, and the axes of the h(t) graph (time ticks under the
 * ground line, vertical paper lines at each tick).
 */
export function VerticalPaper({ view, W, H, fs, decimal, labels }) {
  const { groundY, padT, k, rulerX, plotX0, plotX1, gy, gx, tMax, pk } = view;
  const hTop = (groundY - padT) / k;
  const step = niceStep(k, 32);
  const ticks = [];
  for (let m = 0; m <= hTop + 1e-9; m += step) ticks.push(m);
  const tStep = timeStep(pk);
  const tTicks = [];
  for (let t = 0; t <= tMax + 1e-9; t += tStep) tTicks.push(t);
  const tDigits = tStep >= 1 ? 0 : 1;
  return (
    <g aria-hidden="true">
      <rect width={W} height={H} fill="#fbfcfe" />
      {ticks.map((m) => (
        <line key={`g${m}`} x1={rulerX} x2={W} y1={gy(m)} y2={gy(m)} stroke={PALETTE.grid} strokeWidth={1} />
      ))}
      {tTicks.map((t) => (
        <line key={`v${t}`} x1={gx(t)} x2={gx(t)} y1={padT - 14} y2={groundY} stroke={PALETTE.grid} strokeWidth={1} />
      ))}
      {/* height ruler */}
      <line x1={rulerX} x2={rulerX} y1={groundY} y2={padT - 18} stroke="#475569" strokeWidth={1.4} />
      {ticks.map((m) => (
        <g key={`t${m}`}>
          <line x1={rulerX - 6} x2={rulerX} y1={gy(m)} y2={gy(m)} stroke="#475569" strokeWidth={1.2} />
          <text x={rulerX - 9} y={gy(m) + 4} textAnchor="end" fontSize={fs - 1} fill="#475569">
            {fmt(m, Number.isInteger(Math.round(m * 1e6) / 1e6) ? 0 : 1, decimal)}
          </text>
        </g>
      ))}
      <text x={rulerX + 6} y={padT - 20} fontSize={fs - 1} fontWeight="700" fill="#475569">
        {labels.hAxis}
      </text>
      {/* graph axis */}
      <Arrow x1={plotX0} y1={groundY} x2={plotX0} y2={padT - 22} color="#475569" width={1.4} head={7} />
      <text x={plotX0 + 8} y={padT - 18} fontSize={fs} fontWeight="700" fill={COL.curve}>
        {labels.plot}
      </text>
      {/* ground */}
      <rect x={0} y={groundY} width={W} height={H - groundY} fill="#ecfccb" />
      <line x1={0} x2={W} y1={groundY} y2={groundY} stroke="#65a30d" strokeWidth={2} />
      <text x={rulerX - 9} y={groundY + 31} fontSize={fs - 1} fontWeight="700" fill="#3f6212">
        {labels.ground}
      </text>
      {tTicks.map((t) => (
        <g key={`tt${t}`}>
          <line x1={gx(t)} x2={gx(t)} y1={groundY} y2={groundY + 5} stroke="#3f6212" strokeWidth={1.2} />
          {gx(t) < plotX1 - 26 && (
            <text x={gx(t)} y={groundY + 18} textAnchor="middle" fontSize={fs - 1} fill="#3f6212" fontWeight={t === 0 ? 700 : 500}>
              {fmt(t, tDigits, decimal)}
            </text>
          )}
        </g>
      ))}
      <text x={plotX1} y={groundY + 18} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill="#3f6212">
        {labels.tAxis}
      </text>
    </g>
  );
}

/** Polyline points of h(t) for t in [t0, t1]. */
export function curvePoints(fn, t0, t1, view, n = 90) {
  if (t1 <= t0) return '';
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const t = t0 + ((t1 - t0) * i) / n;
    pts.push(`${view.gx(t).toFixed(1)},${view.gy(Math.max(0, fn(t))).toFixed(1)}`);
  }
  return pts.join(' ');
}

const BALL_TONES = {
  red: ['#fda4af', '#be123c', '#881337'],
  pink: ['#f9a8d4', '#db2777', '#831843'],
  blue: ['#93c5fd', '#2563eb', '#1e3a8a'],
};

/** Gradient definitions for the balls; put once in a scene. */
export function BallDefs() {
  return (
    <defs>
      {Object.entries(BALL_TONES).map(([id, [a, b]]) => (
        <radialGradient key={id} id={`vm-ball-${id}`} cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor={a} />
          <stop offset="100%" stopColor={b} />
        </radialGradient>
      ))}
    </defs>
  );
}

/** A ball whose bottom touches the height line `y` (px). */
export function Ball({ cx, y, r, tone = 'red', pulse, letter, ghost }) {
  const cy = y - r;
  const stroke = BALL_TONES[tone][2];
  if (ghost) return <circle cx={cx} cy={cy} r={r} fill="#fff" fillOpacity="0.6" stroke={stroke} strokeOpacity="0.55" strokeWidth={1.5} strokeDasharray="3 2" />;
  return (
    <g>
      {pulse && <circle cx={cx} cy={cy} r={r + 6} fill={BALL_TONES[tone][1]} className="cl-pulse" opacity="0.3" />}
      <circle cx={cx} cy={cy} r={r} fill={`url(#vm-ball-${tone})`} stroke={stroke} strokeWidth={1} />
      {letter && (
        <text x={cx} y={cy + r * 0.38} textAnchor="middle" fontSize={r * 1.05} fontWeight="800" fill="#fff">
          {letter}
        </text>
      )}
    </g>
  );
}

/** A vertical vector arrow at x from y1 to y2 with an italic symbol at its tip. */
export function VArrow({ x, y1, y2, color, label, side = 1, fs = 12, width = 3, head = 10, opacity = 1 }) {
  if (Math.abs(y2 - y1) < 4) return null;
  const dir = Math.sign(y2 - y1);
  return (
    <g opacity={opacity}>
      <Arrow x1={x} y1={y1} x2={x} y2={y2} color={color} width={width} head={head} />
      {label && (
        <text
          x={x + side * 7}
          y={y2 - dir * 2 + (dir > 0 ? 0 : fs * 0.7)}
          textAnchor={side > 0 ? 'start' : 'end'}
          fontSize={fs + 1}
          fontStyle="italic"
          fontWeight="700"
          fill={color}
          stroke="#fff"
          strokeWidth={3}
          paintOrder="stroke"
        >
          {label}
        </text>
      )}
    </g>
  );
}

/** A small slate pad on the ground the thrown ball starts from. */
export function LaunchPad({ x, y, r }) {
  return (
    <g aria-hidden="true">
      <rect x={x - r * 1.7} y={y - 3} width={r * 3.4} height={5} rx={2} fill="#475569" />
      <rect x={x - r * 0.9} y={y + 2} width={r * 1.8} height={4} rx={1} fill="#64748b" />
    </g>
  );
}

/** A plain multi-storey building standing on groundY, its roof at topY. */
export function Building({ x0, w, topY, groundY, floors }) {
  const floorH = (groundY - topY) / Math.max(1, floors);
  const rows = [];
  for (let i = 0; i < floors; i += 1) rows.push(i);
  return (
    <g aria-hidden="true">
      <rect x={x0} y={topY} width={w} height={groundY - topY} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={1.2} />
      {floorH >= 5 &&
        rows.map((i) => {
          const wy = topY + i * floorH + floorH * 0.3;
          const wh = Math.max(2, floorH * 0.42);
          return (
            <g key={i}>
              <rect x={x0 + w * 0.14} y={wy} width={w * 0.28} height={wh} rx={1} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={0.8} />
              <rect x={x0 + w * 0.58} y={wy} width={w * 0.28} height={wh} rx={1} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={0.8} />
            </g>
          );
        })}
      <rect x={x0 - 3} y={topY - 3} width={w + 6} height={4} rx={1.5} fill="#94a3b8" />
    </g>
  );
}
