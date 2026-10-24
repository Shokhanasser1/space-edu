import { Pause, Play, RotateCcw, Timer } from 'lucide-react';
import { Btn, Segmented, clamp, fmt, groupThousands, textWidth, useElementSize } from '../kit/ui';
import { Paper } from '../kit/scene';

/**
 * Pieces shared by the three simulators of the lesson "Mass. Density":
 * the table of real densities, number formatting, the light scene with a
 * legend that moves under the drawing on a phone, toolbar and panels, SVG
 * labels with subscripts and a drawn cube of a material.
 * No user-facing words live here: every string arrives through props.
 */

export const G = 9.8; // m/s²

/**
 * Densities in kg/m³ (school table values) and the colours a cube of that
 * material is drawn with. `liquid` is drawn as water in a thin glass box.
 */
export const MATERIALS = {
  cork: { rho: 240, color: '#e3b77f', edge: '#a3743f' },
  oak: { rho: 700, color: '#b07a45', edge: '#6f4723', grain: '#8a5a2e' },
  ice: { rho: 900, color: '#d6effc', edge: '#3f9bd1', shine: true },
  water: { rho: 1000, color: '#9fcdf5', edge: '#3b82f6', liquid: true },
  plexi: { rho: 1200, color: '#eef6fb', edge: '#94a3b8', shine: true },
  glass: { rho: 2500, color: '#cdeee4', edge: '#5fb39a', shine: true },
  al: { rho: 2700, color: '#e3e8ef', edge: '#8b97a8', metal: true },
  iron: { rho: 7800, color: '#7b8088', edge: '#3f434a', metal: true },
  copper: { rho: 8900, color: '#d9834f', edge: '#8e4520', metal: true },
  lead: { rho: 11300, color: '#5d6878', edge: '#2b3340', metal: true },
  gold: { rho: 19300, color: '#f5c542', edge: '#a8740d', metal: true },
};

/** Liquids for the float-or-sink tank, kg/m³. */
export const LIQUIDS = {
  water: { rho: 1000, fill: '#a7d4f7', deep: '#5aa7e6', surface: '#2563eb', opacity: 0.48 },
  sea: { rho: 1030, fill: '#8fd3d6', deep: '#3fa3b0', surface: '#0e7490', opacity: 0.6 },
  oil: { rho: 930, fill: '#fde68a', deep: '#f2c14b', surface: '#b45309', opacity: 0.6 },
  kerosene: { rho: 800, fill: '#f6efd2', deep: '#e7d9a3', surface: '#a16207', opacity: 0.5 },
  mercury: { rho: 13600, fill: '#d5dbe3', deep: '#9aa5b4', surface: '#475569', opacity: 0.92 },
};

/** Colours of the quantities of this lesson (scene colour + light text colour on the dark card). */
export const COL = {
  cart1: '#0891b2',
  cart1Text: '#a5f3fc',
  cart2: '#db2777',
  cart2Text: '#f9a8d4',
  mass: '#b45309',
  massText: '#fcd34d',
  vol: '#0f766e',
  volText: '#5eead4',
  rho: '#7c3aed',
  rhoText: '#c4b5fd',
  float: '#059669',
  floatText: '#6ee7b7',
  sink: '#dc2626',
  sinkText: '#fca5a5',
  liquid: '#2563eb',
  liquidText: '#93c5fd',
};

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

/** `num` without trailing zeros: 0.250 → 0.25, 50.0 → 50. */
export function numt(n, dec = '.', sig = 3) {
  const s = num(n, dec, sig);
  if (!s.includes(dec)) return s;
  let t = s;
  while (t.endsWith('0')) t = t.slice(0, -1);
  return t.endsWith(dec) ? t.slice(0, -1) : t;
}

/** A density in kg/m³ as the textbook writes it: 2700, 13 600. */
export function rhoText(n) {
  return n >= 10000 ? groupThousands(n) : String(Math.round(n));
}

/** A mass: grams below 1 kg (975 g), kilograms from 1 kg on (2.70 kg). */
export function massText(kg, U, dec) {
  if (kg < 1 - 1e-9) return `${numt(kg * 1000, dec)} ${U.g}`;
  return `${num(kg, dec)} ${U.kg}`;
}

/* ------------------------------------------------------------- subscripts */

/** Turns "v_1" / "ρ_jism" into a base letter with a subscript (HTML). */
export function rich(str) {
  if (typeof str !== 'string' || !str.includes('_')) return str;
  const out = [];
  const re = /_([A-Za-zα-ωΑ-Ωа-яА-ЯёЁ0-9']+)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(str))) {
    out.push(str.slice(last, m.index));
    out.push(<sub key={i++}>{m[1]}</sub>);
    last = m.index + m[0].length;
  }
  out.push(str.slice(last));
  return out;
}

const SUB_RE = /_([A-Za-zα-ωΑ-Ωа-яА-ЯёЁ0-9']+)/;

/** Same for SVG text: subscripts become shifted, smaller tspans. */
export function richSvg(str, size) {
  if (typeof str !== 'string' || !str.includes('_')) return str;
  const parts = str.split(SUB_RE);
  const sh = size * 0.28;
  return parts.map((p, i) => {
    if (i % 2)
      return (
        <tspan key={i} fontSize={size * 0.72} dy={sh}>
          {p}
        </tspan>
      );
    return (
      <tspan key={i} dy={i > 0 ? -sh : undefined}>
        {p || '​'}
      </tspan>
    );
  });
}

/** Rough pixel width of a string that may contain "_x" subscripts. */
export function richWidth(str, size, weight = 600) {
  const parts = String(str).split(SUB_RE);
  return parts.reduce((w, p, i) => w + textWidth(p, i % 2 ? size * 0.72 : size, weight), 0);
}

/* ------------------------------------------------------------ SVG helpers */

/** Italic symbol with a white halo, e.g. the "v" beside an arrow; "F_1" gets a subscript. */
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

/** Width of a RichPill, for placing it before drawing. */
export function pillWidth(text, size = 12, weight = 600) {
  return richWidth(text, size, weight) + 16;
}

/** A rounded value label that understands "_x" subscripts and stays inside `box`. */
export function RichPill({ x, y, text, bg, color = '#fff', size = 12, box, border, weight = 600 }) {
  if (!text) return null;
  const w = pillWidth(text, size, weight);
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
        {richSvg(text, size)}
      </text>
    </g>
  );
}

/** Mixes a #rrggbb colour with white (f > 0) or black (f < 0). */
export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(f >= 0 ? c + (255 - c) * f : c * (1 + f)));
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** How far the drawn cube's top/side faces stick out, as a share of its edge. */
export const CUBE_DEPTH = { dx: 0.3, dy: 0.2 };

/**
 * A cube of material `mat` seen slightly from above and the right:
 * (x, y) is the bottom-left corner of the front face in screen px, `s` the
 * edge in px. A liquid is drawn as water in a thin glass box.
 */
export function Cube({ x, y, s, mat, opacity = 1, mark }) {
  const m = MATERIALS[mat];
  const dx = s * CUBE_DEPTH.dx;
  const dy = s * CUBE_DEPTH.dy;
  const sw = s > 40 ? 1.4 : 1;
  const top = `M${x},${y - s} L${x + dx},${y - s - dy} L${x + s + dx},${y - s - dy} L${x + s},${y - s} Z`;
  const side = `M${x + s},${y} L${x + s + dx},${y - dy} L${x + s + dx},${y - s - dy} L${x + s},${y - s} Z`;
  if (m.liquid) {
    const lvl = s * 0.06; // water stands a little below the rim
    return (
      <g opacity={opacity}>
        <path d={side} fill={shade(m.color, -0.12)} fillOpacity="0.85" stroke="#94a3b8" strokeWidth={sw} strokeLinejoin="round" />
        <rect x={x} y={y - s + lvl} width={s} height={s - lvl} fill={m.color} />
        <path
          d={`M${x},${y - s + lvl} L${x + dx},${y - s - dy + lvl} L${x + s + dx},${y - s - dy + lvl} L${x + s},${y - s + lvl} Z`}
          fill={shade(m.color, 0.35)}
        />
        <path d={top} fill="none" stroke="#94a3b8" strokeWidth={sw} strokeLinejoin="round" />
        <rect x={x} y={y - s} width={s} height={s} fill="none" stroke="#64748b" strokeWidth={sw} />
        <line x1={x + s * 0.12} y1={y - s * 0.75} x2={x + s * 0.12} y2={y - s * 0.2} stroke="#fff" strokeOpacity="0.7" strokeWidth={Math.max(1.5, s * 0.03)} strokeLinecap="round" />
      </g>
    );
  }
  const front = m.color;
  return (
    <g opacity={opacity}>
      <path d={top} fill={shade(m.color, 0.32)} stroke={m.edge} strokeWidth={sw} strokeLinejoin="round" />
      <path d={side} fill={shade(m.color, -0.16)} stroke={m.edge} strokeWidth={sw} strokeLinejoin="round" />
      <rect x={x} y={y - s} width={s} height={s} fill={front} stroke={m.edge} strokeWidth={sw} />
      {m.grain &&
        s > 16 &&
        [0.22, 0.45, 0.68, 0.86].map((f, i) => (
          <path
            key={i}
            d={`M${x + 1},${y - s * f} q${s * 0.25},${-s * 0.05 * (i % 2 ? 1 : -1)} ${s * 0.5},0 t${s * 0.5 - 2},0`}
            fill="none"
            stroke={m.grain}
            strokeOpacity="0.55"
            strokeWidth="1"
          />
        ))}
      {(m.shine || m.metal) && s > 12 && (
        <path
          d={`M${x + s * 0.14},${y - s * 0.18} L${x + s * 0.14},${y - s * 0.82} L${x + s * 0.3},${y - s * 0.82}`}
          fill="none"
          stroke="#fff"
          strokeOpacity={m.metal ? 0.45 : 0.85}
          strokeWidth={Math.max(1.2, s * 0.035)}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {mark && s > 22 && (
        <text x={x + s / 2} y={y - s / 2 + Math.min(s * 0.28, 18) * 0.36} textAnchor="middle" fontSize={Math.min(s * 0.42, 26)} fontWeight="800" fill="#fff" stroke={m.edge} strokeWidth="2.5" paintOrder="stroke">
          {mark}
        </text>
      )}
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
  if (kind === 'square') return <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />;
  return <span className="h-1 w-4 rounded" style={{ background: color }} />;
}

/**
 * The light scene: the kit's Paper inside a bordered frame, its height a
 * function of the measured width. On a phone the legend moves below the
 * drawing so it never covers it. `overlay` is drawn over the scene (HTML).
 * `chip` may be a function of the measured width (W, narrow).
 */
export function SimScene({ legend = [], chip, ariaLabel, height, overlay, children }) {
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 260);
  const narrow = W < 560;
  const H = Math.round(height(W, narrow));
  return (
    <div ref={ref} className="relative overflow-hidden rounded-2xl border border-slate-300/70 bg-white shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]">
      <Paper legend={narrow ? [] : legend} chip={typeof chip === 'function' ? chip(W, narrow) : chip} height={H} ariaLabel={ariaLabel}>
        {(w, h) => children(w, h, narrow)}
      </Paper>
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

/** Chip content for the scene: a stopwatch icon, the time-scale words and an optional scale. */
export function TimeChip({ text, extra }) {
  return (
    <>
      {text && <Timer size={14} className="text-cyan-600" aria-hidden="true" />}
      {text && <span className="font-medium">{text}</span>}
      {text && extra && <span className="text-slate-300">·</span>}
      {extra && <span className="tabular-nums">{extra}</span>}
    </>
  );
}

/** Chips on the left, actions on the right (stacked on a phone). */
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

export function PlayButtons({ common, running, started, done, onToggle, onReset, startLabel, againLabel, startIcon }) {
  const icon = running ? Pause : !started && !done && startIcon ? startIcon : Play;
  return (
    <>
      <Btn variant="primary" icon={icon} onClick={onToggle} className="xl:min-w-[164px] min-h-[52px] text-[15px]">
        {running ? common.pause : done ? againLabel ?? common.again : started ? common.resume : startLabel ?? common.start}
      </Btn>
      <Btn icon={RotateCcw} onClick={onReset} disabled={!started && !running} className="min-h-[52px] text-[15px]">
        {common.reset}
      </Btn>
    </>
  );
}

/** Dark sub-panel under the scene. */
export function Panel({ className = '', children }) {
  return <div className={`min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4 ${className}`}>{children}</div>;
}

/** Small uppercase heading inside a panel. */
export function PanelTitle({ children }) {
  return <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{children}</p>;
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
          <li key={r.sym + r.formula} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-xl bg-black/25 px-3 py-2 text-[15px] tabular-nums">
            <span className="font-serif italic text-lg leading-none" style={{ color: r.color }}>
              {rich(r.sym)}
            </span>
            {r.formula && (
              <>
                <span className="text-gray-500">=</span>
                <span className="font-serif italic text-gray-200">{rich(r.formula)}</span>
              </>
            )}
            {r.subst && (
              <>
                <span className="text-gray-500">=</span>
                <span className="text-gray-300">{rich(r.subst)}</span>
              </>
            )}
            {r.result && (
              <>
                <span className="text-gray-500">=</span>
                <span className="font-semibold text-white">{rich(r.result)}</span>
              </>
            )}
          </li>
        ))}
      </ul>
      {note && <p className="mt-2 text-xs leading-snug text-gray-500">{note}</p>}
    </div>
  );
}

/** A small coloured square used as an option icon (Segmented passes `size`). */
function makeSwatch(color, edge) {
  return function Swatch({ size = 16 }) {
    return (
      <span
        aria-hidden="true"
        className="inline-block shrink-0 rounded-[4px]"
        style={{ width: size, height: size, background: `linear-gradient(135deg, ${shade(color, 0.3)}, ${color} 55%, ${shade(color, -0.15)})`, border: `1.5px solid ${edge}` }}
      />
    );
  };
}

/** Option icons for the materials and the liquids, made once. */
export const MAT_SWATCH = Object.fromEntries(Object.entries(MATERIALS).map(([id, m]) => [id, makeSwatch(m.color, m.edge)]));
export const LIQ_SWATCH = Object.fromEntries(Object.entries(LIQUIDS).map(([id, l]) => [id, makeSwatch(l.fill, l.surface)]));
