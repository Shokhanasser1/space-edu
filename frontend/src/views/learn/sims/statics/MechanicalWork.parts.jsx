import { useCallback, useSyncExternalStore } from 'react';
import { Pause, Play, RotateCcw, Ruler, Timer } from 'lucide-react';

import { Arrow, Btn, clamp, fmt, niceStep, textWidth, useElementSize } from '../kit/ui';
import { PALETTE } from '../kit/scene';

/**
 * Pieces shared by the four labs of the lesson "Mechanical work": the light
 * scene shell, force arrows with symbol labels (subscripts written as
 * `F_{ishq}`), angle arcs and right-angle marks, the displacement arrow, a
 * crate, a coil spring, a pictogram person, a dark graph with shaded areas
 * and Start/Pause/Reset. No words live here — every label arrives through
 * props from the lesson's TEXT table.
 */

export const G = 9.8; // m/s²

/** One colour per kind of force (as in the dynamics lessons; the normal force is teal here, blue is the displacement). */
export const FC = {
  weight: '#dc2626',
  weightText: '#fca5a5',
  normal: '#0d9488',
  normalText: '#5eead4',
  fric: '#7c3aed',
  fricText: '#c4b5fd',
  pull: '#db2777',
  pullText: '#f9a8d4',
  vel: PALETTE.vel,
  velText: PALETTE.velText,
  disp: PALETTE.disp,
  dispText: PALETTE.dispText,
};

/** The sign of work, the same in every tab: positive green, zero grey, negative rose. */
export const WC = {
  pos: '#10b981',
  posText: '#6ee7b7',
  posInk: '#047857',
  posPaper: '#d1fae5',
  zero: '#94a3b8',
  zeroText: '#e2e8f0',
  zeroInk: '#475569',
  zeroPaper: '#e2e8f0',
  neg: '#f43f5e',
  negText: '#fda4af',
  negInk: '#be123c',
  negPaper: '#ffe4e6',
};

export const rad = (d) => (d * Math.PI) / 180;
export const deg = (r) => (r * 180) / Math.PI;

/** fmt with a true minus sign. */
export function num(n, digits = 1, decimal = '.') {
  return fmt(n, digits, decimal).replace('-', '−');
}

/** 'pos' | 'zero' | 'neg' for a value as it is shown with `digits` decimals. */
export function signKey(n, digits = 0) {
  const v = Number(fmt(n, digits, '.'));
  return v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero';
}

/** "+250", "−250" or "0" (the sign as shown with `digits` decimals). */
export function signed(n, digits = 0, decimal = '.') {
  const s = num(n, digits, decimal);
  return signKey(n, digits) === 'pos' ? `+${s}` : s;
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
/** 1.98e20 -> "2.0·10²⁰". */
export function sci(n, digits = 1, decimal = '.') {
  if (!Number.isFinite(n) || n === 0) return fmt(n, digits, decimal);
  let e = Math.floor(Math.log10(Math.abs(n)));
  let mant = n / 10 ** e;
  if (Math.abs(Number(mant.toFixed(digits))) >= 10) {
    e += 1;
    mant /= 10;
  }
  const pow = String(e)
    .split('')
    .map((ch) => (ch === '-' ? '⁻' : SUP[Number(ch)]))
    .join('');
  return `${num(mant, digits, decimal)}·10${pow}`;
}

/** Rounds up to a "nice" axis maximum (1, 2, 2.5, 5 × 10^n). */
export function niceCeil(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v - 1e-9) return m * p;
  return 10 * p;
}

/** True while the media query matches (subscribed with matchMedia, cleaned up on unmount). */
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/* ------------------------------------------------------------ symbols */

/** Splits "F_{ishq} = μN" into plain and subscript runs. */
function splitSym(text) {
  const out = [];
  const re = /_\{([^}]*)\}/g;
  let last = 0;
  let m = re.exec(text);
  while (m) {
    if (m.index > last) out.push({ t: text.slice(last, m.index) });
    out.push({ t: m[1], sub: true });
    last = re.lastIndex;
    m = re.exec(text);
  }
  if (last < text.length) out.push({ t: text.slice(last) });
  return out;
}

/** HTML text with `_{…}` subscripts. */
export function Sym({ children }) {
  if (typeof children !== 'string') return children ?? null;
  return (
    <>
      {splitSym(children).map((p, i) =>
        p.sub ? (
          <sub key={i} className="text-[0.72em] not-italic">
            {p.t}
          </sub>
        ) : (
          <span key={i}>{p.t}</span>
        ),
      )}
    </>
  );
}

/** Approximate pixel width of an SVG symbol label. */
export function symWidth(text, value, fs = 12) {
  let w = 0;
  for (const p of splitSym(text)) w += textWidth(p.t, p.sub ? fs * 0.74 : fs, 700);
  if (value) w += textWidth(` = ${value}`, fs, 600);
  return w;
}

/** An SVG label: italic symbol with subscripts, then an optional " = value". */
export function SvgSym({ x, y, text, value, color, fs = 12, anchor = 'middle', weight = 700, halo = true, italic = true }) {
  const parts = splitSym(text);
  const shift = fs * 0.3;
  let low = false;
  const spans = parts.map((p, i) => {
    let dy;
    if (p.sub && !low) {
      dy = shift;
      low = true;
    } else if (!p.sub && low) {
      dy = -shift;
      low = false;
    }
    return (
      <tspan key={i} dy={dy} fontSize={p.sub ? fs * 0.74 : fs} fontStyle={p.sub || !italic ? 'normal' : 'italic'}>
        {p.t}
      </tspan>
    );
  });
  const endLow = low;
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={fs}
      fontWeight={weight}
      fill={color}
      stroke={halo ? '#fff' : undefined}
      strokeWidth={halo ? 3.2 : 0}
      strokeLinejoin="round"
      paintOrder="stroke"
      pointerEvents="none"
    >
      {spans}
      {value && (
        <tspan dy={endLow ? -shift : undefined} fontStyle="normal" fontWeight={600}>
          {` = ${value}`}
        </tspan>
      )}
    </text>
  );
}

/**
 * A force (or any vector) drawn from (x, y) by (dx, dy) pixels, labelled at
 * its tip. `labelAt` = { x, y, anchor } overrides the label position; `box`
 * = { w, h } keeps the label inside the drawing.
 */
export function ForceArrow({ x, y, dx, dy, color, label, value, fs = 12, width = 3.2, head = 11, dash, opacity = 1, gap = 7, box, labelAt }) {
  const len = Math.hypot(dx, dy);
  if (len < 2) return null;
  const ux = dx / len;
  const uy = dy / len;
  const g = len < 26 ? gap + 6 : gap;
  let lx = x + dx + ux * g;
  let ly = y + dy + uy * g;
  let anchor = ux > 0.38 ? 'start' : ux < -0.38 ? 'end' : 'middle';
  let base = ly + (uy > 0.38 ? fs * 0.85 : uy < -0.38 ? 0 : fs * 0.36);
  if (labelAt) {
    lx = labelAt.x;
    base = labelAt.y;
    anchor = labelAt.anchor ?? anchor;
  }
  if (box && label) {
    const w = symWidth(label, value, fs);
    const left = anchor === 'start' ? lx : anchor === 'end' ? lx - w : lx - w / 2;
    lx += clamp(left, 4, box.w - w - 4) - left;
    base = clamp(base, fs + 2, box.h - 4);
  }
  return (
    <g opacity={opacity}>
      <Arrow x1={x} y1={y} x2={x + dx} y2={y + dy} color={color} width={width} head={head} dash={dash} />
      {label && <SvgSym x={lx} y={base} text={label} value={value} color={color} fs={fs} anchor={anchor} />}
    </g>
  );
}

/** Label position beside the middle of segment p1→p2, on the side away from point `away`. */
export function sideLabel(p1, p2, away, dist = 12) {
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  const len = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
  let nx = -(p2.y - p1.y) / len;
  let ny = (p2.x - p1.x) / len;
  if ((mx + nx - away.x) ** 2 + (my + ny - away.y) ** 2 < (mx - nx - away.x) ** 2 + (my - ny - away.y) ** 2) {
    nx = -nx;
    ny = -ny;
  }
  return { x: mx + nx * dist, y: my + ny * dist + 4, anchor: nx > 0.3 ? 'start' : nx < -0.3 ? 'end' : 'middle' };
}

/** A small angle arc at (cx, cy) between screen angles `from` and `to` (radians), the shorter way. */
export function AngleArc({ cx, cy, r, from, to, label, color = '#475569', fs = 12, labelR, width = 1.6 }) {
  let d = to - from;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  if (Math.abs(d) < 1e-3) return null;
  const x1 = cx + r * Math.cos(from);
  const y1 = cy + r * Math.sin(from);
  const x2 = cx + r * Math.cos(from + d);
  const y2 = cy + r * Math.sin(from + d);
  const mid = from + d / 2;
  const lr = labelR ?? r + fs * 0.85;
  return (
    <g pointerEvents="none">
      <path d={`M${x1},${y1} A${r},${r} 0 0 ${d > 0 ? 1 : 0} ${x2},${y2}`} fill="none" stroke={color} strokeWidth={width} />
      {label && (
        <text
          x={cx + lr * Math.cos(mid)}
          y={cy + lr * Math.sin(mid) + fs * 0.35}
          textAnchor="middle"
          fontSize={fs}
          fontStyle="italic"
          fontWeight="700"
          fill={color}
          stroke="#fff"
          strokeWidth="3"
          paintOrder="stroke"
        >
          {label}
        </text>
      )}
    </g>
  );
}

/** A right-angle mark at (x, y) between the unit directions (ax, ay) and (bx, by). */
export function RightAngle({ x, y, ax, ay, bx, by, size = 11, color = '#475569' }) {
  const p1 = { x: x + ax * size, y: y + ay * size };
  const p2 = { x: x + (ax + bx) * size, y: y + (ay + by) * size };
  const p3 = { x: x + bx * size, y: y + by * size };
  return <path d={`M${p1.x},${p1.y} L${p2.x},${p2.y} L${p3.x},${p3.y}`} fill="none" stroke={color} strokeWidth="1.6" pointerEvents="none" />;
}

/** A rounded label pill in SVG (centred at x, y), kept inside `box`. */
export function TagPill({ x, y, text, bg, color = '#fff', fs = 12, box, weight = 700, border }) {
  if (!text) return null;
  const w = symWidth(text, null, fs) + 16;
  const h = fs + 10;
  let left = x - w / 2;
  let top = y - h / 2;
  if (box) {
    left = clamp(left, 4, box.w - w - 4);
    top = clamp(top, 4, box.h - h - 4);
  }
  return (
    <g pointerEvents="none">
      <rect x={left} y={top} width={w} height={h} rx={h / 2} fill={bg} stroke={border} strokeWidth={border ? 1 : 0} />
      <SvgSym x={left + w / 2} y={top + h / 2 + fs * 0.36} text={text} color={color} fs={fs} weight={weight} halo={false} italic={false} />
    </g>
  );
}

/* -------------------------------------------------------------- controls */

/** Start / Pause / Resume / Again + Reset, in the reference's size. */
export function PlayControls({ labels, running, done, started, onToggle, onReset, disabled, className = '' }) {
  return (
    <div className={`grid grid-cols-2 gap-2 xl:flex ${className}`}>
      <Btn variant="primary" icon={running ? Pause : Play} onClick={onToggle} disabled={disabled} className="xl:min-w-[148px] min-h-[52px] text-[15px]">
        {running ? labels.pause : done ? labels.again : started ? labels.resume : labels.start}
      </Btn>
      <Btn icon={RotateCcw} onClick={onReset} disabled={!started && !running} className="min-h-[52px] text-[15px]">
        {labels.reset}
      </Btn>
    </div>
  );
}

/** Small caption above a group of controls. */
export function GroupLabel({ children }) {
  return <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{children}</p>;
}

/** The dark panel that holds sliders, graphs and side notes. */
export function Panel({ children, className = '' }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4 ${className}`}>{children}</div>;
}

/* ---------------------------------------------------------------- scene */

function LegendItem({ color, label, kind = 'line' }) {
  return (
    <li className="flex items-center gap-1.5">
      <svg width="20" height="10" aria-hidden="true" className="shrink-0">
        {kind === 'dash' && (
          <>
            <line x1="1" y1="5" x2="13" y2="5" stroke={color} strokeWidth="2" strokeDasharray="3 2" />
            <path d="M19,5 L12,1.5 L12,8.5 Z" fill={color} />
          </>
        )}
        {(kind === 'line' || kind === 'arrow') && <line x1="1" y1="5" x2={kind === 'arrow' ? 13 : 19} y2="5" stroke={color} strokeWidth="3" strokeLinecap="round" />}
        {kind === 'arrow' && <path d="M19,5 L12,1 L12,9 Z" fill={color} />}
        {kind === 'area' && <rect x="2" y="1" width="16" height="8" rx="2" fill={color} opacity="0.35" stroke={color} strokeWidth="1" />}
        {kind === 'dot' && <circle cx="10" cy="5" r="4" fill={color} />}
      </svg>
      <span>
        <Sym>{label}</Sym>
      </span>
    </li>
  );
}

/** A chip in the scene's top-right corner (time, force scale…). */
export function Chip({ icon: Icon = Timer, children, color = '#0891b2' }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[11px] sm:text-[12px] font-medium tabular-nums text-slate-600 shadow-sm">
      {Icon && <Icon size={14} style={{ color }} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** The force-scale chip: a bar of a round number of newtons at `kF` px per newton. */
export function ForceScale({ kF, label, unit, decimal = '.' }) {
  const step = niceStep(kF, 22);
  const px = step * kF;
  return (
    <Chip icon={Ruler} color="#dc2626">
      {label}
      <svg width={px + 4} height="10" aria-hidden="true" className="shrink-0">
        <line x1="2" y1="5" x2={px + 2} y2="5" stroke="#0f172a" strokeWidth="2.5" />
        <line x1="2" y1="1" x2="2" y2="9" stroke="#0f172a" strokeWidth="1.5" />
        <line x1={px + 2} y1="1" x2={px + 2} y2="9" stroke="#0f172a" strokeWidth="1.5" />
      </svg>
      {fmt(step, Number.isInteger(step) ? 0 : 1, decimal)} {unit}
    </Chip>
  );
}

/**
 * The light scene panel of the chosen design. `height(W, narrow)` sizes the
 * drawing; `children(W, H, narrow)` draws it; `chips(W, narrow, H)` (or a node)
 * fills the top-right corner. The legend floats over the top-left from `sm`
 * up and moves under the scene on phones.
 */
export function LabScene({ legend = [], chips, height, ariaLabel, children, minW = 280, className = '' }) {
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, minW);
  const narrow = W < 560;
  const H = Math.round(typeof height === 'function' ? height(W, narrow) : height);
  const chipNode = typeof chips === 'function' ? chips(W, narrow, H) : chips;
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-300/70 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_30px_-12px_rgba(0,0,0,0.6)] ${className}`}
    >
      <div ref={ref} className="w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="cl-scene block select-none">
          <rect width={W} height={H} fill="#fbfcfe" />
          {width > 0 && children(W, H, narrow)}
        </svg>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 sm:p-3">
        {legend.length > 0 && (
          <ul className="hidden sm:flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-[12px] text-slate-600 shadow-sm backdrop-blur">
            {legend.map((l, i) => (
              <LegendItem key={i} {...l} />
            ))}
          </ul>
        )}
        {chipNode && <div className="ml-auto flex shrink-0 flex-col items-end gap-1.5">{chipNode}</div>}
      </div>
      {legend.length > 0 && (
        <ul className="flex sm:hidden flex-wrap gap-x-3 gap-y-1 border-t border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          {legend.map((l, i) => (
            <LegendItem key={i} {...l} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Light metre grid lines over the drawing, from a px-per-metre mapping. */
export function PaperGrid({ W, H, x0px, y0px, step, color = '#eef2f7' }) {
  const lines = [];
  if (step < 6) return null;
  for (let x = x0px % step; x < W; x += step) lines.push(<line key={`v${x}`} x1={x} x2={x} y1={0} y2={H} stroke={color} />);
  for (let y = y0px % step; y < H; y += step) lines.push(<line key={`h${y}`} x1={0} x2={W} y1={y} y2={y} stroke={color} />);
  return <g aria-hidden="true">{lines}</g>;
}

/** Ground: a hatched strip under the line y = `y` across the drawing. */
export function Ground({ W, y, depth = 14, color = '#64748b', fill = '#f1f5f9', x0 = 0 }) {
  const hatch = [];
  const d = Math.min(depth, 22);
  for (let x = x0 - d; x < W + d; x += 12) {
    hatch.push(<line key={x} x1={x} y1={y + d} x2={x + d} y2={y} stroke="#cbd5e1" strokeWidth="1.2" />);
  }
  return (
    <g aria-hidden="true">
      <rect x={x0} y={y} width={W - x0} height={depth} fill={fill} />
      {hatch}
      <line x1={x0} x2={W} y1={y} y2={y} stroke={color} strokeWidth="2" />
    </g>
  );
}

/** A displacement arrow from x1 to x2 at height y with a centred label under it. */
export function DispArrow({ x1, x2, y, label, fs = 12, box, color = FC.disp, tick = 7 }) {
  const len = Math.abs(x2 - x1);
  return (
    <g pointerEvents="none">
      <line x1={x1} x2={x1} y1={y - tick} y2={y + tick} stroke={color} strokeWidth="1.6" />
      {len > 4 && <Arrow x1={x1} y1={y} x2={x2} y2={y} color={color} width={2.6} head={Math.min(11, len * 0.6)} />}
      {label && <TagPill x={(x1 + x2) / 2} y={y + fs + 6} text={label} bg={color} fs={fs - 0.5} box={box} />}
    </g>
  );
}

/** A wooden crate with planks; (x, y) is its top-left corner. */
export function Crate({ x, y, w, h, label, fs = 11, ghost = false, corner = false }) {
  if (ghost) {
    return <rect x={x} y={y} width={w} height={h} rx={3} fill="none" stroke="#94a3b8" strokeWidth="1.4" strokeDasharray="4 3" pointerEvents="none" />;
  }
  return (
    <g pointerEvents="none">
      <rect x={x} y={y} width={w} height={h} rx={3} fill="#fcd9a8" stroke="#b7791f" strokeWidth="2" />
      <line x1={x + 3} x2={x + w - 3} y1={y + h * 0.36} y2={y + h * 0.36} stroke="#e0b07a" strokeWidth="1.2" />
      <line x1={x + 3} x2={x + w - 3} y1={y + h * 0.68} y2={y + h * 0.68} stroke="#e0b07a" strokeWidth="1.2" />
      {label && w > (corner ? 60 : 30) && (
        <text x={corner ? x + 4 : x + w / 2} y={corner ? y + fs + 1 : y + h / 2 + fs * 0.36} textAnchor={corner ? 'start' : 'middle'} fontSize={fs} fontWeight="700" fill="#92400e">
          {label}
        </text>
      )}
    </g>
  );
}

/**
 * A coil spring from (x1, y1) to (x2, y2): straight leads at both ends and
 * `turns` turns of radius `r` between them, the back half of each turn
 * lighter than the front, so it reads as a helix.
 */
export function Coil({ x1, y1, x2, y2, turns = 12, r = 10, lead = 8, color = '#475569', back = '#a8b3c3', width = 2.4 }) {
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
 * A pictogram person standing (feet centred at `x`, ground at `y`), `k` px per
 * metre, facing right. `hand` = { x, y } is where the front hand goes (px);
 * `back` the back hand (defaults to hanging). `walk` (radians) swings the legs.
 * `elbow` / `backElbow` = ±1 bend the elbows clockwise / anticlockwise.
 */
export function Person({ x, y, k, hand, back, walk = null, color = '#334155', elbow = 1, backElbow = 1 }) {
  const m = (v) => v * k;
  const hip = { x, y: y - m(0.95) };
  const sh = { x: x + m(0.02), y: y - m(1.42) };
  const head = { x: x + m(0.04), y: y - m(1.6) };
  const lw = Math.max(3, m(0.085));
  const swing = walk === null ? 0.12 : Math.sin(walk) * 0.32;
  const legs = [
    { x: x + m(swing), y },
    { x: x - m(swing), y },
  ];
  const arm = (target, sgn) => {
    const up = 0.31;
    const lo = 0.3;
    const dx = target.x - sh.x;
    const dy = target.y - sh.y;
    const dist = Math.hypot(dx, dy);
    const reach = m(up + lo) * 0.999;
    const d = Math.min(dist, reach);
    const ux = dx / (dist || 1);
    const uy = dy / (dist || 1);
    const end = { x: sh.x + ux * d, y: sh.y + uy * d };
    // elbow bends outward-down (law of cosines)
    const a = m(up);
    const b = m(lo);
    const cosA = clamp((a * a + d * d - b * b) / (2 * a * d || 1), -1, 1);
    const ang = Math.acos(cosA);
    const base = Math.atan2(uy, ux);
    const el = { x: sh.x + a * Math.cos(base + sgn * ang), y: sh.y + a * Math.sin(base + sgn * ang) };
    return `M${sh.x},${sh.y} L${el.x},${el.y} L${end.x},${end.y}`;
  };
  const backHand = back ?? { x: x - m(walk === null ? 0.05 : Math.sin(walk) * 0.16), y: y - m(0.82) };
  return (
    <g pointerEvents="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d={arm(backHand, backElbow)} strokeWidth={lw * 0.85} opacity="0.55" />
      <path d={`M${hip.x},${hip.y} L${legs[1].x},${legs[1].y}`} strokeWidth={lw} opacity="0.55" />
      <path d={`M${hip.x},${hip.y} L${legs[0].x},${legs[0].y}`} strokeWidth={lw} />
      <path d={`M${hip.x},${hip.y} L${sh.x},${sh.y}`} strokeWidth={lw * 1.35} />
      <circle cx={head.x} cy={head.y} r={m(0.11)} fill={color} stroke="none" />
      <path d={arm(hand, elbow)} strokeWidth={lw * 0.85} />
    </g>
  );
}

/* ------------------------------------------------------------ the layout */

/**
 * The scene beside a side panel. On desktop the two sit side by side and the
 * scene takes the panel's height (`renderScene(fitH)`); below that they stack
 * and the scene keeps its own height (fitH = null).
 */
export function SceneRow({ renderScene, side, sideWidth = 390, minH = 452 }) {
  const [ref, size] = useElementSize();
  const lg = useMediaQuery('(min-width: 1024px)');
  const fitH = lg && size.height > 0 ? Math.max(minH, Math.round(size.height)) : null;
  return (
    <div className="grid gap-3 lg:items-start" style={lg ? { gridTemplateColumns: `minmax(0,1fr) ${sideWidth}px` } : undefined}>
      {renderScene(fitH)}
      <div ref={ref}>{side}</div>
    </div>
  );
}

/** A formula line: the symbolic formula, then the same with numbers and the result. */
export function Formula({ sym, nums, result, resultColor = '#fde68a', className = '' }) {
  return (
    <div className={`rounded-xl bg-black/25 px-3 py-2.5 ${className}`}>
      <p className="font-serif text-[17px] italic text-gray-100">
        <Sym>{sym}</Sym>
      </p>
      {(nums || result) && (
        <p className="mt-0.5 text-[14px] tabular-nums text-gray-400">
          {nums && <Sym>{nums}</Sym>}{' '}
          {result && (
            <b className="text-[16px]" style={{ color: resultColor }}>
              <Sym>{result}</Sym>
            </b>
          )}
        </p>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- graph */

/**
 * A graph for the dark panels (the kit's TimeGraph with more than one shaded
 * area and free ticks). `series` = [{ id, label, color, points, dash, dot,
 * line }]; `fills` = [{ id, color, opacity }] shade a series down to y = 0.
 */
export function DarkGraph({
  title,
  series,
  xMin = 0,
  xMax,
  yMax,
  yMin = 0,
  xTicks,
  yTicks,
  xLabel,
  yLabel,
  marker,
  note,
  height = 220,
  decimal = '.',
  ariaLabel,
  onScrub,
  fills = [],
  xDigits = 0,
  yDigits = 0,
}) {
  const [ref, { width }] = useElementSize();
  const H = height;
  const pad = { l: 48, r: 14, t: 18, b: 26 };
  const W = Math.max(width, 220);
  const gx = (v) => pad.l + ((v - xMin) / (xMax - xMin)) * (W - pad.l - pad.r);
  const gy = (v) => H - pad.b - ((v - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
  const yT = yTicks ?? [0, 0.25, 0.5, 0.75, 1].map((f) => yMin + f * (yMax - yMin));
  const xT = xTicks ?? [0, 0.25, 0.5, 0.75, 1].map((f) => xMin + f * (xMax - xMin));
  const zero = gy(clamp(0, yMin, yMax));
  const scrub = (e) => {
    if (!onScrub) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    onScrub(clamp(xMin + ((px - pad.l) / (W - pad.l - pad.r)) * (xMax - xMin), xMin, xMax));
  };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {title && <p className="text-sm font-semibold text-gray-200">{title}</p>}
        {series
          .filter((s) => s.label)
          .map((s) => (
            <span key={s.id} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="h-0.5 w-4 rounded" style={{ background: s.color }} /> <Sym>{s.label}</Sym>
            </span>
          ))}
      </div>
      <div ref={ref} className="mt-2 w-full">
        <svg
          width="100%"
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={ariaLabel ?? title}
          className={`block overflow-visible ${onScrub ? 'cursor-ew-resize touch-none' : ''}`}
          onPointerDown={(e) => {
            if (!onScrub) return;
            e.currentTarget.setPointerCapture?.(e.pointerId);
            scrub(e);
          }}
          onPointerMove={(e) => {
            if (onScrub && e.buttons) scrub(e);
          }}
        >
          {yT.map((v) => (
            <g key={`y${v}`}>
              <line x1={pad.l} x2={W - pad.r} y1={gy(v)} y2={gy(v)} stroke={Math.abs(v) < 1e-9 ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.08)'} />
              <text x={pad.l - 6} y={gy(v) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                {num(v, yDigits, decimal)}
              </text>
            </g>
          ))}
          {xT.map((v) => (
            <text key={`x${v}`} x={gx(v)} y={H - 6} textAnchor="middle" fontSize="11" fill="#94a3b8">
              {num(v, xDigits, decimal)}
            </text>
          ))}
          {xLabel && (
            <text x={W - pad.r} y={zero - 6} textAnchor="end" fontSize="11" fill="#64748b">
              {xLabel}
            </text>
          )}
          {yLabel && (
            <text x={pad.l + 6} y={pad.t - 6} fontSize="11" fill="#64748b">
              {yLabel}
            </text>
          )}
          <line x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.2)" />
          {fills.map((f) =>
            series
              .filter((s) => s.id === f.id && s.points.length > 1)
              .map((s) => (
                <polygon
                  key={`fill-${f.id}`}
                  points={[`${gx(s.points[0].x)},${zero}`, ...s.points.map((p) => `${gx(p.x)},${gy(p.y)}`), `${gx(s.points[s.points.length - 1].x)},${zero}`].join(' ')}
                  fill={f.color ?? s.color}
                  opacity={f.opacity ?? 0.2}
                />
              )),
          )}
          {marker !== undefined && marker !== null && (
            <line x1={gx(marker)} x2={gx(marker)} y1={pad.t} y2={H - pad.b} stroke="rgba(34,211,238,0.45)" strokeDasharray="3 4" />
          )}
          {series.map((s) => (
            <g key={s.id}>
              {s.line !== false && s.points.length > 1 && (
                <polyline
                  points={s.points.map((p) => `${gx(p.x).toFixed(1)},${gy(p.y).toFixed(1)}`).join(' ')}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={s.width ?? 2.5}
                  strokeDasharray={s.dash}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {s.points.length > 0 && s.dot !== false && s.line !== false && (
                <circle cx={gx(s.points[s.points.length - 1].x)} cy={gy(s.points[s.points.length - 1].y)} r="4.5" fill={s.color} stroke="#0b0b16" strokeWidth="1.5" />
              )}
            </g>
          ))}
        </svg>
      </div>
      {note && <p className="mt-1 text-xs text-gray-500 leading-snug">{note}</p>}
    </div>
  );
}
