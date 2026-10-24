import { Pause, Play, RotateCcw, Timer } from 'lucide-react';
import { Btn, Segmented, clamp, fmt, groupThousands, textWidth, useElementSize } from '../kit/ui';
import { PALETTE, Paper } from '../kit/scene';

/**
 * Pieces shared by the simulators of the lesson "Law of conservation of
 * momentum": colours, number formatting (with a real minus sign, since signs
 * matter here), SVG labels with subscripts, the light scene with a legend
 * that moves under the drawing on a phone, toolbar and dark panels, a worked
 * calculation, a chart of momentum vectors before and after, energy bars and
 * a lab cart. No user-facing words live here: every string arrives through
 * props.
 */

export const G = 9.8; // m/s²

/** Colours: the two bodies, the total momentum, velocity / force, and energy by kind. */
export const COL = {
  b1: '#2563eb',
  b1Text: '#93c5fd',
  b1Line: '#60a5fa',
  b2: PALETTE.second,
  b2Text: PALETTE.secondText,
  b2Line: '#f472b6',
  sum: '#d97706',
  sumText: '#fcd34d',
  sumLine: '#fbbf24',
  vel: PALETTE.vel,
  velText: PALETTE.velText,
  force: PALETTE.force,
  forceText: '#fca5a5',
  ek: '#10b981',
  ekText: '#6ee7b7',
  ep: '#8b5cf6',
  epText: '#c4b5fd',
  heat: '#f97316',
  heatText: '#fdba74',
  total: '#cbd5e1',
  ink: PALETTE.ink,
  muted: PALETTE.muted,
};

/* ---------------------------------------------------------------- numbers */

const MINUS = '−';

/** Fixed digits with a typographic minus: −1.50. */
export function sfmt(n, digits, dec = '.') {
  const s = fmt(n, digits, dec);
  return s.startsWith('-') ? MINUS + s.slice(1) : s;
}

/** Same, with an explicit "+" for positive values (signs along a line). */
export function pfmt(n, digits, dec = '.') {
  const s = sfmt(n, digits, dec);
  return s.startsWith(MINUS) || Number(fmt(n, digits)) === 0 ? s : `+${s}`;
}

function trimZeros(s, dec) {
  if (!s.includes(dec)) return s;
  let t = s;
  while (t.endsWith('0')) t = t.slice(0, -1);
  return t.endsWith(dec) ? t.slice(0, -1) : t;
}

/** About `sig` significant digits, trailing zeros dropped; 10 000 and above grouped. */
export function numt(n, dec = '.', sig = 3) {
  if (!Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a < 1e-12) return '0';
  if (a >= 10000) return (n < 0 ? MINUS : '') + groupThousands(a);
  const digits = clamp(sig - 1 - Math.floor(Math.log10(a)), 0, 6);
  const s = trimZeros(fmt(n, digits, dec), dec);
  return s.startsWith('-') ? MINUS + s.slice(1) : s;
}

/** Fixed digits, then trailing zeros dropped: (1.50, 2) → 1.5. */
export function fmtt(n, digits, dec = '.') {
  const s = trimZeros(fmt(n, digits, dec), dec);
  return s.startsWith('-') ? MINUS + s.slice(1) : s;
}

/** A value in parentheses when negative, for substituted formulas: 2 · (−1.5). */
export function par(s) {
  return String(s).startsWith(MINUS) ? `(${s})` : s;
}

/* ------------------------------------------------------------- subscripts */

const SUB_G = /_([A-Za-zα-ωΑ-Ωа-яА-ЯёЁ0-9]+)/g;
const SUB_1 = /_([A-Za-zα-ωΑ-Ωа-яА-ЯёЁ0-9]+)/;

/** Turns "v_1" into a base letter with a subscript (HTML). */
export function rich(str) {
  if (typeof str !== 'string' || !str.includes('_')) return str;
  const out = [];
  let last = 0;
  let m;
  let i = 0;
  SUB_G.lastIndex = 0;
  while ((m = SUB_G.exec(str))) {
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
  const parts = str.split(SUB_1);
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
  const parts = String(str).split(SUB_1);
  return parts.reduce((w, p, i) => w + textWidth(p, i % 2 ? size * 0.72 : size, weight), 0);
}

/* ------------------------------------------------------------ SVG labels */

/** Italic symbol with a white halo, e.g. the "F" beside an arrow. */
export function Tag({ x, y, text, color, size = 14, anchor = 'middle', italic = true, weight = 700, halo = '#fff' }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={size}
      fontStyle={italic ? 'italic' : 'normal'}
      fontWeight={weight}
      fill={color}
      stroke={halo}
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
export function RichPill({ x, y, text, bg, color = '#fff', size = 12, box, border, weight = 600, opacity = 1 }) {
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
    <g pointerEvents="none" opacity={opacity}>
      <rect x={left} y={top} width={w} height={h} rx={h / 2} fill={bg} stroke={border} strokeWidth={border ? 1 : 0} />
      <text x={left + w / 2} y={top + h / 2 + size * 0.35} textAnchor="middle" fontSize={size} fontWeight={weight} fill={color}>
        {richSvg(text, size)}
      </text>
    </g>
  );
}

/** A zig-zag spring from x = a to x = b (px) around height y (px). */
export function springPath(a, b, y, amp, coils) {
  const pts = [`M${a.toFixed(1)},${y.toFixed(1)}`];
  const lead = Math.min(4, Math.abs(b - a) * 0.12) * Math.sign(b - a || 1);
  pts.push(`L${(a + lead).toFixed(1)},${y.toFixed(1)}`);
  const n = coils * 2;
  const span = b - a - 2 * lead;
  for (let i = 0; i < n; i += 1) {
    const x = a + lead + (span * (i + 0.5)) / n;
    pts.push(`L${x.toFixed(1)},${(y + (i % 2 ? amp : -amp)).toFixed(1)}`);
  }
  pts.push(`L${(b - lead).toFixed(1)},${y.toFixed(1)}`);
  pts.push(`L${b.toFixed(1)},${y.toFixed(1)}`);
  return pts.join(' ');
}

/** Small diamond on the track marking the centre of mass of the system. */
export function CmMarker({ x, y, size = 9, label, fs = 11 }) {
  return (
    <g pointerEvents="none">
      <line x1={x} x2={x} y1={y - size * 2.2} y2={y + size * 0.2} stroke={COL.sum} strokeWidth="1.5" strokeDasharray="3 3" />
      <path d={`M${x},${y - size} L${x + size * 0.8},${y} L${x},${y + size} L${x - size * 0.8},${y} Z`} fill={COL.sum} stroke="#fff" strokeWidth="1.8" />
      {label && (
        <text x={x} y={y + size + fs + 2} textAnchor="middle" fontSize={fs} fontWeight="700" fill={COL.sum} stroke="#fff" strokeWidth="3" paintOrder="stroke">
          {label}
        </text>
      )}
    </g>
  );
}

/** Mixes a #rrggbb colour with white (f > 0) or black (f < 0). */
export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(f >= 0 ? c + (255 - c) * f : c * (1 + f)));
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/* ------------------------------------------------------------------ cart */

export const CART = { L: 0.4, y0: 0.05, y1: 0.17, wheelR: 0.04, block: 0.5, blockH: 0.026 };

/** Top of a cart's load in world metres (for placing labels above it). */
export function cartTop(mass) {
  return CART.y1 + Math.max(0, Math.round((mass - CART.block) / CART.block)) * CART.blockH;
}

/**
 * A lab cart seen from the side: body centred at `xc` (m), wheels that turn
 * with the distance rolled, and its load as 0.5 kg weights on top (an empty
 * cart is 0.5 kg).
 */
export function Cart({ view, xc, color, label, mass, roll = 0, fs = 12 }) {
  const X = view.sx;
  const Y = view.sy;
  const k = view.k;
  const left = X(xc - CART.L / 2);
  const w = CART.L * k;
  const top = Y(CART.y1);
  const h = (CART.y1 - CART.y0) * k;
  const n = Math.max(0, Math.round((mass - CART.block) / CART.block));
  const wr = CART.wheelR * k;
  const deg = (roll / CART.wheelR) * (180 / Math.PI);
  return (
    <g>
      {[-0.12, 0.12].map((dx) => (
        <g key={dx} transform={`translate(${X(xc + dx).toFixed(1)} ${Y(CART.wheelR).toFixed(1)}) rotate(${deg.toFixed(1)})`}>
          <circle r={wr} fill="#1e293b" />
          <circle r={wr * 0.55} fill="#94a3b8" />
          <line x1={-wr * 0.55} y1={0} x2={wr * 0.55} y2={0} stroke="#1e293b" strokeWidth={Math.max(1, wr * 0.18)} />
          <circle r={wr * 0.16} fill="#1e293b" />
        </g>
      ))}
      <rect x={left} y={top} width={w} height={h} rx={Math.min(7, h * 0.25)} fill={color} stroke="#0f172a" strokeOpacity="0.35" />
      <rect x={left + 3} y={top + 3} width={Math.max(0, w - 6)} height={Math.max(2, h * 0.18)} rx={2} fill="#fff" opacity="0.28" />
      {h > 14 && (
        <text x={left + w / 2} y={top + h / 2 + fs * 0.4} textAnchor="middle" fontSize={fs + 1} fontWeight="800" fill="#fff">
          {label}
        </text>
      )}
      {Array.from({ length: n }, (_, i) => {
        const y0 = CART.y1 + i * CART.blockH;
        return (
          <g key={i}>
            <rect x={X(xc - 0.075)} y={Y(y0 + CART.blockH) + 0.5} width={0.15 * k} height={Math.max(1, CART.blockH * k - 1)} rx={2} fill="#475569" stroke="#1e293b" strokeWidth="0.8" />
            <line x1={X(xc - 0.068)} x2={X(xc + 0.068)} y1={Y(y0 + CART.blockH) + 1.5} y2={Y(y0 + CART.blockH) + 1.5} stroke="#94a3b8" strokeWidth="1" opacity="0.8" />
          </g>
        );
      })}
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
  if (kind === 'diamond') return <span className="h-2 w-2 rotate-45" style={{ background: color }} />;
  return <span className="h-1 w-4 rounded" style={{ background: color }} />;
}

/**
 * The light scene: the kit's Paper inside a bordered frame, its height a
 * function of the measured width. On a phone the legend moves below the
 * drawing so it never covers it. `chip` may be a function of (W, narrow).
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
export function TimeChip({ text, extra, hot }) {
  return (
    <>
      {text && <Timer size={14} className={hot ? 'text-orange-500' : 'text-cyan-600'} aria-hidden="true" />}
      {text && <span className={`font-medium ${hot ? 'text-orange-600' : ''}`}>{text}</span>}
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
      <Btn icon={RotateCcw} onClick={onReset} disabled={!started && !running && !done} className="min-h-[52px] text-[15px]">
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
export function PanelTitle({ children, className = '' }) {
  return <p className={`mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 ${className}`}>{children}</p>;
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
        {rows.map((r, i) => (
          <li key={`${r.sym}-${i}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-xl bg-black/25 px-3 py-2 text-[15px] tabular-nums">
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

/* ------------------------------------------------------- momentum vectors */

/** A "nice" upper bound for an axis: 1, 2, 2.5, 5 × 10ⁿ at or above `v`. */
export function niceMax(v) {
  const a = Math.max(Math.abs(v), 1e-9);
  const p = 10 ** Math.floor(Math.log10(a));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= a * 0.999) return m * p;
  return 10 * p;
}

/**
 * Momentum as arrows along the line, before and now: each row has a faint
 * "before" arrow and a solid "now" arrow from a common zero. Rows:
 * [{ id, label, color, text, before, now, sum }]. `max` is the axis bound.
 */
export function MomentumChart({ title, rows, max, unit, dec, beforeLabel, nowLabel, ariaLabel, note, digits = 2 }) {
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 260);
  const narrow = W < 420;
  const padL = narrow ? 34 : 44;
  const padR = narrow ? 64 : 92;
  const rowH = narrow ? 44 : 48;
  const top = 6;
  const H = top + rows.length * rowH + 30;
  const x0 = padL + (W - padL - padR) / 2;
  const half = (W - padL - padR) / 2 - 4;
  const sx = (p) => x0 + clamp(p / max, -1.08, 1.08) * half;
  const bar = (p, y, h, color, opacity, dashed) => {
    const a = x0;
    const b = sx(p);
    const len = Math.abs(b - a);
    if (len < 1.5) return <circle cx={a} cy={y} r={h * 0.38} fill={color} opacity={opacity} />;
    const dir = Math.sign(b - a);
    const head = Math.min(h * 1.15, len * 0.6);
    const shaft = b - dir * head;
    return (
      <g opacity={opacity}>
        <path
          d={`M${a},${y - h / 2} L${shaft},${y - h / 2} L${shaft},${y - h * 0.95} L${b},${y} L${shaft},${y + h * 0.95} L${shaft},${y + h / 2} L${a},${y + h / 2} Z`}
          fill={dashed ? 'none' : color}
          stroke={color}
          strokeWidth={dashed ? 1.6 : 0}
          strokeDasharray={dashed ? '4 3' : undefined}
          strokeLinejoin="round"
        />
      </g>
    );
  };
  return (
    <div>
      {(title || beforeLabel) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {title && <p className="text-sm font-semibold text-gray-200">{title}</p>}
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="h-2.5 w-4 rounded-sm border border-dashed border-gray-300/80" /> {beforeLabel}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="h-2.5 w-4 rounded-sm bg-gray-200" /> {nowLabel}
          </span>
        </div>
      )}
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="block">
          {[-1, -0.5, 0.5, 1].map((f) => (
            <line key={f} x1={x0 + f * half} x2={x0 + f * half} y1={top} y2={top + rows.length * rowH} stroke="rgba(255,255,255,0.07)" />
          ))}
          {rows.map((r, i) => {
            const yc = top + i * rowH + rowH / 2;
            return (
              <g key={r.id}>
                {r.sum && <line x1={8} x2={W - 8} y1={top + i * rowH + 1} y2={top + i * rowH + 1} stroke="rgba(255,255,255,0.14)" />}
                <text x={padL - 10} y={yc + 5} textAnchor="end" fontSize={narrow ? 14 : 16} fontStyle="italic" fontWeight="700" fill={r.text} fontFamily="Georgia, serif">
                  {richSvg(r.label, narrow ? 14 : 16)}
                </text>
                {bar(r.before, yc - 9, narrow ? 8 : 9, r.text, 0.85, true)}
                {bar(r.now, yc + 8, narrow ? 11 : 13, r.color, 1, false)}
                <text x={W - padR + 10} y={yc - 4} fontSize="11" fill="#94a3b8" className="tabular-nums">
                  {sfmt(r.before, digits, dec)}
                </text>
                <text x={W - padR + 10} y={yc + 13} fontSize={narrow ? 13 : 14} fontWeight="700" fill={r.text} className="tabular-nums">
                  {sfmt(r.now, digits, dec)}
                </text>
              </g>
            );
          })}
          <line x1={x0} x2={x0} y1={top - 2} y2={top + rows.length * rowH + 4} stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
          {[-1, 0, 1].map((f) => (
            <text key={f} x={x0 + f * half} y={H - 8} textAnchor="middle" fontSize="11" fill="#94a3b8">
              {f === 0 ? '0' : sfmt(f * max, max < 1 ? 2 : max < 10 ? 1 : 0, dec)}
            </text>
          ))}
          <text x={W - 6} y={H - 8} textAnchor="end" fontSize="11" fill="#64748b">
            {unit}
          </text>
        </svg>
      </div>
      {note && <p className="mt-1 text-xs leading-snug text-gray-500">{note}</p>}
    </div>
  );
}

/* ------------------------------------------------------------ energy bars */

/**
 * Energy columns with a dashed line at the constant total `level`:
 * cols = [{ id, label, color, text, value }]. Heights share one scale `max`.
 */
export function EnergyBars({ title, cols, max, level, levelLabel, unit, dec, note, ariaLabel, digits = 2 }) {
  const [box, { width }] = useElementSize();
  const W = Math.max(width, 240);
  const H = 170;
  const pad = { l: 8, r: level > 0 ? 62 : 8, t: 22, b: 34 };
  const n = cols.length;
  const slot = (W - pad.l - pad.r) / n;
  const bw = Math.min(56, slot * 0.56);
  const gy = (v) => H - pad.b - clamp(v / max, 0, 1.05) * (H - pad.t - pad.b);
  return (
    <div>
      {title && <p className="text-sm font-semibold text-gray-200">{title}</p>}
      <div ref={box} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel ?? title} className="block overflow-visible">
          <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="rgba(255,255,255,0.25)" />
          {cols.map((c, i) => {
            const cx = pad.l + slot * (i + 0.5);
            const y = gy(c.value);
            return (
              <g key={c.id}>
                <rect x={cx - bw / 2} y={y} width={bw} height={Math.max(0, H - pad.b - y)} rx="4" fill={c.color} opacity={c.dim ? 0.55 : 1} />
                <text x={cx} y={Math.min(y - 6, H - pad.b - 6)} textAnchor="middle" fontSize="12" fontWeight="700" fill={c.text} className="tabular-nums">
                  {fmt(Math.max(0, c.value), digits, dec)}
                </text>
                <text x={cx} y={H - pad.b + 16} textAnchor="middle" fontSize="12" fontStyle="italic" fontWeight="700" fill={c.text} fontFamily="Georgia, serif">
                  {richSvg(c.label, 12)}
                </text>
                {c.sub && (
                  <text x={cx} y={H - pad.b + 29} textAnchor="middle" fontSize="10" fill="#64748b">
                    {c.sub}
                  </text>
                )}
              </g>
            );
          })}
          {level > 0 && (
            <g>
              <line x1={pad.l} x2={W - pad.r + 6} y1={gy(level)} y2={gy(level)} stroke="#e2e8f0" strokeOpacity="0.7" strokeDasharray="5 4" />
              <text x={W - 2} y={gy(level) + 4} textAnchor="end" fontSize="11" fontWeight="600" fill="#cbd5e1">
                {levelLabel}
              </text>
            </g>
          )}
          <text x={pad.l} y={12} fontSize="11" fill="#64748b">
            {unit}
          </text>
        </svg>
      </div>
      {note && <p className="mt-1 text-xs leading-snug text-gray-500">{note}</p>}
    </div>
  );
}
