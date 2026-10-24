import { Pause, Play, RotateCcw, Timer } from 'lucide-react';
import { Arrow, Btn, Segmented, clamp, fmt, groupThousands, textWidth, useElementSize } from '../kit/ui';
import { Paper } from '../kit/scene';

/**
 * Pieces shared by the three simulators of the lesson "Archimedes' force":
 * the lesson's colours and liquids, number formatting, rich text with
 * subscripts ("F_A", "ρ_s"), the light scene with a legend that moves under
 * the drawing on a phone, the toolbar, panels, a worked-calculation list and
 * a liquid surface with a meniscus and a ripple.
 * No user-facing words live here: every string arrives through props.
 */

export const G = 9.8; // m/s²

/** One colour per quantity, the same in the scene, the tiles and the graphs. */
export const COL = {
  mg: '#dc2626', // force of gravity / weight
  mgText: '#fca5a5',
  fa: '#059669', // Archimedes' force F_A
  faText: '#6ee7b7',
  fel: '#0891b2', // the spring balance's force
  felText: '#67e8f9',
  n: '#475569', // support (normal) force of the floor
  nText: '#cbd5e1',
  p: '#ea580c', // pressure and pressure forces
  pText: '#fdba74',
  vol: '#7c3aed', // displaced volume
  volText: '#c4b5fd',
  float: '#059669',
  floatText: '#6ee7b7',
  sink: '#dc2626',
  sinkText: '#fca5a5',
  hover: '#d97706',
  hoverText: '#fcd34d',
  warn: '#d97706',
  warnText: '#fcd34d',
};

/**
 * Liquids, kg/m³, and how each one is drawn - the same look in every tab:
 * water translucent blue, sea water teal, oil and kerosene amber, mercury
 * silver-grey. `men` is the meniscus: +1 wets the glass (curves up), -1
 * (mercury) curves down.
 */
export const LIQUIDS = {
  water: { rho: 1000, fill: '#b3dbf8', deep: '#5aa7e6', surface: '#2563eb', opacity: 0.52, men: 1 },
  sea: { rho: 1030, fill: '#9bdcd9', deep: '#2f9fa8', surface: '#0e7490', opacity: 0.6, men: 1 },
  brine: { rho: 1080, fill: '#cfe6f3', deep: '#86b9d6', surface: '#1e5f8f', opacity: 0.6, men: 1 },
  kerosene: { rho: 800, fill: '#fbefc4', deep: '#e9c868', surface: '#a16207', opacity: 0.55, men: 1 },
  oil: { rho: 900, fill: '#fde68a', deep: '#e5b02a', surface: '#a16207', opacity: 0.62, men: 1 },
  mercury: { rho: 13600, fill: '#eef2f6', deep: '#8d99a8', surface: '#475569', opacity: 0.96, men: -1 },
};

/** Density of air at normal pressure, kg/m³, for a temperature in °C (1.29 kg/m³ at 0 °C). */
export const airDensity = (tC) => (1.29 * 273) / (273 + tC);

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

/** Whole numbers with grouped thousands: 4018 → "4018", 20268 → "20 268". */
export function intText(n) {
  return Math.abs(n) >= 10000 ? groupThousands(n) : String(Math.round(n));
}

/* ------------------------------------------------------------- subscripts */

const SUB_RE = /_([A-Za-zα-ωΑ-Ωа-яА-ЯёЁ0-9']+)/;
const SUB_RE_G = /_([A-Za-zα-ωΑ-Ωа-яА-ЯёЁ0-9']+)/g;

/** Turns "F_A" / "ρ_s" into a base letter with a subscript (HTML). */
export function rich(str) {
  if (typeof str !== 'string' || !str.includes('_')) return str;
  const out = [];
  let last = 0;
  let m;
  let i = 0;
  SUB_RE_G.lastIndex = 0;
  while ((m = SUB_RE_G.exec(str))) {
    out.push(str.slice(last, m.index));
    out.push(<sub key={i++}>{m[1]}</sub>);
    last = m.index + m[0].length;
  }
  out.push(str.slice(last));
  return out;
}

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

/** Italic symbol with a white halo, e.g. the "F_A" beside an arrow. */
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

/**
 * A rounded value label that understands "_x" subscripts and stays inside
 * `box`. `anchor` = 'start' | 'middle' | 'end' says where (x, y) sits.
 */
export function RichPill({ x, y, text, bg, color = '#fff', size = 12, box, border, weight = 600, anchor = 'middle', opacity = 1 }) {
  if (!text) return null;
  const w = pillWidth(text, size, weight);
  const h = size + 10;
  let left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  let top = y - h / 2;
  if (box) {
    left = clamp(left, 4, box.w - w - 4);
    top = clamp(top, 4, box.h - h - 4);
  }
  return (
    <g pointerEvents="none" opacity={opacity}>
      <rect x={left} y={top} width={w} height={h} rx={h / 2} fill={bg} stroke={border} strokeWidth={border ? 1 : 0} />
      <text x={left + w / 2} y={top + h / 2 + size * 0.35} textAnchor="middle" fontSize={size} fontWeight={weight} fill={color}>
        {richSvg(text, size)}
      </text>
    </g>
  );
}

/** A force arrow with a thin white halo, so it stays readable over water, cargo or a hull. */
export function ForceArrow({ x1, y1, x2, y2, color, width = 3.2, head = 10 }) {
  if (Math.hypot(x2 - x1, y2 - y1) < 2) return null;
  return (
    <g pointerEvents="none">
      <Arrow x1={x1} y1={y1} x2={x2} y2={y2} color="#fff" width={width + 3} head={head + 3} opacity={0.9} />
      <Arrow x1={x1} y1={y1} x2={x2} y2={y2} color={color} width={width} head={head} />
    </g>
  );
}

/** Mixes a #rrggbb colour with white (f > 0) or black (f < 0). */
export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(f >= 0 ? c + (255 - c) * f : c * (1 + f)));
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** Vertical gradient for a liquid, with the given id. */
export function LiquidGradient({ id, liq }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor={liq.fill} />
      <stop offset="1" stopColor={liq.deep} />
    </linearGradient>
  );
}

/**
 * The surface line of a liquid from x0 to x1 at height y (px), with a
 * meniscus at the glass (`men` = +1 curves up, -1 down, 0 none) and a
 * travelling ripple of amplitude `amp` px.
 */
export function surfacePath(x0, x1, y, amp = 0, phase = 0, men = 1, menPx = 3) {
  const n = Math.max(8, Math.round((x1 - x0) / 8));
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const x = x0 + ((x1 - x0) * i) / n;
    const dl = x - x0;
    const dr = x1 - x;
    const edge = Math.min(dl, dr);
    const m = edge < 7 ? men * menPx * (1 - edge / 7) ** 2 : 0;
    const r = amp ? amp * Math.sin((x - x0) * 0.09 - phase) * Math.min(1, edge / 14) : 0;
    pts.push(`${x.toFixed(1)},${(y - m + r).toFixed(1)}`);
  }
  return pts;
}

/**
 * A liquid between x0 and x1 from its surface at `top` down to `bottom`
 * (px): gradient body, surface line with meniscus and ripple, and a light
 * glint under the surface.
 */
export function LiquidFill({ x0, x1, top, bottom, liq, gradId, amp = 0, phase = 0, menPx = 3 }) {
  if (bottom - top < 0.5) return null;
  const pts = surfacePath(x0, x1, top, amp, phase, liq.men, menPx);
  const body = `M${x0},${bottom} L${pts.join(' L')} L${x1},${bottom} Z`;
  return (
    <g pointerEvents="none">
      <path d={body} fill={`url(#${gradId})`} opacity={liq.opacity} />
      <polyline points={pts.join(' ')} fill="none" stroke={liq.surface} strokeWidth="1.8" strokeLinejoin="round" />
      {bottom - top > 6 && (
        <line x1={x0 + 4} x2={x1 - 4} y1={top + 3.2} y2={top + 3.2} stroke="#fff" strokeOpacity={liq.men < 0 ? 0.7 : 0.45} strokeWidth="1.4" />
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
 * drawing so it never covers it. `chip` may be a function (W, narrow).
 */
export function SimScene({ legend = [], chip, ariaLabel, height, children }) {
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 260);
  const narrow = W < 560;
  const H = Math.round(height(W, narrow));
  return (
    <div ref={ref} className="relative overflow-hidden rounded-2xl border border-slate-300/70 bg-white shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]">
      <Paper legend={narrow ? [] : legend} chip={typeof chip === 'function' ? chip(W, narrow) : chip} height={H} ariaLabel={ariaLabel}>
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

/** Chip content for the scene: a stopwatch icon, the time-scale words and an optional extra. */
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
export function Toolbar({ label, options, value, onChange, cols = 'grid-cols-2 md:grid-cols-4', accent, children, disabled }) {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
      <div className="min-w-0 flex-1">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{label}</p>
        <Segmented label={label} className={cols} size="lg" value={value} onChange={onChange} accent={accent} options={options} disabled={disabled} />
      </div>
      {children && <div className="grid grid-cols-2 gap-2 xl:flex">{children}</div>}
    </div>
  );
}

/** Primary start/pause button and the reset button. */
export function PlayButtons({ common, running, label, icon, onToggle, onReset, resetDisabled }) {
  return (
    <>
      <Btn variant="primary" icon={running ? Pause : icon ?? Play} onClick={onToggle} className="xl:min-w-[172px] min-h-[52px] text-[15px]">
        {running ? common.pause : label}
      </Btn>
      <Btn icon={RotateCcw} onClick={onReset} disabled={resetDisabled} className="min-h-[52px] text-[15px]">
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
export function makeSwatch(color, edge, round = false) {
  return function Swatch({ size = 16 }) {
    return (
      <span
        aria-hidden="true"
        className={`inline-block shrink-0 ${round ? 'rounded-full' : 'rounded-[4px]'}`}
        style={{ width: size, height: size, background: `linear-gradient(135deg, ${shade(color, 0.3)}, ${color} 55%, ${shade(color, -0.15)})`, border: `1.5px solid ${edge}` }}
      />
    );
  };
}

/** Option icons for the liquids, made once. */
export const LIQ_SWATCH = Object.fromEntries(Object.entries(LIQUIDS).map(([id, l]) => [id, makeSwatch(l.fill, l.surface)]));

/**
 * Advances one damped body by `T` seconds in small steps (semi-implicit
 * Euler): `accel(y, v)` gives the acceleration; y is kept ≥ `minY`.
 */
export function integrate(y0, v0, T, accel, minY = -Infinity, step = 0.0005) {
  const n = Math.min(400, Math.max(1, Math.ceil(T / step)));
  const h = T / n;
  let y = y0;
  let v = v0;
  for (let i = 0; i < n; i += 1) {
    v += accel(y, v) * h;
    y += v * h;
    if (y < minY) {
      y = minY;
      if (v < 0) v = 0;
    }
  }
  return { y, v };
}
