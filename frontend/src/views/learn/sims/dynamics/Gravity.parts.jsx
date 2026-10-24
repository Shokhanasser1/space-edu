import { Pause, Play, RotateCcw, Timer } from 'lucide-react';

import { Btn, fmt, useElementSize } from '../kit/ui';

/**
 * Pieces shared by the three "Og'irlik kuchi" (gravity) labs: the scene
 * shell of the chosen design (light lab paper, legend chips on top, chips on
 * the right, the legend under the scene on phones), Start/Pause/Reset, a
 * formula tile, number helpers and the astronaut drawing. No words live
 * here — every label arrives through props.
 */

/* ------------------------------------------------------------- numbers */

/** fmt with a true minus sign. */
export function num(n, digits = 1, decimal = '.') {
  return fmt(n, digits, decimal).replace('-', '−');
}

/** Groups thousands with a thin space and keeps `digits` decimals: 35786 → "35 786". */
export function grouped(n, digits = 0, decimal = '.') {
  const s = num(n, digits, decimal);
  const [int, frac] = s.split(decimal);
  const g = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return frac !== undefined ? `${g}${decimal}${frac}` : g;
}

/** Three significant figures: 8.676 → "8.68", 0.2238 → "0.224", 0.002692 → "0.00269". */
export function sig3(n, decimal = '.') {
  if (!Number.isFinite(n) || n === 0) return num(0, 0, decimal);
  const d = Math.max(0, 2 - Math.floor(Math.log10(Math.abs(n))));
  return num(n, d, decimal);
}

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

/** 6.67·10⁻¹¹ — a number in standard form with the given decimal mark. */
export function sci(mantissa, exp, digits = 2, decimal = '.') {
  const e = String(exp)
    .split('')
    .map((c) => SUP[c] ?? c)
    .join('');
  return `${num(mantissa, digits, decimal)}·10${e}`;
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

/** A chip in the scene's top-right corner (time, scale…). */
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
 * drawing to the measured width; `children(W, H, narrow)` draws it. The
 * legend floats over the top-left from `sm` up and moves under the scene on
 * phones, so the top ~50 px (≈34 px on phones) should stay quiet.
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

/**
 * Renders subscript digits (g₀, v₀) as real <sub> elements: the serif
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

/** A formula in serif italic with the same formula filled in with numbers under it. */
export function FormulaTile({ tag, color = '#22d3ee', general, filled, note, ok }) {
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
      {filled && <p className="mt-0.5 text-[13px] leading-snug tabular-nums text-gray-300 break-words">{filled}</p>}
      {note && <p className="mt-1 text-xs leading-snug text-gray-500">{note}</p>}
    </div>
  );
}

/* -------------------------------------------------------------- figures */

/**
 * A front-facing astronaut in a white suit, feet at (x, y), `h` px tall.
 * `bend` (0…1) crouches the knees a little for a take-off or landing.
 */
export function Astronaut({ x, y, h, bend = 0, visor = '#1e3a8a' }) {
  const u = h / 1.8; // px per metre of the 1.8 m figure
  const knee = bend * 0.12 * u;
  const hipY = y - 0.86 * u + knee;
  const shoulderY = y - 1.42 * u + knee;
  const headY = y - 1.6 * u + knee;
  const legW = 0.14 * u;
  const torsoW = 0.46 * u;
  const stroke = '#475569';
  return (
    <g>
      {/* backpack peeking out at the sides */}
      <rect x={x - torsoW / 2 - 0.05 * u} y={shoulderY - 0.02 * u} width={torsoW + 0.1 * u} height={0.5 * u} rx={0.06 * u} fill="#cbd5e1" stroke={stroke} strokeWidth={1} />
      {/* legs */}
      {[-1, 1].map((s) => {
        const d = `M${x + s * 0.11 * u},${hipY} L${x + s * (0.15 * u + knee * 0.6)},${y - 0.44 * u + knee * 0.6} L${x + s * 0.15 * u},${y - 0.1 * u}`;
        return (
          <g key={s}>
            <path d={d} fill="none" stroke={stroke} strokeWidth={legW + 2.4} strokeLinecap="round" strokeLinejoin="round" />
            <path d={d} fill="none" stroke="#f8fafc" strokeWidth={legW} strokeLinecap="round" strokeLinejoin="round" />
            <rect x={x + s * 0.15 * u - 0.1 * u} y={y - 0.11 * u} width={0.2 * u} height={0.11 * u} rx={0.04 * u} fill="#64748b" />
          </g>
        );
      })}
      {/* arms */}
      {[-1, 1].map((s) => {
        const d = `M${x + s * (torsoW / 2 - 0.02 * u)},${shoulderY + 0.06 * u} L${x + s * (torsoW / 2 + 0.07 * u)},${shoulderY + 0.36 * u} L${x + s * (torsoW / 2 + 0.05 * u)},${shoulderY + 0.62 * u}`;
        return (
          <g key={`a${s}`}>
            <path d={d} fill="none" stroke={stroke} strokeWidth={0.12 * u + 2.4} strokeLinecap="round" strokeLinejoin="round" />
            <path d={d} fill="none" stroke="#f1f5f9" strokeWidth={0.12 * u} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );
      })}
      {[-1, 1].map((s) => (
        <circle key={`g${s}`} cx={x + s * (torsoW / 2 + 0.05 * u)} cy={shoulderY + 0.64 * u} r={0.06 * u} fill="#94a3b8" />
      ))}
      {/* torso */}
      <rect x={x - torsoW / 2} y={shoulderY} width={torsoW} height={hipY - shoulderY + 0.06 * u} rx={0.1 * u} fill="#f8fafc" stroke={stroke} strokeWidth={1.2} />
      <rect x={x - 0.12 * u} y={shoulderY + 0.12 * u} width={0.24 * u} height={0.14 * u} rx={0.03 * u} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={0.8} />
      <circle cx={x - 0.06 * u} cy={shoulderY + 0.19 * u} r={0.025 * u} fill="#ef4444" />
      <circle cx={x + 0.03 * u} cy={shoulderY + 0.19 * u} r={0.025 * u} fill="#22c55e" />
      <rect x={x - torsoW / 2} y={hipY - 0.04 * u} width={torsoW} height={0.07 * u} fill="#cbd5e1" />
      {/* helmet */}
      <circle cx={x} cy={headY} r={0.2 * u} fill="#f8fafc" stroke={stroke} strokeWidth={1.2} />
      <rect x={x - 0.14 * u} y={headY - 0.1 * u} width={0.28 * u} height={0.18 * u} rx={0.08 * u} fill={visor} />
      <rect x={x - 0.1 * u} y={headY - 0.07 * u} width={0.08 * u} height={0.05 * u} rx={0.02 * u} fill="#fff" opacity="0.55" />
    </g>
  );
}
