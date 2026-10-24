import { Ruler, Timer } from 'lucide-react';
import { Segmented, clamp, fmt, textWidth, useElementSize } from '../kit/ui';
import { Paper } from '../kit/scene';

/**
 * Pieces shared by the three simulators of the lesson "Potential energy of
 * a deformed spring": the lesson's colours, rich text with subscripts
 * ("E_p", "F_el"), the light scene with a legend that moves under the
 * drawing on a phone, the toolbar, a coil spring that glows with the energy
 * it stores, a ruler, an energy bar chart for the scene, an x–y graph with
 * shaded areas for the dark panel, a worked calculation and a results
 * table. No user-facing words live here: every string arrives through props.
 */

export const G = 9.8; // m/s²

/** One colour per quantity, the same in the scene, the tiles and the graphs. */
export const COL = {
  hand: '#dc2626', // the hand's force F = kx (it does the work)
  handText: '#fca5a5',
  fel: '#0891b2', // elastic force F_el
  felText: '#67e8f9',
  x: '#d97706', // deformation x
  xText: '#fcd34d',
  vel: '#059669', // velocity v
  velText: '#6ee7b7',
  k: '#65a30d', // stiffness k
  kText: '#d9f99d',
  m: '#db2777', // mass m
  mText: '#f9a8d4',
  h: '#2563eb', // height h
  hText: '#93c5fd',
  steel: '#475569',
};

/** Energy colours, the same in every tab: elastic E_p violet, E_k green, mgh blue, total gray. */
export const EN = {
  el: '#7c3aed',
  elText: '#c4b5fd',
  k: '#16a34a',
  kText: '#86efac',
  g: '#2563eb',
  gText: '#93c5fd',
  tot: '#64748b',
  totText: '#e2e8f0',
};

/** A "nice" axis step (1, 2, 2.5, 5 × 10ⁿ) giving about `n` divisions up to `max`. */
export function axisStep(max, n = 4) {
  const raw = Math.max(max, 1e-9) / n;
  const p = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw - 1e-12) return m * p;
  return 10 * p;
}

/** Number of decimals needed to print multiples of `step` exactly. */
export function stepDigits(step) {
  for (let d = 0; d < 4; d += 1) if (Math.abs(step * 10 ** d - Math.round(step * 10 ** d)) < 1e-6) return d;
  return 4;
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

/** "E_p" / "E_{p,el}" → a base letter with a subscript (HTML). */
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
  if (kind === 'band') return <span className="h-2.5 w-4 rounded-sm" style={{ background: `${color}40`, borderTop: `2px solid ${color}` }} />;
  return <span className="h-1 w-4 rounded" style={{ background: color }} />;
}

/**
 * The light scene: the kit's Paper inside a bordered frame, its height a
 * function of the measured width. On a phone the legend moves below the
 * drawing so it never covers it. `chip` may be a function (W, narrow) => node.
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
      <Paper chip={typeof chip === 'function' ? chip(W, narrow) : chip} height={H} ariaLabel={ariaLabel}>
        {(w, h) => children(w, h, narrow)}
      </Paper>
      {!narrow && items.length > 0 && (
        <ul className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[60%] flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] text-slate-600 shadow-sm">
          {items}
        </ul>
      )}
      {narrow && items.length > 0 && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">{items}</ul>
      )}
    </div>
  );
}

/** Chip content for the scene: a stopwatch (or ruler) icon, the main words and an extra note. */
export function SceneChip({ text, extra, kind = 'time' }) {
  const Icon = kind === 'time' ? Timer : Ruler;
  return (
    <>
      <Icon size={14} className="text-cyan-600" aria-hidden="true" />
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
export function Toolbar({ label, options, value, onChange, cols = 'grid-cols-2 md:grid-cols-3', accent, children }) {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
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

/**
 * A small table of finished runs: `cols` = [{ id, label, color }], `rows` =
 * [{ id, cells: { [colId]: text }, highlight }]. Empty: shows `empty`.
 */
export function Results({ title, cols, rows, empty, note }) {
  return (
    <div>
      <p className="text-sm font-semibold text-gray-200">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-2 rounded-xl bg-black/25 px-3 py-2.5 text-xs leading-snug text-gray-400">{empty}</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-xl bg-black/25">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-[11px] text-gray-500">
                {cols.map((c) => (
                  <th key={c.id} scope="col" className="px-2.5 py-1.5 text-right font-medium first:text-left">
                    {rich(c.label)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`border-t border-white/5 ${r.highlight ? 'bg-white/[0.06]' : ''}`}>
                  {cols.map((c) => (
                    <td key={c.id} className="px-2.5 py-1.5 text-right first:text-left" style={{ color: c.color ?? '#e5e7eb' }}>
                      {r.cells[c.id]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {note && rows.length > 0 && <p className="mt-2 text-xs leading-snug text-gray-500">{rich(note)}</p>}
    </div>
  );
}

/* ------------------------------------------------------------ SVG pieces */

/**
 * A coil spring from (x1, y1) to (x2, y2): straight leads at both ends and
 * `turns` turns of radius `r` between them, the back half of each turn
 * lighter than the front, so it reads as a helix. `glow` (0…1) lays a violet
 * halo under the coils - the energy the spring stores.
 */
export function Coil({ x1, y1, x2, y2, turns = 12, r = 10, lead = 8, color = COL.steel, back = '#a8b3c3', width = 2.4, glow = 0 }) {
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
      {glow > 0.01 && (
        <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={EN.el} strokeWidth={r * 2 + 12} strokeOpacity={0.08 + glow * 0.3} strokeLinecap="butt" />
      )}
      <path d={d(backs)} fill="none" stroke={back} strokeWidth={width * 0.8} strokeLinecap="round" strokeLinejoin="round" />
      <line x1={x1} y1={y1} x2={sx} y2={sy} stroke={color} strokeWidth={width} strokeLinecap="round" />
      <line x1={ex} y1={ey} x2={x2} y2={y2} stroke={color} strokeWidth={width} strokeLinecap="round" />
      <path d={d(front)} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d(front)} fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth={width * 0.35} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

/**
 * A horizontal ruler: 0 (cm) at `x0`, `s` px per cm, from `from` to `to` cm,
 * ticks on the top edge, numbers under them every `every` cm.
 */
export function RulerH({ y, h, x0, s, from, to, unit, dec = '.' }) {
  const left = x0 + from * s - 10;
  const right = x0 + to * s + 10;
  const fine = s >= 22 ? 0.1 : s >= 9 ? 0.5 : 1;
  const every = s >= 26 ? 1 : s >= 11 ? 2 : s >= 6 ? 5 : 10;
  const ticks = [];
  for (let v = Math.ceil(from / fine - 1e-9) * fine; v <= to + 1e-9; v += fine) {
    const vv = Math.round(v * 10) / 10;
    const isCm = Math.abs(vv - Math.round(vv)) < 1e-6;
    const five = isCm && Math.round(vv) % 5 === 0;
    const half = !isCm && Math.abs(vv * 2 - Math.round(vv * 2)) < 1e-6;
    const len = five ? h * 0.5 : isCm ? h * 0.36 : half ? h * 0.26 : h * 0.16;
    const x = x0 + vv * s;
    ticks.push(<line key={`t${vv}`} x1={x} x2={x} y1={y} y2={y + len} stroke="#78350f" strokeWidth={isCm ? 1.2 : 0.8} />);
    if (isCm && Math.round(vv) % every === 0)
      ticks.push(
        <text key={`n${vv}`} x={x} y={y + h - 4} textAnchor="middle" fontSize="10.5" fontWeight={vv === 0 ? 800 : 600} fill="#78350f">
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

/** A scale bar for force arrows: `len` px stands for `label`. Anchored at its right end (x, y). */
export function ScaleBar({ x, y, len, label }) {
  return (
    <g pointerEvents="none">
      <line x1={x - len} x2={x} y1={y} y2={y} stroke="#334155" strokeWidth="2" />
      <line x1={x - len} x2={x - len} y1={y - 4} y2={y + 4} stroke="#334155" strokeWidth="1.5" />
      <line x1={x} x2={x} y1={y - 4} y2={y + 4} stroke="#334155" strokeWidth="1.5" />
      <text x={x - len - 6} y={y + 4} textAnchor="end" fontSize="11" fill="#475569">
        {label}
      </text>
    </g>
  );
}

/**
 * The energy bar chart drawn inside a scene: a white card at (x, y) of
 * size w × h with one bar per form of energy and a dashed line for the
 * (constant) total. `bars` = [{ id, label, value, color }], `max` - the
 * value of the full bar height, `total` - where the dashed line goes.
 */
export function EnergyBars({ x, y, w, h, title, totalLabel, bars, total, max, dec = '.', narrow }) {
  const fs = narrow ? 10 : 11;
  const padT = narrow ? 34 : 38;
  const padB = narrow ? 30 : 34;
  const padX = 10;
  const plotH = Math.max(20, h - padT - padB);
  const n = bars.length;
  const gap = narrow ? 6 : 12;
  const bw = Math.min(narrow ? 26 : 40, (w - 2 * padX - gap * (n - 1)) / n);
  const used = n * bw + (n - 1) * gap;
  const left = x + (w - used) / 2;
  const base = y + padT + plotH;
  const sy = (v) => base - clamp(v / Math.max(max, 1e-9), 0, 1.02) * plotH;
  return (
    <g pointerEvents="none">
      <rect x={x} y={y} width={w} height={h} rx={12} fill="#ffffff" fillOpacity="0.94" stroke="#cbd5e1" />
      <text x={x + 10} y={y + 16} fontSize={fs} fontWeight="700" fill="#334155">
        {title}
      </text>
      {totalLabel && (
        <text x={x + 10} y={y + 29} fontSize={fs} fontWeight="600" fill={EN.tot}>
          {richSvg(totalLabel, fs)}
        </text>
      )}
      <line x1={x + 6} x2={x + w - 6} y1={base} y2={base} stroke="#94a3b8" strokeWidth="1.2" />
      {bars.map((b, i) => {
        const bx = left + i * (bw + gap);
        const top = sy(b.value);
        return (
          <g key={b.id}>
            <rect x={bx} y={y + padT} width={bw} height={plotH} rx={4} fill="#f1f5f9" />
            {b.value > 1e-6 && <rect x={bx} y={top} width={bw} height={Math.max(1.5, base - top)} rx={4} fill={b.color} opacity={b.ghost ? 0.35 : 1} />}
            {(() => {
              const inside = b.value > max * 0.62 && base - top > 22;
              return (
                <text x={bx + bw / 2} y={inside ? top + 14 : Math.min(top, base) - 4} textAnchor="middle" fontSize={fs - 0.5} fontWeight="700" fill={inside ? '#fff' : b.color}>
                  {fmt(b.value, 2, dec)}
                </text>
              );
            })()}
            <text x={bx + bw / 2} y={base + (narrow ? 13 : 15)} textAnchor="middle" fontSize={fs} fontWeight="700" fontStyle="italic" fill={b.color}>
              {richSvg(b.label, fs)}
            </text>
            {b.sub && (
              <text x={bx + bw / 2} y={base + (narrow ? 24 : 28)} textAnchor="middle" fontSize={fs - 1.5} fill="#64748b">
                {b.sub}
              </text>
            )}
          </g>
        );
      })}
      {total > 1e-6 && (
        <g>
          <line x1={x + 6} x2={x + w - 6} y1={sy(total)} y2={sy(total)} stroke="#334155" strokeWidth="1.4" strokeDasharray="5 4" />
        </g>
      )}
    </g>
  );
}

/** Gradient definitions used by the drawings. */
export function Defs() {
  return (
    <defs>
      <linearGradient id="se-block" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#94a3b8" />
        <stop offset="1" stopColor="#475569" />
      </linearGradient>
      <linearGradient id="se-cart" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#38bdf8" />
        <stop offset="1" stopColor="#0369a1" />
      </linearGradient>
      <radialGradient id="se-ball" cx="35%" cy="32%" r="70%">
        <stop offset="0" stopColor="#fecdd3" />
        <stop offset="0.45" stopColor="#f43f5e" />
        <stop offset="1" stopColor="#9f1239" />
      </radialGradient>
      <linearGradient id="se-tube" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#cbd5e1" />
        <stop offset="0.4" stopColor="#f8fafc" />
        <stop offset="1" stopColor="#94a3b8" />
      </linearGradient>
    </defs>
  );
}

/* ----------------------------------------------------------------- graph */

/**
 * An x–y graph for the dark panel under a scene. `lines` = [{ id, pts:[{x,y}],
 * color, dash, width }], `areas` = [{ id, pts, color, opacity }] (filled
 * polygons), `rects` = [{ id, x0, y0, x1, y1, color }] (dashed outlines),
 * `guides` = [{ id, x, y, color }] (dashed lines from a point to both
 * axes), `points` = [{ x, y, color, r }], `labels` = [{ id, x, y, text,
 * color, bg, anchor }] (pills in data coordinates), `marker` = { x, y }.
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
  areas = [],
  rects = [],
  guides = [],
  points = [],
  labels = [],
  marker,
  note,
  height = 230,
  decimal = '.',
  ariaLabel,
  xDigits = 0,
  yDigits = 0,
  header,
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
  const box = { w: W, h: H };
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
            ) : s.kind === 'band' ? (
              <span className="h-2.5 w-4 rounded-sm" style={{ background: `${s.color}55`, borderTop: `2px solid ${s.color}` }} />
            ) : (
              <span className="h-0.5 w-4 rounded" style={{ background: s.color }} />
            )}
            <span>{rich(s.label)}</span>
          </span>
        ))}
        {header && <div className="ml-auto">{header}</div>}
      </div>
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel ?? title} className="block overflow-visible">
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
          {areas.map((a) =>
            a.pts.length > 2 ? (
              <polygon
                key={a.id}
                points={a.pts.map((p) => `${gx(cx(p.x)).toFixed(1)},${gy(cy(p.y)).toFixed(1)}`).join(' ')}
                fill={a.color}
                fillOpacity={a.opacity ?? 0.3}
                stroke={a.stroke}
                strokeWidth={a.stroke ? 1.5 : 0}
              />
            ) : null,
          )}
          {rects.map((r) => (
            <rect
              key={r.id}
              x={Math.min(gx(cx(r.x0)), gx(cx(r.x1)))}
              y={Math.min(gy(cy(r.y0)), gy(cy(r.y1)))}
              width={Math.abs(gx(cx(r.x1)) - gx(cx(r.x0)))}
              height={Math.abs(gy(cy(r.y1)) - gy(cy(r.y0)))}
              fill="none"
              stroke={r.color}
              strokeWidth="1.3"
              strokeDasharray="5 4"
            />
          ))}
          {guides.map((g) => (
            <g key={g.id}>
              <line x1={gx(cx(g.x))} x2={gx(cx(g.x))} y1={gy(cy(g.y))} y2={gy(Math.max(yMin, 0))} stroke={g.color} strokeDasharray="3 4" strokeWidth="1.2" />
              <line x1={gx(Math.max(xMin, 0))} x2={gx(cx(g.x))} y1={gy(cy(g.y))} y2={gy(cy(g.y))} stroke={g.color} strokeDasharray="3 4" strokeWidth="1.2" />
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
          {points.map((p) => (
            <circle key={p.id} cx={gx(cx(p.x))} cy={gy(cy(p.y))} r={p.r ?? 5} fill={p.color} stroke="#0b0b16" strokeWidth={1.5} />
          ))}
          {labels.map((l) => (
            <RichPill key={l.id} x={gx(cx(l.x))} y={gy(cy(l.y))} text={l.text} bg={l.bg ?? 'rgba(15,23,42,0.85)'} color={l.color ?? '#fff'} size={11} box={box} anchor={l.anchor} border={l.border} />
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
