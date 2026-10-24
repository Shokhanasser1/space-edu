import { Timer } from 'lucide-react';
import { Segmented, clamp, fmt, textWidth, useElementSize } from '../kit/ui';
import { Paper } from '../kit/scene';

/**
 * Pieces shared by the three simulators of the lesson "Elastic force":
 * the lesson's colours, a small integrator for a damped spring, rich text
 * with subscripts ("F_el", "F_{el,x}"), the light scene with a legend that
 * moves under the drawing on a phone, the toolbar, a coil spring, rulers,
 * a lab stand, slotted weights and an x–y graph for the dark panel.
 * No user-facing words live here: every string arrives through props.
 */

export const G = 9.8; // m/s²

/** One colour per quantity, the same in the scene, the tiles and the graphs. */
export const COL = {
  fel: '#0891b2', // elastic force F_el
  felText: '#67e8f9',
  mg: '#dc2626', // force of gravity mg
  mgText: '#fca5a5',
  hand: '#c026d3', // the hand's force F
  handText: '#f0abfc',
  x: '#2563eb', // deformation x
  xText: '#93c5fd',
  limit: '#dc2626',
  s1: '#b45309', // spring 1
  s1Text: '#fcd34d',
  s2: '#7c3aed', // spring 2
  s2Text: '#c4b5fd',
  pointer: '#e11d48',
  warn: '#d97706',
  warnText: '#fcd34d',
  steel: '#475569',
};

/* ---------------------------------------------------------------- physics */

/**
 * Advances x, v by `T` seconds of simulated time in small steps
 * (semi-implicit Euler); `accel(x, v)` gives the acceleration. `minX`
 * stops the motion there (closed coils of a tension spring).
 */
export function integrate(x0, v0, T, accel, minX = -Infinity) {
  const n = Math.max(1, Math.ceil(T / 0.00025));
  const h = T / n;
  let x = x0;
  let v = v0;
  for (let i = 0; i < n; i += 1) {
    v += accel(x, v) * h;
    x += v * h;
    if (x < minX) {
      x = minX;
      if (v < 0) v = 0;
    }
  }
  return { x, v };
}

/* ------------------------------------------------------------- rich text */

const SUB_RE = /_\{([^}]*)\}|_([A-Za-zА-Яа-яЁёα-ωΑ-Ω0-9]+)/g;

function splitSub(str) {
  const parts = [];
  let last = 0;
  let m;
  SUB_RE.lastIndex = 0;
  while ((m = SUB_RE.exec(str))) {
    parts.push({ t: str.slice(last, m.index), sub: false });
    parts.push({ t: m[1] ?? m[2], sub: true });
    last = m.index + m[0].length;
  }
  parts.push({ t: str.slice(last), sub: false });
  return parts;
}

/** "F_el" / "F_{el,x}" → a base letter with a subscript (HTML). */
export function rich(str) {
  if (typeof str !== 'string' || !str.includes('_')) return str;
  return splitSub(str).map((p, i) => (p.sub ? <sub key={i}>{p.t}</sub> : p.t));
}

/** Same for SVG text: subscripts become shifted, smaller tspans. */
export function richSvg(str, size) {
  if (typeof str !== 'string' || !str.includes('_')) return str;
  const sh = size * 0.28;
  let down = false;
  return splitSub(str).map((p, i) => {
    const dy = p.sub ? sh : down ? -sh : undefined;
    down = p.sub;
    return (
      <tspan key={i} dy={dy} fontSize={p.sub ? size * 0.72 : undefined}>
        {p.t || '​'}
      </tspan>
    );
  });
}

/** Rough pixel width of a string that may contain subscripts. */
export function richWidth(str, size, weight = 600) {
  return splitSub(String(str)).reduce((w, p) => w + textWidth(p.t, p.sub ? size * 0.72 : size, weight), 0);
}

/** Italic symbol with a white halo, e.g. the "F_el" beside an arrow. */
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
      {richSvg(text, size)}
    </text>
  );
}

/** A rounded value label that understands subscripts and stays inside `box`. */
export function RichPill({ x, y, text, bg, color = '#fff', size = 12, box, border, weight = 600, anchor = 'middle' }) {
  if (!text) return null;
  const w = richWidth(text, size, weight) + 16;
  const h = size + 10;
  let left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  let top = y - h / 2;
  if (box) {
    left = clamp(left, 4, box.w - w - 4);
    top = clamp(top, 4, box.h - h - 4);
  }
  return (
    <g pointerEvents="none">
      <rect x={left} y={top} width={w} height={h} rx={h / 2} fill={bg} stroke={border} strokeWidth={border ? 1 : 0} />
      <text x={left + w / 2} y={top + h / 2 + size * 0.35} textAnchor="middle" fontSize={size} fontWeight={weight} fill={color}>
        {richSvg(text, size)}
      </text>
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
  if (kind === 'band') return <span className="h-2.5 w-4 rounded-sm" style={{ background: `${color}33`, borderTop: `2px solid ${color}` }} />;
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
  const items = legend.map((l) => (
    <li key={l.label} className="flex items-center gap-1.5">
      <LegendGlyph kind={l.kind} color={l.color} />
      <span>{rich(l.label)}</span>
    </li>
  ));
  return (
    <div ref={ref} className="relative overflow-hidden rounded-2xl border border-slate-300/70 bg-white shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]">
      <Paper chip={chip} height={H} ariaLabel={ariaLabel}>
        {(w, h) => children(w, h, narrow)}
      </Paper>
      {!narrow && items.length > 0 && (
        <ul className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[62%] flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] text-slate-600 shadow-sm">
          {items}
        </ul>
      )}
      {narrow && items.length > 0 && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">{items}</ul>
      )}
    </div>
  );
}

/** Chip content for the scene: a stopwatch icon, the time-scale words and an extra note. */
export function TimeChip({ text, extra }) {
  return (
    <>
      <Timer size={14} className="text-cyan-600" aria-hidden="true" />
      <span className="font-medium">{text}</span>
      {extra && (
        <>
          <span className="text-slate-300">·</span>
          <span className="tabular-nums">{extra}</span>
        </>
      )}
    </>
  );
}

/** Chips on the left, buttons on the right (stacked on a phone). */
export function Toolbar({ label, options, value, onChange, cols = 'grid-cols-2 md:grid-cols-3', accent, before, children }) {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
      {before}
      {options && (
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{label}</p>
          <Segmented label={label} className={cols} size="lg" value={value} onChange={onChange} accent={accent} options={options} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 xl:flex">{children}</div>
    </div>
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
              {rich(r.sym)}
            </span>
            <span className="text-gray-500">=</span>
            <span className="font-serif italic text-gray-200">{rich(r.formula)}</span>
            {r.subst && (
              <>
                <span className="text-gray-500">=</span>
                <span className="text-gray-300">{rich(r.subst)}</span>
              </>
            )}
            <span className="text-gray-500">=</span>
            <span className="font-semibold text-white">{rich(r.result)}</span>
          </li>
        ))}
      </ul>
      {note && <p className="mt-2 text-xs text-gray-500 leading-snug">{rich(note)}</p>}
    </div>
  );
}

/* ------------------------------------------------------------ SVG pieces */

/**
 * A coil spring from (x1, y1) to (x2, y2): straight leads at both ends and
 * `turns` turns of radius `r` between them, the back half of each turn
 * lighter than the front, so it reads as a helix.
 */
export function Coil({ x1, y1, x2, y2, turns = 12, r = 10, lead = 8, color = COL.steel, back = '#a8b3c3', width = 2.4 }) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const nx = -uy;
  const ny = ux;
  const ld = Math.min(lead, L * 0.2);
  const body = Math.max(1, L - 2 * ld);
  const N = Math.max(24, Math.round(turns * 20));
  const front = [];
  const backs = [];
  let cur = null;
  let curFront = null;
  let prev = null;
  for (let i = 0; i <= N; i += 1) {
    const t = i / N;
    const ph = 2 * Math.PI * turns * t;
    const off = r * Math.sin(ph);
    const isFront = Math.cos(ph) >= 0;
    const p = [x1 + ux * (ld + body * t) + nx * off, y1 + uy * (ld + body * t) + ny * off];
    if (isFront !== curFront) {
      cur = prev ? [prev, p] : [p];
      (isFront ? front : backs).push(cur);
      curFront = isFront;
    } else cur.push(p);
    prev = p;
  }
  const d = (segs) => segs.map((s) => `M${s.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' L')}`).join(' ');
  const sx = x1 + ux * ld;
  const sy = y1 + uy * ld;
  const ex = x2 - ux * ld;
  const ey = y2 - uy * ld;
  return (
    <g pointerEvents="none">
      <path d={d(backs)} fill="none" stroke={back} strokeWidth={width * 0.8} strokeLinecap="round" strokeLinejoin="round" />
      <line x1={x1} y1={y1} x2={sx} y2={sy} stroke={color} strokeWidth={width} strokeLinecap="round" />
      <line x1={ex} y1={ey} x2={x2} y2={y2} stroke={color} strokeWidth={width} strokeLinecap="round" />
      <path d={d(front)} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d(front)} fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth={width * 0.35} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

/**
 * A vertical ruler: the value 0 (cm) at `y0`, growing downwards by `s` px
 * per cm, from `from` to `to` cm. Ticks on the right edge (where a pointer
 * reads it), numbers on the left. `limit` (cm) shades the part beyond it.
 */
export function RulerV({ x, w, y0, s, from, to, unit, dec = '.', limit }) {
  const top = y0 + from * s - 8;
  const bot = y0 + to * s + 8;
  const fine = s >= 22 ? 0.1 : 0.5;
  const every = s >= 11 ? 1 : 2;
  const ticks = [];
  for (let v = Math.ceil(from / fine - 1e-9) * fine; v <= to + 1e-9; v += fine) {
    const vv = Math.round(v * 10) / 10;
    const isCm = Math.abs(vv - Math.round(vv)) < 1e-6;
    const half = !isCm && Math.abs(vv * 2 - Math.round(vv * 2)) < 1e-6;
    const len = isCm ? w * 0.42 : half ? w * 0.28 : w * 0.16;
    const y = y0 + vv * s;
    ticks.push(<line key={`t${vv}`} x1={x + w - len} x2={x + w} y1={y} y2={y} stroke="#78350f" strokeWidth={isCm ? 1.3 : 0.9} />);
    if (isCm && Math.round(vv) % every === 0 && vv >= 0)
      ticks.push(
        <text key={`n${vv}`} x={x + w * 0.36} y={y + 4} textAnchor="middle" fontSize={w < 34 ? 10 : 11} fontWeight="600" fill="#78350f">
          {fmt(vv, 0, dec)}
        </text>,
      );
  }
  return (
    <g pointerEvents="none">
      <rect x={x} y={top} width={w} height={bot - top} rx={3} fill="#fef3c7" stroke="#d97706" strokeWidth="1" />
      {limit !== undefined && limit < to && (
        <>
          <rect x={x + 1} y={y0 + limit * s} width={w - 2} height={bot - 1 - (y0 + limit * s)} fill={COL.limit} opacity="0.14" />
          <line x1={x} x2={x + w} y1={y0 + limit * s} y2={y0 + limit * s} stroke={COL.limit} strokeWidth="2" />
        </>
      )}
      {ticks}
      {unit && (
        <text x={x + w / 2} y={top - 5} textAnchor="middle" fontSize="11" fontWeight="600" fill="#92400e">
          {unit}
        </text>
      )}
    </g>
  );
}

/** A horizontal ruler: 0 cm at `x0`, `s` px per cm, ticks on the top edge, numbers under them. */
export function RulerH({ y, h, x0, s, from, to, unit, dec = '.' }) {
  const left = x0 + from * s - 10;
  const right = x0 + to * s + 10;
  const fine = s >= 22 ? 0.1 : 0.5;
  const every = s >= 14 ? 1 : s >= 10 ? 2 : 5;
  const ticks = [];
  for (let v = Math.ceil(from / fine - 1e-9) * fine; v <= to + 1e-9; v += fine) {
    const vv = Math.round(v * 10) / 10;
    const isCm = Math.abs(vv - Math.round(vv)) < 1e-6;
    const half = !isCm && Math.abs(vv * 2 - Math.round(vv * 2)) < 1e-6;
    const len = isCm ? h * 0.42 : half ? h * 0.28 : h * 0.16;
    const x = x0 + vv * s;
    ticks.push(<line key={`t${vv}`} x1={x} x2={x} y1={y} y2={y + len} stroke="#78350f" strokeWidth={isCm ? 1.3 : 0.9} />);
    if (isCm && Math.round(vv) % every === 0)
      ticks.push(
        <text key={`n${vv}`} x={x} y={y + h - 5} textAnchor="middle" fontSize="11" fontWeight={vv === 0 ? 700 : 600} fill="#78350f">
          {fmt(vv, 0, dec)}
        </text>,
      );
  }
  return (
    <g pointerEvents="none">
      <rect x={left} y={y} width={right - left} height={h} rx={3} fill="#fef3c7" stroke="#d97706" strokeWidth="1" />
      {ticks}
      {unit && (
        <text x={right + 6} y={y + h - 5} fontSize="11" fontWeight="600" fill="#92400e">
          {unit}
        </text>
      )}
    </g>
  );
}

/** A lab stand: base plate, vertical rod, a boss clamp and a horizontal arm ending in a hook at `hookX`. */
export function Stand({ rodX, armY, hookX, baseY, baseL = 40, baseR = 70 }) {
  return (
    <g pointerEvents="none">
      <rect x={rodX - baseL} y={baseY} width={baseL + baseR} height={10} rx={3} fill="#64748b" />
      <rect x={rodX - baseL + 4} y={baseY + 10} width={10} height={4} rx={1} fill="#334155" />
      <rect x={rodX + baseR - 14} y={baseY + 10} width={10} height={4} rx={1} fill="#334155" />
      <rect x={rodX - 4} y={armY - 22} width={8} height={baseY - armY + 22} rx={3} fill="#94a3b8" stroke="#64748b" />
      <rect x={Math.min(rodX, hookX)} y={armY - 3.5} width={Math.abs(hookX - rodX) + 6} height={7} rx={3} fill="#94a3b8" stroke="#64748b" />
      <rect x={rodX - 10} y={armY - 10} width={20} height={20} rx={4} fill="#475569" />
      <circle cx={rodX + 13} cy={armY} r={3.5} fill="#334155" />
      <path d={`M${hookX},${armY + 3} L${hookX},${armY + 8}`} stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
    </g>
  );
}

/** Pixel height of a stack of slotted weights (`grams`; 1000 g is one block). */
export function hangerHeight(grams, unit = 9) {
  if (grams <= 0) return 0;
  if (grams >= 1000) return 16 + unit * 5.2;
  const n100 = Math.floor(grams / 100);
  const n50 = grams % 100 >= 50 ? 1 : 0;
  return 16 + n100 * unit + n50 * unit * 0.55;
}

/** A hook and a stack of brass slotted weights hanging from (x, y). */
export function Hanger({ x, y, grams, unit = 9, width = 44, label }) {
  if (grams <= 0) return null;
  const parts = [];
  const top = y + 14;
  if (grams >= 1000) {
    const h = unit * 5.2;
    parts.push(
      <g key="kg">
        <rect x={x - width * 0.6} y={top + 2} width={width * 1.2} height={h} rx={5} fill="url(#ef-brass)" stroke="#78350f" strokeWidth="1" />
        <rect x={x - width * 0.6} y={top + 2} width={width * 1.2} height={6} rx={3} fill="#fde68a" opacity="0.55" />
        {label && (
          <text x={x} y={top + 2 + h / 2 + 5} textAnchor="middle" fontSize="13" fontWeight="700" fill="#451a03">
            {label}
          </text>
        )}
      </g>,
    );
  } else {
    const n100 = Math.floor(grams / 100);
    const n50 = grams % 100 >= 50 ? 1 : 0;
    let yy = top + 2;
    const disc = (key, h) => {
      const el = (
        <g key={key}>
          <rect x={x - width / 2} y={yy} width={width} height={h - 1} rx={2.5} fill="url(#ef-brass)" stroke="#78350f" strokeWidth="0.8" />
          <line x1={x - width / 2 + 3} x2={x + width / 2 - 3} y1={yy + 1.6} y2={yy + 1.6} stroke="#fde68a" strokeOpacity="0.7" strokeWidth="1" />
        </g>
      );
      yy += h;
      return el;
    };
    for (let i = 0; i < n100; i += 1) parts.push(disc(`d${i}`, unit));
    if (n50) parts.push(disc('half', unit * 0.55));
    parts.push(<line key="rod" x1={x} x2={x} y1={top - 2} y2={yy + 2} stroke="#78350f" strokeWidth="2" opacity="0.5" />);
  }
  return (
    <g pointerEvents="none">
      <path d={`M${x},${y} L${x},${y + 6} M${x},${y + 6} q -5 0 -5 4 q 0 4 5 4`} fill="none" stroke="#334155" strokeWidth="2" strokeLinecap="round" />
      <line x1={x} x2={x} y1={y + 10} y2={top + 2} stroke="#334155" strokeWidth="2" />
      {parts}
    </g>
  );
}

/** Gradient definitions used by the drawings (brass weights). */
export function Defs() {
  return (
    <defs>
      <linearGradient id="ef-brass" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#a16207" />
        <stop offset="0.35" stopColor="#facc15" />
        <stop offset="0.7" stopColor="#ca8a04" />
        <stop offset="1" stopColor="#854d0e" />
      </linearGradient>
      <linearGradient id="ef-block" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#94a3b8" />
        <stop offset="1" stopColor="#475569" />
      </linearGradient>
    </defs>
  );
}

/* ----------------------------------------------------------------- graph */

/**
 * An x–y graph for the dark panel under a scene. `lines` = [{ id, pts:[{x,y}],
 * color, dash, width }], `points` = [{ x, y, color, hollow }], `vlines` =
 * [{ x, color, label }], `bands` = [{ x0, x1, color }], `marker` = { x, y }.
 */
export function XYGraph({
  title,
  legend = [],
  xMin = 0,
  xMax,
  yMin = 0,
  yMax,
  xStep,
  yStep,
  xLabel,
  yLabel,
  lines = [],
  points = [],
  vlines = [],
  bands = [],
  marker,
  note,
  height = 220,
  decimal = '.',
  ariaLabel,
  xDigits = 0,
  yDigits = 0,
}) {
  const [ref, { width }] = useElementSize();
  const H = height;
  const pad = { l: 44, r: 14, t: 18, b: 26 };
  const W = Math.max(width, 220);
  const gx = (v) => pad.l + ((v - xMin) / (xMax - xMin)) * (W - pad.l - pad.r);
  const gy = (v) => H - pad.b - ((v - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
  const ticks = (a, b, st) => {
    const out = [];
    for (let v = Math.ceil(a / st - 1e-9) * st; v <= b + 1e-9; v += st) out.push(Math.round(v / st) * st);
    return out;
  };
  const xs = ticks(xMin, xMax, xStep);
  const ys = ticks(yMin, yMax, yStep);
  const cx = (v) => clamp(v, xMin, xMax);
  const cy = (v) => clamp(v, yMin, yMax);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {title && <p className="text-sm font-semibold text-gray-200">{rich(title)}</p>}
        {legend.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-xs text-gray-400">
            {s.kind === 'dot' ? (
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            ) : s.kind === 'dash' ? (
              <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: s.color }} />
            ) : (
              <span className="h-0.5 w-4 rounded" style={{ background: s.color }} />
            )}
            <span>{rich(s.label)}</span>
          </span>
        ))}
      </div>
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel ?? title} className="block overflow-visible">
          {bands.map((b) => (
            <rect key={`b${b.x0}`} x={gx(cx(b.x0))} y={pad.t} width={Math.max(0, gx(cx(b.x1)) - gx(cx(b.x0)))} height={H - pad.t - pad.b} fill={b.color} opacity="0.1" />
          ))}
          {ys.map((v) => (
            <g key={`y${v}`}>
              <line x1={pad.l} x2={W - pad.r} y1={gy(v)} y2={gy(v)} stroke={Math.abs(v) < 1e-9 ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.08)'} />
              <text x={pad.l - 6} y={gy(v) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                {fmt(v, yDigits, decimal)}
              </text>
            </g>
          ))}
          {xs.map((v) => (
            <g key={`x${v}`}>
              <line x1={gx(v)} x2={gx(v)} y1={pad.t} y2={H - pad.b} stroke={Math.abs(v) < 1e-9 ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.05)'} />
              <text x={gx(v)} y={H - 7} textAnchor="middle" fontSize="11" fill="#94a3b8">
                {fmt(v, xDigits, decimal)}
              </text>
            </g>
          ))}
          {xLabel && (
            <text x={W - pad.r} y={gy(Math.max(yMin, 0)) - 6} textAnchor="end" fontSize="11" fill="#64748b">
              {richSvg(xLabel, 11)}
            </text>
          )}
          {yLabel && (
            <text x={gx(Math.max(xMin, 0)) + 6} y={pad.t - 5} fontSize="11" fill="#64748b">
              {richSvg(yLabel, 11)}
            </text>
          )}
          {vlines.map((l) => (
            <g key={`v${l.x}`}>
              <line x1={gx(l.x)} x2={gx(l.x)} y1={pad.t} y2={H - pad.b} stroke={l.color} strokeDasharray="5 4" strokeWidth="1.5" opacity="0.85" />
              {l.label && (
                <text x={gx(l.x) + 5} y={pad.t + 11} fontSize="11" fill={l.color} fontWeight="600">
                  {richSvg(l.label, 11)}
                </text>
              )}
            </g>
          ))}
          {lines.map((s) => (
            <polyline
              key={s.id}
              points={s.pts.map((p) => `${gx(cx(p.x)).toFixed(1)},${gy(cy(p.y)).toFixed(1)}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth={s.width ?? 2.5}
              strokeDasharray={s.dash}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={s.opacity ?? 1}
            />
          ))}
          {points.map((p, i) => (
            <circle
              key={`p${i}`}
              cx={gx(cx(p.x))}
              cy={gy(cy(p.y))}
              r={p.r ?? 5}
              fill={p.hollow ? '#0b0b16' : p.color}
              stroke={p.hollow ? p.color : '#0b0b16'}
              strokeWidth={p.hollow ? 2 : 1.5}
            />
          ))}
          {marker && (
            <g>
              <circle cx={gx(cx(marker.x))} cy={gy(cy(marker.y))} r="9" fill="none" stroke={marker.color ?? '#fff'} strokeOpacity="0.5" strokeWidth="2" />
              <circle cx={gx(cx(marker.x))} cy={gy(cy(marker.y))} r="3.5" fill={marker.color ?? '#fff'} />
            </g>
          )}
        </svg>
      </div>
      {note && <p className="mt-1 text-xs text-gray-500 leading-snug">{rich(note)}</p>}
    </div>
  );
}
