import { useId } from 'react';
import { Pause, Play, RotateCcw, Timer } from 'lucide-react';
import { Arrow, Btn, Segmented, clamp, fmt, groupThousands, useElementSize } from '../kit/ui';
import { Paper } from '../kit/scene';

/**
 * Pieces shared by the simulators of the lesson "Law of universal
 * gravitation": the constants, number formatting for values that span
 * 10⁻¹¹…10³⁰, the light scene whose legend moves under the drawing on a
 * phone, toolbar / buttons / panels, a force arrow that shows a break when
 * it is too long to draw, and the drawn bodies (people, Earth, Moon, Sun).
 * No user-facing words live here: every string arrives through props.
 */

export const G = 6.67e-11; // N·m²/kg²
export const g = 9.8; // m/s²

export const COL = {
  force: '#dc2626',
  forceText: '#fca5a5',
  b1: '#0891b2',
  b1Text: '#a5f3fc',
  b2: '#db2777',
  b2Text: '#f9a8d4',
  acc: '#ea580c',
  accText: '#fdba74',
  ink: '#0f172a',
  muted: '#64748b',
  g: '#a78bfa',
  gText: '#ddd6fe',
};

/* ---------------------------------------------------------------- numbers */

function trimZeros(s, dec) {
  if (!s.includes(dec)) return s;
  let t = s;
  while (t.endsWith('0')) t = t.slice(0, -1);
  return t.endsWith(dec) ? t.slice(0, -1) : t;
}

/** About `sig` significant digits; 10 000 and above get grouped thousands. */
export function num(n, dec = '.', sig = 3) {
  if (!Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a < 1e-12) return '0';
  if (a >= 10000) return (n < 0 ? '-' : '') + groupThousands(a);
  const digits = clamp(sig - 1 - Math.floor(Math.log10(a)), 0, 6);
  return fmt(n, digits, dec);
}

/** `num` without trailing zeros: 0.250 → 0.25, 50.0 → 50. */
export function numt(n, dec = '.', sig = 3) {
  return trimZeros(num(n, dec, sig), dec);
}

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
export const sup = (e) =>
  String(e)
    .split('')
    .map((c) => SUP[c])
    .join('');

/** 6.67·10⁻¹¹ style for very large / very small numbers, plain digits for 0.01 … 9999. */
export function sci(n, dec = '.', sig = 3) {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) < 1e-300) return '0';
  let e = Math.floor(Math.log10(Math.abs(n)));
  if (e >= -2 && e <= 3) return numt(n, dec, sig);
  let m = n / 10 ** e;
  if (Math.abs(Number(m.toFixed(sig - 1))) >= 10) {
    m /= 10;
    e += 1;
  }
  return `${trimZeros(fmt(m, sig - 1, dec), dec)}·10${sup(e)}`;
}

/** A "nice" number ≥ x: 1, 2, 2.5, 5 × 10ⁿ. */
export function niceNum(x) {
  const p = 10 ** Math.floor(Math.log10(x));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= x - 1e-12 * p) return m * p;
  return 10 * p;
}

/** A time speed-up that reads well: 1, 2, 5 × 10ⁿ, at least `x`. */
export function niceScale(x) {
  if (x <= 1) return 1;
  const p = 10 ** Math.floor(Math.log10(x));
  for (const m of [1, 2, 5, 10]) if (m * p >= x - 1e-9) return m * p;
  return 10 * p;
}

/** A duration in seconds as { v, u }: 42 s, 18 min, 3.1 h or 4.8 days (units from the text table). */
export function durationParts(t, U, dec) {
  if (t < 120) return { v: numt(t, dec, 2), u: U.s };
  if (t < 7200) return { v: numt(t / 60, dec, 2), u: U.min };
  if (t < 172800) return { v: numt(t / 3600, dec, 2), u: U.h };
  return { v: numt(t / 86400, dec, 2), u: U.d };
}

/** A React id that is safe inside url(#…) references. */
export function useSvgId(prefix) {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/* ---------------------------------------------------------------- layout */

function LegendGlyph({ kind, color }) {
  if (kind === 'arrow')
    return (
      <svg width="18" height="8" aria-hidden="true">
        <line x1="1" y1="4" x2="12" y2="4" stroke={color} strokeWidth="2.5" />
        <path d="M17,4 L11,1 L11,7 Z" fill={color} />
      </svg>
    );
  if (kind === 'dash') return <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: color }} />;
  if (kind === 'dot') return <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />;
  if (kind === 'break')
    return (
      <svg width="18" height="10" aria-hidden="true">
        <line x1="1" y1="5" x2="17" y2="5" stroke={color} strokeWidth="2.5" />
        <line x1="6" y1="9" x2="9" y2="1" stroke="#fff" strokeWidth="2" />
        <line x1="10" y1="9" x2="13" y2="1" stroke="#fff" strokeWidth="2" />
      </svg>
    );
  return <span className="h-1 w-4 rounded" style={{ background: color }} />;
}

/**
 * The light scene: the kit's Paper in a bordered frame, its height a
 * function of the measured width. On a phone the legend moves below the
 * drawing so it never covers it.
 */
export function SimScene({ legend = [], chip, ariaLabel, height, overlay, children }) {
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 260);
  const narrow = W < 560;
  const H = Math.round(height(W, narrow));
  return (
    <div ref={ref} className="relative overflow-hidden rounded-2xl border border-slate-300/70 bg-white shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]">
      <Paper chip={chip} height={H} ariaLabel={ariaLabel}>
        {(w, h) => children(w, h, narrow)}
      </Paper>
      {!narrow && legend.length > 0 && (
        <ul className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[66%] flex-wrap items-center gap-x-3 gap-y-1 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] text-slate-600 shadow-sm">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5">
              <LegendGlyph kind={l.kind} color={l.color} />
              {l.label}
            </li>
          ))}
        </ul>
      )}
      {overlay}
      {narrow && legend.length > 0 && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5">
              <LegendGlyph kind={l.kind} color={l.color} />
              {l.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Chip content: an optional stopwatch line and a force-scale bar. */
export function ScaleChip({ time, forceBar }) {
  return (
    <>
      {time && (
        <>
          <Timer size={14} className="text-cyan-600" aria-hidden="true" />
          <span className="font-medium">{time}</span>
        </>
      )}
      {time && forceBar && <span className="text-slate-300">·</span>}
      {forceBar && (
        <span className="flex items-center gap-1.5 tabular-nums">
          <svg width={Math.round(forceBar.px) + 2} height="8" aria-hidden="true">
            <line x1="1" y1="4" x2={forceBar.px + 1} y2="4" stroke={COL.force} strokeWidth="3" strokeLinecap="round" />
            <line x1="1" y1="1" x2="1" y2="7" stroke={COL.force} strokeWidth="1.5" />
            <line x1={forceBar.px + 1} y1="1" x2={forceBar.px + 1} y2="7" stroke={COL.force} strokeWidth="1.5" />
          </svg>
          {forceBar.text}
        </span>
      )}
    </>
  );
}

/** Chips on the left, the play buttons on the right (stacked on a phone). */
export function Toolbar({ label, options, value, onChange, cols = 'grid-cols-2 md:grid-cols-4', accent, children }) {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
      <div className="min-w-0 flex-1">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{label}</p>
        <Segmented label={label} className={cols} size="lg" value={value} onChange={onChange} accent={accent} options={options} />
      </div>
      {children && <div className="grid grid-cols-2 gap-2 xl:flex">{children}</div>}
    </div>
  );
}

export function PlayButtons({ common, running, started, done, onToggle, onReset, playLabel, disabled }) {
  return (
    <>
      <Btn variant="primary" icon={running ? Pause : Play} onClick={onToggle} disabled={disabled && !running} className="xl:min-w-[168px] min-h-[52px] text-[15px]">
        {running ? common.pause : done ? common.again : started ? common.resume : playLabel ?? common.start}
      </Btn>
      <Btn icon={RotateCcw} onClick={onReset} disabled={!started && !running} className="min-h-[52px] text-[15px]">
        {common.reset}
      </Btn>
    </>
  );
}

/** Dark sub-panel under the scene. */
export function Panel({ className = '', children }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4 ${className}`}>{children}</div>;
}

/** A worked calculation, one formula per row: rows = [{ sym, color, formula, subst, result }]. */
export function Calc({ title, rows, note }) {
  return (
    <div>
      {title && <p className="text-sm font-semibold text-gray-200">{title}</p>}
      <ul className="mt-2 space-y-1.5">
        {rows.map((r) => (
          <li key={r.sym + r.formula} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-xl bg-black/25 px-3 py-2 text-[15px] tabular-nums">
            <span className="font-serif italic text-lg leading-none" style={{ color: r.color }}>
              {r.sym}
            </span>
            <span className="text-gray-500">=</span>
            <span className="font-serif italic text-gray-200">{r.formula}</span>
            {r.subst && (
              <>
                <span className="text-gray-500">=</span>
                <span className="text-gray-300">{r.subst}</span>
              </>
            )}
            <span className="text-gray-500">=</span>
            <span className="font-semibold text-white">{r.result}</span>
          </li>
        ))}
      </ul>
      {note && <p className="mt-2 text-xs leading-snug text-gray-500">{note}</p>}
    </div>
  );
}

/* ------------------------------------------------------------ SVG helpers */

/** Italic symbol with a white halo, e.g. the "F₁₂" beside an arrow. */
export function Tag({ x, y, text, color, size = 14, anchor = 'middle', italic = true, weight = 700 }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={size}
      fontStyle={italic ? 'italic' : 'normal'}
      fontWeight={weight}
      fill={color}
      stroke="#fff"
      strokeWidth="3.5"
      strokeLinejoin="round"
      paintOrder="stroke"
      pointerEvents="none"
    >
      {text}
    </text>
  );
}

/**
 * A force arrow from (x1, y1) along the unit vector (ux, uy). A length above
 * `maxLen` is drawn at `maxLen` with two white slashes across the shaft, so
 * the reader knows the true arrow would be longer.
 */
export function ForceArrow({ x1, y1, ux, uy, len, maxLen = Infinity, color = COL.force, width = 3.5, head = 13, minLen = 7 }) {
  const broken = len > maxLen;
  const L = Math.max(minLen, Math.min(len, maxLen));
  const x2 = x1 + ux * L;
  const y2 = y1 + uy * L;
  const nx = -uy;
  const ny = ux;
  const mx = x1 + ux * L * 0.42;
  const my = y1 + uy * L * 0.42;
  return (
    <g pointerEvents="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fff" strokeWidth={width + 3.5} strokeLinecap="round" opacity="0.85" />
      <Arrow x1={x1} y1={y1} x2={x2} y2={y2} color={color} width={width} head={Math.min(head, L * 0.75)} />
      {broken &&
        [-4, 4].map((o) => (
          <line
            key={o}
            x1={mx + ux * o - nx * 7 - ux * 3}
            y1={my + uy * o - ny * 7 - uy * 3}
            x2={mx + ux * o + nx * 7 + ux * 3}
            y2={my + uy * o + ny * 7 + uy * 3}
            stroke="#fff"
            strokeWidth="2.5"
          />
        ))}
    </g>
  );
}

/** A dimension line with end ticks and a value pill in the middle. */
export function Dimension({ x1, x2, y, text, size = 12, box }) {
  if (Math.abs(x2 - x1) < 4) return null;
  const mid = (x1 + x2) / 2;
  const w = text.length * size * 0.56 + 16;
  const left = box ? clamp(mid - w / 2, 4, box.w - w - 4) : mid - w / 2;
  return (
    <g pointerEvents="none">
      <line x1={x1} y1={y} x2={x2} y2={y} stroke="#fff" strokeWidth="4" opacity="0.8" />
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={COL.ink} strokeWidth="1.4" />
      <line x1={x1} y1={y - 6} x2={x1} y2={y + 6} stroke={COL.ink} strokeWidth="1.4" />
      <line x1={x2} y1={y - 6} x2={x2} y2={y + 6} stroke={COL.ink} strokeWidth="1.4" />
      <rect x={left} y={y - size / 2 - 5} width={w} height={size + 10} rx={(size + 10) / 2} fill="#fff" stroke="#cbd5e1" />
      <text x={left + w / 2} y={y + size * 0.36} textAnchor="middle" fontSize={size} fontWeight="700" fill={COL.ink}>
        {text}
      </text>
    </g>
  );
}

/* ---------------------------------------------------------------- bodies */

/**
 * A person seen from the front, drawn in metres (1.74 m tall) and scaled by
 * `k` px/m, centred on the centre of mass (cx, cy). `rot` = 90 lays the
 * person down with the head to the right.
 */
export function Person({ cx, cy, k, color, rot = 0, opacity = 1 }) {
  return (
    <g transform={`translate(${cx.toFixed(2)} ${cy.toFixed(2)}) rotate(${rot}) scale(${k.toFixed(4)})`} opacity={opacity}>
      <g fill={color} stroke="#fff" strokeWidth={1.4 / k} strokeLinejoin="round">
        <rect x={-0.155} y={0} width={0.135} height={0.95} rx={0.05} />
        <rect x={0.02} y={0} width={0.135} height={0.95} rx={0.05} />
        <rect x={-0.25} y={-0.52} width={0.075} height={0.6} rx={0.035} />
        <rect x={0.175} y={-0.52} width={0.075} height={0.6} rx={0.035} />
        <rect x={-0.17} y={-0.56} width={0.34} height={0.64} rx={0.08} />
        <circle cx={0} cy={-0.68} r={0.11} />
      </g>
      <circle cx={0} cy={0} r={0.035} fill="#fff" stroke={COL.ink} strokeWidth={1.2 / k} />
    </g>
  );
}

/** Earth, Moon or Sun as a shaded disc; `id` keeps the gradients unique. */
export function Planet({ kind, cx, cy, r, id, opacity = 1 }) {
  const gid = `${id}-${kind}`;
  if (kind === 'sun') {
    return (
      <g opacity={opacity}>
        <defs>
          <radialGradient id={gid} cx="42%" cy="40%" r="62%">
            <stop offset="0%" stopColor="#fef9c3" />
            <stop offset="55%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#ea580c" />
          </radialGradient>
          <radialGradient id={`${gid}-glow`} cx="50%" cy="50%" r="50%">
            <stop offset="55%" stopColor="#fde68a" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={r * 1.55} fill={`url(#${gid}-glow)`} />
        <circle cx={cx} cy={cy} r={r} fill={`url(#${gid})`} />
        <circle cx={cx} cy={cy} r={2.2} fill={COL.ink} />
      </g>
    );
  }
  if (kind === 'moon') {
    return (
      <g opacity={opacity}>
        <defs>
          <radialGradient id={gid} cx="38%" cy="36%" r="70%">
            <stop offset="0%" stopColor="#f1f5f9" />
            <stop offset="100%" stopColor="#64748b" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={r} fill={`url(#${gid})`} stroke="#475569" strokeWidth="0.8" />
        {r > 6 &&
          [
            [-0.3, -0.25, 0.2],
            [0.32, 0.1, 0.16],
            [-0.05, 0.42, 0.13],
          ].map(([x, y, s]) => <circle key={`${x}${y}`} cx={cx + x * r} cy={cy + y * r} r={s * r} fill="#94a3b8" opacity="0.7" />)}
        <circle cx={cx} cy={cy} r={1.8} fill={COL.ink} />
      </g>
    );
  }
  // earth
  const blob = (pts) =>
    `M${pts.map(([x, y]) => `${(cx + x * r).toFixed(1)},${(cy + y * r).toFixed(1)}`).join(' L')} Z`;
  return (
    <g opacity={opacity}>
      <defs>
        <radialGradient id={gid} cx="38%" cy="34%" r="72%">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="60%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </radialGradient>
        <clipPath id={`${gid}-clip`}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${gid})`} />
      {r > 7 && (
        <g clipPath={`url(#${gid}-clip)`} fill="#4ade80" opacity="0.85" stroke="#15803d" strokeWidth={r > 60 ? 1.2 : 0.6} strokeLinejoin="round">
          <path d={blob([[-0.62, -0.55], [-0.2, -0.72], [0.05, -0.45], [-0.15, -0.12], [-0.48, -0.18], [-0.7, -0.32]])} />
          <path d={blob([[-0.3, 0.05], [0.0, 0.0], [0.12, 0.3], [-0.05, 0.72], [-0.28, 0.5]])} />
          <path d={blob([[0.3, -0.6], [0.7, -0.42], [0.82, -0.05], [0.55, 0.12], [0.38, -0.2]])} />
          <path d={blob([[0.45, 0.42], [0.72, 0.35], [0.66, 0.62], [0.42, 0.62]])} />
        </g>
      )}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e3a8a" strokeWidth="0.8" />
      <g stroke="#fff" strokeWidth="3" strokeLinecap="round">
        <line x1={cx - 4} y1={cy} x2={cx + 4} y2={cy} />
        <line x1={cx} y1={cy - 4} x2={cx} y2={cy + 4} />
      </g>
      <g stroke={COL.ink} strokeWidth="1.4" strokeLinecap="round">
        <line x1={cx - 4} y1={cy} x2={cx + 4} y2={cy} />
        <line x1={cx} y1={cy - 4} x2={cx} y2={cy + 4} />
      </g>
    </g>
  );
}
