import { Pause, Play, RotateCcw, Timer } from 'lucide-react';
import { Arrow, Btn, Segmented, clamp, fmt, groupThousands, textWidth, useElementSize } from '../kit/ui';
import { PALETTE, Paper } from '../kit/scene';

/**
 * Small pieces shared by the simulators of the lesson "Newton's third law":
 * colours, number formatting, SVG labels with subscripts, force arrows and a
 * force scale bar, a side-view person, the light scene with a legend that
 * moves under the drawing on a phone, the toolbar and the dark panels.
 * No user-facing words live here: every string arrives through props.
 */

/** Colours: the two interacting bodies, forces by kind, and the kit's v / a. */
export const COL = {
  b1: '#2563eb',
  b1Text: '#93c5fd',
  b1Line: '#60a5fa',
  b2: PALETTE.second,
  b2Text: PALETTE.secondText,
  b2Line: '#f472b6',
  force: PALETTE.force,
  forceText: '#fca5a5',
  acc: PALETTE.acc,
  accText: PALETTE.accText,
  vel: PALETTE.vel,
  velText: PALETTE.velText,
  friction: '#a16207',
  frictionText: '#fcd34d',
  gravity: '#7c3aed',
  gravityText: '#c4b5fd',
  elastic: '#0d9488',
  elasticText: '#5eead4',
  wall: '#475569',
  ink: PALETTE.ink,
  muted: PALETTE.muted,
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

/** Fixed digits, then trailing zeros dropped: (1.50, 2) → 1.5. */
export function fmtt(n, digits, dec = '.') {
  return trimZeros(fmt(n, digits, dec), dec);
}

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

/** 3.3·10⁻²⁵ style for very large / very small numbers, plain `numt` otherwise. */
export function sci(n, dec = '.', sig = 2) {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) < 1e-300) return '0';
  let e = Math.floor(Math.log10(Math.abs(n)));
  if (e >= -2 && e <= 4) return numt(n, dec, sig + 1);
  let m = n / 10 ** e;
  if (Math.abs(Number(m.toFixed(sig - 1))) >= 10) {
    m /= 10;
    e += 1;
  }
  const ms = trimZeros(fmt(m, sig - 1, dec), dec);
  return `${ms}·10${String(e)
    .split('')
    .map((c) => SUP[c])
    .join('')}`;
}

/* --------------------------------------------------------- rich text */

const SUB_RE = /_([A-Za-zА-Яа-яЁёα-ωΑ-Ω0-9]+)/g;
const SUB_SPLIT = /_([A-Za-zА-Яа-яЁёα-ωΑ-Ω0-9]+)/;

/** Turns "F_A" / "a_Yer" into a base letter with a subscript (HTML). */
export function rich(str) {
  if (typeof str !== 'string' || !str.includes('_')) return str;
  const out = [];
  let last = 0;
  let m;
  let i = 0;
  SUB_RE.lastIndex = 0;
  while ((m = SUB_RE.exec(str))) {
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
  const parts = str.split(SUB_SPLIT);
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
  const parts = String(str).split(SUB_SPLIT);
  return parts.reduce((w, p, i) => w + textWidth(p, i % 2 ? size * 0.72 : size, weight), 0);
}

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
      {richSvg(text, size)}
    </text>
  );
}

/** A rounded value label that understands "_x" subscripts and stays inside `box`. */
export function RichPill({ x, y, text, bg, color = '#fff', size = 12, box, border, weight = 600, opacity = 1 }) {
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
    <g pointerEvents="none" opacity={opacity}>
      <rect x={left} y={top} width={w} height={h} rx={h / 2} fill={bg} stroke={border} strokeWidth={border ? 1 : 0} />
      <text x={left + w / 2} y={top + h / 2 + size * 0.35} textAnchor="middle" fontSize={size} fontWeight={weight} fill={color}>
        {richSvg(text, size)}
      </text>
    </g>
  );
}

/* ------------------------------------------------------------ SVG pieces */

/**
 * A force drawn from its point of application (x, y) by (dx, dy) px, with a
 * small dot at the point of application (coloured by the body it acts on)
 * and an optional soft glow for the highlighted force.
 */
export function ForceArrow({ x, y, dx, dy, color, dot, width = 3.5, head = 13, dash, opacity = 1, glow }) {
  if (Math.hypot(dx, dy) < 3) return null;
  return (
    <g opacity={opacity} pointerEvents="none">
      {glow && <line x1={x} y1={y} x2={x + dx} y2={y + dy} stroke={glow} strokeOpacity="0.28" strokeWidth={width + 10} strokeLinecap="round" />}
      <Arrow x1={x} y1={y} x2={x + dx} y2={y + dy} color={color} width={width} head={head} dash={dash} />
      {dot && <circle cx={x} cy={y} r={4.5} fill={dot} stroke="#fff" strokeWidth={1.6} />}
    </g>
  );
}

/** "⟶ 50 N": the force scale of a scene. */
export function ScaleBar({ x, y, len, color, text, size = 11 }) {
  if (!(len > 4)) return null;
  return (
    <g pointerEvents="none">
      <rect x={x - 8} y={y - size - 14} width={len + 16} height={size + 22} rx={8} fill="#ffffff" fillOpacity="0.88" stroke="#e2e8f0" />
      <line x1={x} y1={y - 5} x2={x} y2={y + 5} stroke={color} strokeWidth={1.6} />
      <Arrow x1={x} y1={y} x2={x + len} y2={y} color={color} width={2.5} head={8} />
      <text x={x + len / 2} y={y - 7} textAnchor="middle" fontSize={size} fontWeight="600" fill={PALETTE.muted}>
        {text}
      </text>
    </g>
  );
}

/* ---------------------------------------------------------------- person */

const SKIN = '#f6d3b3';
const HAIR = '#3f2d20';
const PANTS = '#334155';

/** Two-segment limb from s towards t (segment L); the joint bends to the side of `prefer`. */
function joint(s, t, L, prefer) {
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  const d = Math.hypot(dx, dy) || 1e-6;
  const ux = dx / d;
  const uy = dy / d;
  if (d >= 2 * L * 0.995) {
    const r = 2 * L * 0.995;
    return { mid: { x: s.x + ux * L, y: s.y + uy * L }, end: { x: s.x + ux * r, y: s.y + uy * r } };
  }
  const h = Math.sqrt(Math.max(0, L * L - (d / 2) ** 2));
  let nx = -uy;
  let ny = ux;
  if (nx * prefer.x + ny * prefer.y < 0) {
    nx = -nx;
    ny = -ny;
  }
  return { mid: { x: (s.x + t.x) / 2 + nx * h, y: (s.y + t.y) / 2 + ny * h }, end: t };
}

/** Where a person's shoulder is, for a pose (same geometry as `Person`). */
export function shoulderOf({ fx, fy, h, dir = 1, lean = 0, crouch = 0 }) {
  const ax = -dir * Math.sin(lean);
  const ay = -Math.cos(lean);
  const hipH = 0.47 * h * (1 - 0.32 * crouch);
  return { x: fx + ax * (hipH + 0.3 * h), y: fy + ay * (hipH + 0.3 * h) };
}

/**
 * A simple person in side view: feet midpoint (fx, fy) px, height h px,
 * facing `dir` (+1 right), leaning back by `lean` rad (negative leans
 * forward), knees bent by `crouch` (0…1), both hands at `hand` (px), or
 * relaxed when it is null. `bulk` widens the torso for a heavier body.
 */
export function Person({ fx, fy, h, dir = 1, lean = 0, crouch = 0, hand, color, bulk = 1, skates, stride = 0.16, feet }) {
  const ax = -dir * Math.sin(lean);
  const ay = -Math.cos(lean);
  const hipH = 0.47 * h * (1 - 0.32 * crouch);
  const hip = { x: fx + ax * hipH, y: fy + ay * hipH };
  const sh = { x: hip.x + ax * 0.3 * h, y: hip.y + ay * 0.3 * h };
  const hc = { x: sh.x + ax * 0.125 * h, y: sh.y + ay * 0.125 * h };
  const r = 0.075 * h;
  const fF = feet?.front ?? { x: fx + (dir * stride * h) / 2, y: fy };
  const fB = feet?.back ?? { x: fx - (dir * stride * h) / 2, y: fy };
  const legF = joint(hip, fF, 0.245 * h, { x: dir, y: 0 });
  const legB = joint(hip, fB, 0.245 * h, { x: dir, y: 0 });
  const target = hand ?? { x: sh.x + dir * 0.08 * h, y: sh.y + 0.36 * h };
  const arm = joint(sh, target, 0.2 * h, { x: 0, y: 1 });
  const legW = Math.max(2.5, 0.07 * h);
  const torsoW = Math.max(4, 0.15 * h * bulk);
  const armW = Math.max(2.2, 0.055 * h);
  const leg = (l, tone) => (
    <polyline
      points={`${hip.x},${hip.y} ${l.mid.x},${l.mid.y} ${l.end.x},${l.end.y}`}
      fill="none"
      stroke={tone}
      strokeWidth={legW}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
  const shoe = (p) => <ellipse cx={p.x + dir * 0.025 * h} cy={p.y - 0.012 * h} rx={0.05 * h} ry={0.022 * h} fill="#1e293b" />;
  const blade = (p) => (
    <g>
      <line x1={p.x - 0.06 * h + dir * 0.02 * h} y1={p.y + 0.012 * h} x2={p.x + 0.07 * h + dir * 0.02 * h} y2={p.y + 0.012 * h} stroke="#94a3b8" strokeWidth={Math.max(1.5, 0.014 * h)} strokeLinecap="round" />
      <line x1={p.x - 0.03 * h + dir * 0.02 * h} y1={p.y} x2={p.x - 0.03 * h + dir * 0.02 * h} y2={p.y + 0.012 * h} stroke="#94a3b8" strokeWidth="1.2" />
      <line x1={p.x + 0.04 * h + dir * 0.02 * h} y1={p.y} x2={p.x + 0.04 * h + dir * 0.02 * h} y2={p.y + 0.012 * h} stroke="#94a3b8" strokeWidth="1.2" />
    </g>
  );
  return (
    <g pointerEvents="none">
      {leg(legB, '#475569')}
      {skates && blade(legB.end)}
      {shoe(legB.end)}
      {leg(legF, PANTS)}
      {skates && blade(legF.end)}
      {shoe(legF.end)}
      <line x1={hip.x} y1={hip.y} x2={sh.x} y2={sh.y} stroke={color} strokeWidth={torsoW} strokeLinecap="round" />
      <polyline
        points={`${sh.x},${sh.y} ${arm.mid.x},${arm.mid.y} ${arm.end.x},${arm.end.y}`}
        fill="none"
        stroke={color}
        strokeWidth={armW}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: 'brightness(0.85)' }}
      />
      <circle cx={arm.end.x} cy={arm.end.y} r={armW * 0.62} fill={SKIN} />
      <circle cx={hc.x - dir * r * 0.12} cy={hc.y - r * 0.08} r={r * 1.04} fill={HAIR} />
      <circle cx={hc.x + dir * r * 0.14} cy={hc.y + r * 0.1} r={r * 0.84} fill={SKIN} />
      <circle cx={hc.x + dir * r * 0.52} cy={hc.y} r={Math.max(0.8, r * 0.1)} fill="#1e293b" />
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
  return (
    <div ref={ref} className="relative overflow-hidden rounded-2xl border border-slate-300/70 bg-white shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]">
      <Paper legend={narrow ? [] : legend} chip={chip} height={H} ariaLabel={ariaLabel}>
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

/** Chip content for the scene: a stopwatch icon and the time-scale words. */
export function TimeChip({ text, short, extra }) {
  return (
    <>
      <Timer size={14} className="text-cyan-600" aria-hidden="true" />
      {short ? (
        <>
          <span className="font-medium sm:hidden">{short}</span>
          <span className="hidden font-medium sm:inline">{text}</span>
        </>
      ) : (
        <span className="font-medium">{text}</span>
      )}
      {extra && (
        <>
          <span className="text-slate-300">·</span>
          <span className="tabular-nums">{extra}</span>
        </>
      )}
    </>
  );
}

/** Chips on the left, Start/Pause and Reset on the right (stacked on a phone). */
export function Toolbar({ label, options, value, onChange, cols = 'grid-cols-1 sm:grid-cols-3', accent, children }) {
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

export function PlayButtons({ common, running, started, done, onToggle, onReset, playLabel }) {
  return (
    <>
      <Btn variant="primary" icon={running ? Pause : Play} onClick={onToggle} className="xl:min-w-[148px] min-h-[52px] text-[15px]">
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
            <span className="text-gray-500">{r.approx ? '≈' : '='}</span>
            <span className="font-serif italic text-gray-200">{rich(r.formula)}</span>
            {r.subst && (
              <>
                <span className="text-gray-500">=</span>
                <span className="text-gray-300">{rich(r.subst)}</span>
              </>
            )}
            <span className="text-gray-500">{r.approx ? '≈' : '='}</span>
            <span className="font-semibold text-white">{rich(r.result)}</span>
          </li>
        ))}
      </ul>
      {note && <p className="mt-2 text-xs leading-snug text-gray-500">{note}</p>}
    </div>
  );
}
