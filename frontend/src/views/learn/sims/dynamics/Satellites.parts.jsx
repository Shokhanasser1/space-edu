import { useId } from 'react';
import { Timer } from 'lucide-react';
import { clamp, fmt, groupThousands, textWidth, useElementSize } from '../kit/ui';
import { Paper } from '../kit/scene';
import { TAU } from './Satellites.consts';

/**
 * Small pieces shared by the three simulators of the "artificial satellites"
 * lesson: the Earth's constants, number formatting for values that span
 * 10⁻³…10⁸, the light scene with a legend that moves under the drawing on a
 * phone, SVG labels, planets and a satellite glyph, and a worked-calculation
 * list. No user-facing words live here: every string arrives through props.
 */

export { TAU, GM, R_E, R_KM, G_SURF, SIDEREAL_DAY, niceFactor, niceCeil } from './Satellites.consts';

/* ---------------------------------------------------------------- numbers */

/** About `sig` significant digits; 10 000 and above get grouped thousands. */
export function num(n, dec = '.', sig = 3) {
  if (!Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a < 1e-12) return '0';
  if (a >= 10000) return (n < 0 ? '-' : '') + groupThousands(a);
  const digits = clamp(sig - 1 - Math.floor(Math.log10(a)), 0, 6);
  return fmt(n, digits, dec);
}

function trimZeros(s, dec) {
  if (!s.includes(dec)) return s;
  let t = s;
  while (t.endsWith('0')) t = t.slice(0, -1);
  return t.endsWith(dec) ? t.slice(0, -1) : t;
}

/** `num` without trailing zeros: 0.250 → 0.25, 50.0 → 50. */
export function numt(n, dec = '.', sig = 3) {
  return trimZeros(num(n, dec, sig), dec);
}

/** A grid step such as 500 or 20 000 written with just the digits it needs. */
export function stepText(step, dec = '.') {
  if (step >= 1000) return groupThousands(step);
  for (let d = 0; d <= 6; d += 1) if (Math.abs(Math.round(step * 10 ** d) - step * 10 ** d) < 1e-7) return fmt(step, d, dec);
  return fmt(step, 6, dec);
}

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const supText = (e) =>
  String(e)
    .split('')
    .map((c) => SUP[c])
    .join('');

/** Always m·10ⁿ: 6.4·10⁶, 7.9·10³ (keeps trailing zeros off). */
export function sciAlways(n, dec = '.', sig = 2) {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) < 1e-12) return '0';
  let e = Math.floor(Math.log10(Math.abs(n)));
  let m = n / 10 ** e;
  if (Math.abs(Number(m.toFixed(sig - 1))) >= 10) {
    m /= 10;
    e += 1;
  }
  const ms = trimZeros(fmt(m, sig - 1, dec), dec);
  return e === 0 ? ms : `${ms}·10${supText(e)}`;
}

/** 6.4·10⁶ style for very large / very small numbers, plain `numt` otherwise. */
export function sci(n, dec = '.', sig = 2) {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) < 1e-12) return '0';
  const e = Math.floor(Math.log10(Math.abs(n)));
  if (e >= -2 && e <= 4) return numt(n, dec, sig + 1);
  return sciAlways(n, dec, sig);
}

/** A distance in km: 6 371, 400, 15.8 (grouped thousands, sensible digits). */
export function kmText(km, dec = '.') {
  const a = Math.abs(km);
  if (a >= 100) return groupThousands(km);
  if (a >= 10) return fmt(km, 1, dec);
  return fmt(km, a >= 1 ? 1 : 2, dec);
}

/**
 * A duration in its natural unit: seconds, minutes, hours or days.
 * `units` = { s, min, h, day }.
 */
export function duration(sec, units, dec = '.') {
  if (sec < 120) return { value: fmt(sec, 0, dec), unit: units.s };
  if (sec < 7200) return { value: fmt(sec / 60, sec < 6000 ? 1 : 0, dec), unit: units.min };
  if (sec < 48 * 3600) return { value: fmt(sec / 3600, 1, dec), unit: units.h };
  return { value: fmt(sec / 86400, 1, dec), unit: units.day };
}

export function durationText(sec, units, dec = '.') {
  const d = duration(sec, units, dec);
  return `${d.value} ${d.unit}`;
}

/* ------------------------------------------------------------ SVG helpers */

/** Italic symbol with a white halo, e.g. the "v" beside an arrow. */
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

/** A rounded value label that stays inside `box`. Returns its rectangle via `onBox` when given. */
export function Label({ x, y, text, bg, color = '#fff', size = 12, box, border, weight = 600 }) {
  if (!text) return null;
  const w = textWidth(text, size, weight) + 16;
  const h = size + 10;
  let left = x - w / 2;
  let top = y - h / 2;
  if (box) {
    left = clamp(left, 4, box.w - w - 4);
    top = clamp(top, 4, box.h - h - 4);
  }
  return (
    <g pointerEvents="none">
      <rect x={left} y={top} width={w} height={h} rx={h / 2} fill={bg} stroke={border} strokeWidth={border ? 1 : 0} />
      <text x={left + w / 2} y={top + h / 2 + size * 0.35} textAnchor="middle" fontSize={size} fontWeight={weight} fill={color}>
        {text}
      </text>
    </g>
  );
}

/** Rough label size, to keep two labels from landing on each other. */
export function labelSize(text, size = 12, weight = 600) {
  return { w: textWidth(text, size, weight) + 16, h: size + 10 };
}

/* ---------------------------------------------------------------- planets */

function hash(i) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const LOOK = {
  earth: { fill: '#bfdbfe', stroke: '#3b82f6' },
  moon: { fill: '#e5e7eb', stroke: '#64748b' },
  mars: { fill: '#fdba74', stroke: '#c2410c' },
  jupiter: { fill: '#fde68a', stroke: '#b45309' },
};

/** Land blobs on a globe of radius r (screen px), turned by `rot` (counter-clockwise). */
function Blobs({ cx, cy, r, rot, blobs, fill, stroke, seed = 0, opacity = 1 }) {
  return (
    <g opacity={opacity}>
      {blobs.map(([ang, rho, size], j) => {
        const bx = rho * Math.cos(ang + rot);
        const by = rho * Math.sin(ang + rot);
        const pts = [];
        for (let i = 0; i < 10; i += 1) {
          const t = (i / 10) * TAU;
          const rr = size * (0.65 + 0.5 * hash(seed + j * 10 + i));
          let x = bx + rr * Math.cos(t);
          let y = by + rr * Math.sin(t);
          const d = Math.hypot(x, y);
          if (d > 0.97) {
            x *= 0.97 / d;
            y *= 0.97 / d;
          }
          pts.push(`${(cx + x * r).toFixed(1)},${(cy - y * r).toFixed(1)}`);
        }
        return <polygon key={j} points={pts.join(' ')} fill={fill} stroke={stroke} strokeWidth="1" strokeLinejoin="round" />;
      })}
    </g>
  );
}

const EARTH_LAND = [
  [0.3, 0.55, 0.32],
  [1.6, 0.7, 0.26],
  [2.5, 0.35, 0.22],
  [3.6, 0.62, 0.3],
  [4.7, 0.8, 0.18],
  [5.5, 0.4, 0.2],
];
const MOON_SEAS = [
  [0.8, 0.4, 0.22],
  [2.2, 0.5, 0.16],
  [3.9, 0.35, 0.2],
  [5.2, 0.62, 0.12],
];
const MARS_DARK = [
  [0.4, 0.5, 0.2],
  [2.0, 0.6, 0.24],
  [3.4, 0.3, 0.16],
  [4.9, 0.66, 0.18],
];

/**
 * A planet seen from above its pole: the Earth (seas and land), the Moon,
 * Mars or Jupiter (bands). Below 3.5 px radius it is just a dot.
 */
export function Planet({ kind = 'earth', cx, cy, r, rot = 0 }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const look = LOOK[kind];
  if (r < 3.5) return <circle cx={cx} cy={cy} r={Math.max(r, 2.5)} fill={look.fill} stroke={look.stroke} strokeWidth="1" />;
  const sw = r > 40 ? 1.5 : 1;
  if (kind === 'jupiter') {
    const bands = [
      [-0.62, 0.12, '#f59e0b', 0.45],
      [-0.32, 0.16, '#d97706', 0.4],
      [0.05, 0.1, '#f59e0b', 0.35],
      [0.3, 0.18, '#b45309', 0.32],
      [0.64, 0.1, '#d97706', 0.4],
    ];
    return (
      <g>
        <defs>
          <clipPath id={`jup-${uid}`}>
            <circle cx={cx} cy={cy} r={r} />
          </clipPath>
        </defs>
        <circle cx={cx} cy={cy} r={r} fill={look.fill} />
        <g clipPath={`url(#jup-${uid})`}>
          {bands.map(([y, hh, c, o]) => (
            <rect key={y} x={cx - r} y={cy + y * r - (hh * r) / 2} width={2 * r} height={hh * r} fill={c} opacity={o} />
          ))}
          <ellipse cx={cx + r * 0.32 * Math.cos(rot)} cy={cy + r * 0.3} rx={r * 0.16} ry={r * 0.09} fill="#ef4444" opacity={0.65 * (0.4 + 0.6 * Math.max(0, Math.cos(rot)))} />
        </g>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={look.stroke} strokeWidth={sw} />
      </g>
    );
  }
  return (
    <g>
      {kind === 'earth' && <circle cx={cx} cy={cy} r={r + Math.max(1.5, r * 0.035)} fill="#dbeafe" opacity="0.9" />}
      <circle cx={cx} cy={cy} r={r} fill={look.fill} stroke={look.stroke} strokeWidth={sw} />
      {kind === 'earth' && <Blobs cx={cx} cy={cy} r={r} rot={rot} blobs={EARTH_LAND} fill="#86efac" stroke="#22c55e" />}
      {kind === 'moon' && <Blobs cx={cx} cy={cy} r={r} rot={rot} blobs={MOON_SEAS} fill="#cbd5e1" stroke="#94a3b8" seed={40} />}
      {kind === 'mars' && (
        <>
          <Blobs cx={cx} cy={cy} r={r} rot={rot} blobs={MARS_DARK} fill="#f97316" stroke="#ea580c" seed={80} opacity={0.55} />
          <circle cx={cx} cy={cy} r={r * 0.2} fill="#fff7ed" stroke="#fed7aa" strokeWidth="1" />
        </>
      )}
    </g>
  );
}

/** A satellite glyph (body and four solar panels) at (x, y), turned `deg` degrees. */
export function SatGlyph({ x, y, deg = 0, s = 1 }) {
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${deg.toFixed(1)}) scale(${s})`}>
      <rect x={-15} y={-3} width={30} height={6} fill="#475569" />
      <rect x={-12} y={-13} width={9} height={9} fill="#1d4ed8" stroke="#0f172a" strokeWidth="0.8" />
      <rect x={3} y={-13} width={9} height={9} fill="#1d4ed8" stroke="#0f172a" strokeWidth="0.8" />
      <rect x={-12} y={4} width={9} height={9} fill="#1d4ed8" stroke="#0f172a" strokeWidth="0.8" />
      <rect x={3} y={4} width={9} height={9} fill="#1d4ed8" stroke="#0f172a" strokeWidth="0.8" />
      <rect x={-4} y={-5} width={8} height={10} rx={2} fill="#e2e8f0" stroke="#0f172a" strokeWidth="0.8" />
    </g>
  );
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
  return <span className="h-1 w-4 rounded" style={{ background: color }} />;
}

/**
 * The light scene: the kit's Paper inside a bordered frame, its height a
 * function of the measured width. On a phone the legend moves below the
 * drawing so it never covers it.
 */
export function SimScene({ legend = [], chip, ariaLabel, height, children }) {
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 260);
  const narrow = W < 560;
  const H = Math.round(height(W, narrow));
  return (
    <div ref={ref} className="relative overflow-hidden rounded-2xl border border-slate-300/70 bg-white shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]">
      <Paper legend={narrow ? [] : legend} chip={chip} height={H} ariaLabel={ariaLabel}>
        {(w, h) => children(w, h, narrow)}
      </Paper>
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

/** Chip content for the scene: a stopwatch icon and the time-scale words. */
export function TimeChip({ text }) {
  return (
    <>
      <Timer size={14} className="text-cyan-600" aria-hidden="true" />
      <span className="font-medium">{text}</span>
    </>
  );
}

/** Dark sub-panel under the scene. */
export function Panel({ className = '', children }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4 ${className}`}>{children}</div>;
}

/** Section caption inside a panel. */
export function Caption({ children }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{children}</p>;
}

/**
 * A worked calculation, one formula per row:
 * rows = [{ sym, color, formula, subst, result }].
 */
export function Calc({ title, rows, note }) {
  return (
    <div>
      {title && <p className="text-sm font-semibold text-gray-200">{title}</p>}
      <ul className="mt-2 space-y-1.5">
        {rows.map((r) => (
          <li key={r.sym + r.formula} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-xl bg-black/25 px-3 py-2 text-[14px] sm:text-[15px] tabular-nums">
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
            <span className="text-gray-500">{r.approx ? '≈' : '='}</span>
            <span className="font-semibold text-white">{r.result}</span>
          </li>
        ))}
      </ul>
      {note && <p className="mt-2 text-xs leading-snug text-gray-500">{note}</p>}
    </div>
  );
}
