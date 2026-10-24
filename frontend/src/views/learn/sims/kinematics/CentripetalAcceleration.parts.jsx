import { Pause, Play, RotateCcw, Timer } from 'lucide-react';
import { Btn, Segmented, clamp, fmt, groupThousands, textWidth, useElementSize } from '../kit/ui';
import { Paper } from '../kit/scene';

/**
 * Small pieces shared by the three simulators of the "acceleration in
 * curvilinear motion" lesson: number formatting for values that span
 * 10⁻³…10⁴, the light scene with a legend that moves under the drawing on a
 * phone, the toolbar, SVG labels with subscripts, arcs and curved arrows.
 * No user-facing words live here: every string arrives through props.
 */

export const TAU = Math.PI * 2;

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
  return trimZeros(num(n, dec, sig), dec);
}

function trimZeros(s, dec) {
  if (!s.includes(dec)) return s;
  let t = s;
  while (t.endsWith('0')) t = t.slice(0, -1);
  return t.endsWith(dec) ? t.slice(0, -1) : t;
}

/** A grid step such as 0.1, 2.5 or 2000 written with just the digits it needs. */
export function stepText(step, dec = '.') {
  if (step >= 10000) return groupThousands(step);
  for (let d = 0; d <= 6; d += 1) if (Math.abs(Math.round(step * 10 ** d) - step * 10 ** d) < 1e-7) return fmt(step, d, dec);
  return fmt(step, 6, dec);
}

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

/** 6.4·10⁶ style for very large / very small numbers, plain `num` otherwise. */
export function sci(n, dec = '.', sig = 2) {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) < 1e-12) return '0';
  let e = Math.floor(Math.log10(Math.abs(n)));
  if (e >= -2 && e <= 4) return numt(n, dec, sig + 1);
  let m = n / 10 ** e;
  if (Math.abs(Number(m.toFixed(sig - 1))) >= 10) {
    m /= 10;
    e += 1;
  }
  let ms = fmt(m, sig - 1, dec);
  ms = trimZeros(ms, dec);
  return `${ms}·10${String(e)
    .split('')
    .map((c) => SUP[c])
    .join('')}`;
}

/** Turns "a_τ" / "v_A" into a base letter with a subscript (HTML). */
export function rich(str) {
  if (typeof str !== 'string' || !str.includes('_')) return str;
  const out = [];
  const re = /_([A-Za-zα-ωΑ-Ω0-9]+)/g;
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

/** Same for SVG text: subscripts become shifted, smaller tspans. */
export function richSvg(str, size) {
  if (typeof str !== 'string' || !str.includes('_')) return str;
  const parts = str.split(/_([A-Za-zα-ωΑ-Ω0-9]+)/);
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
  const parts = String(str).split(/_([A-Za-zα-ωΑ-Ω0-9]+)/);
  return parts.reduce((w, p, i) => w + textWidth(p, i % 2 ? size * 0.72 : size, weight), 0);
}

/* ------------------------------------------------------------ SVG helpers */

/** World-angle arc (radians, counter-clockwise positive, y up) as an SVG path. */
export function arcD(cx, cy, r, a0, a1) {
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy - r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy - r * Math.sin(a1);
  const d = a1 - a0;
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${Math.abs(d) > Math.PI ? 1 : 0} ${d > 0 ? 0 : 1} ${x1.toFixed(2)},${y1.toFixed(2)}`;
}

/** A curved arrow round (cx, cy): from angle `from`, `span` radians, dir +1 = counter-clockwise. */
export function SpinArrow({ cx, cy, r, from, span = 1.1, dir = 1, color, width = 2.5, head = 9, opacity = 1 }) {
  const a1 = from + dir * span;
  const back = Math.min(span * 0.6, (head * 0.85) / r);
  const ex = cx + r * Math.cos(a1);
  const ey = cy - r * Math.sin(a1);
  const tx = -Math.sin(a1) * dir;
  const ty = -Math.cos(a1) * dir;
  const bx = ex - tx * head;
  const by = ey - ty * head;
  const hw = head * 0.5;
  return (
    <g opacity={opacity} pointerEvents="none">
      <path d={arcD(cx, cy, r, from, a1 - dir * back)} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" />
      <path d={`M${ex},${ey} L${bx - ty * hw},${by + tx * hw} L${bx + ty * hw},${by - tx * hw} Z`} fill={color} stroke={color} strokeWidth={1} strokeLinejoin="round" />
    </g>
  );
}

/** Italic symbol with a white halo, e.g. the "v" beside an arrow; "a_n" gets a subscript. */
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

/** A rounded value label that understands "_x" subscripts and stays inside `box`. */
export function RichPill({ x, y, text, bg, color = '#fff', size = 12, box, border, weight = 600 }) {
  if (!text) return null;
  const w = richWidth(text, size, weight) + 16;
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
 * drawing so it never covers it. `overlay` is drawn over the scene (HTML).
 */
export function SimScene({ legend = [], chip, ariaLabel, height, overlay, children }) {
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 260);
  const narrow = W < 560;
  const H = Math.round(height(W, narrow));
  const items = legend;
  return (
    <div ref={ref} className="relative overflow-hidden rounded-2xl border border-slate-300/70 bg-white shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]">
      <Paper legend={narrow ? [] : items} chip={chip} height={H} ariaLabel={ariaLabel}>
        {(w, h) => children(w, h, narrow)}
      </Paper>
      {overlay}
      {narrow && items.length > 0 && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          {items.map((l) => (
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

/** "Real time" / "Time ×1000 sped up" / "Time slowed 50 times" for a time scale. */
export function timeWords(common, scale, dec) {
  if (Math.abs(scale - 1) < 1e-9) return common.realTime;
  if (scale > 1) return common.faster(groupThousands(scale));
  return common.slower(num(1 / scale, dec));
}

/** Chips on the left, Start/Pause and Reset on the right (stacked on a phone). */
export function Toolbar({ label, options, value, onChange, cols = 'grid-cols-2 md:grid-cols-3', accent, children }) {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
      <div className="min-w-0 flex-1">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{label}</p>
        <Segmented label={label} className={cols} size="lg" value={value} onChange={onChange} accent={accent} options={options} />
      </div>
      <div className="grid grid-cols-2 gap-2 xl:flex">{children}</div>
    </div>
  );
}

export function PlayButtons({ common, running, started, done, onToggle, onReset, playLabel }) {
  return (
    <>
      <Btn variant="primary" icon={running ? Pause : Play} onClick={onToggle} className="xl:min-w-[148px] min-h-[52px] text-[15px]">
        {running ? common.pause : playLabel ?? (done ? common.again : started ? common.resume : common.start)}
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
      {note && <p className="mt-2 text-xs text-gray-500">{note}</p>}
    </div>
  );
}
