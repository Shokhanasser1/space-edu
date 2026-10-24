import { useCallback, useSyncExternalStore } from 'react';
import { Pause, Play, RotateCcw, Ruler, Timer } from 'lucide-react';

import { Arrow, Btn, clamp, fmt, niceStep, textWidth, useElementSize } from '../kit/ui';

/**
 * Pieces shared by the four labs of the lesson "Conditions of equilibrium":
 * the light scene shell, force arrows with symbol labels (subscripts written
 * as `F_{1}`), curved moment arrows, dimension lines for lever arms, the
 * method panel and Start/Pause/Reset. No words live here — every label
 * arrives through props from the lesson's TEXT table.
 */

export const G = 9.8; // m/s²

export const rad = (d) => (d * Math.PI) / 180;
export const deg = (r) => (r * 180) / Math.PI;

/** fmt with a true minus sign. */
export function num(n, digits = 1, decimal = '.') {
  return fmt(n, digits, decimal).replace('-', '−');
}

/** Rounds up to a multiple of 4, so a graph's quarter ticks are whole numbers. */
export function ceil4(v, min = 4) {
  return Math.max(min, Math.ceil((v - 1e-9) / 4) * 4);
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

/** Splits "F_{1}·d_{1}" into plain and subscript runs. */
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

/** HTML text with `_{…}` subscripts (the serif italic has no glyphs for ₁, ₂). */
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
export function SvgSym({ x, y, text, value, color, fs = 12, anchor = 'middle', weight = 700, halo = true }) {
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
      <tspan key={i} dy={dy} fontSize={p.sub ? fs * 0.74 : fs} fontStyle={p.sub ? 'normal' : 'italic'}>
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

/** Keeps a label of width `w` (anchored at x with `anchor`) inside the box; returns the shifted x. */
function keepIn(x, w, anchor, box) {
  if (!box) return x;
  const left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  return x + clamp(left, 4, box.w - w - 4) - left;
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
  const ly = y + dy + uy * g;
  let anchor = ux > 0.38 ? 'start' : ux < -0.38 ? 'end' : 'middle';
  let base = ly + (uy > 0.38 ? fs * 0.85 : uy < -0.38 ? 0 : fs * 0.36);
  if (labelAt) {
    lx = labelAt.x;
    base = labelAt.y;
    anchor = labelAt.anchor ?? anchor;
  }
  if (box && label) {
    lx = keepIn(lx, symWidth(label, value, fs), anchor, box);
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
export function AngleArc({ cx, cy, r, from, to, label, color = '#475569', fs = 12, labelR }) {
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
      <path d={`M${x1},${y1} A${r},${r} 0 0 ${d > 0 ? 1 : 0} ${x2},${y2}`} fill="none" stroke={color} strokeWidth="1.5" />
      {label && <SvgSym x={cx + lr * Math.cos(mid)} y={cy + lr * Math.sin(mid) + fs * 0.35} text={label} color={color} fs={fs} />}
    </g>
  );
}

/**
 * A curved arrow — the picture of a moment of force — around (cx, cy) at
 * radius r, from screen angle `from` (radians) sweeping by `sweep` (radians;
 * positive turns clockwise on screen, negative anticlockwise). The head sits
 * at the end. `labelAt` = { x, y, anchor } places the label.
 */
export function MomentArc({ cx, cy, r, from, sweep, color, width = 3, head = 11, label, value, fs = 12, labelAt, box, opacity = 1, dash }) {
  if (Math.abs(sweep) < 0.03 || r < 4) return null;
  const dir = Math.sign(sweep);
  const end = from + sweep;
  const h = Math.min(head, Math.abs(sweep) * r * 0.65);
  const endLine = end - (dir * h * 0.85) / r;
  const p0 = { x: cx + r * Math.cos(from), y: cy + r * Math.sin(from) };
  const p1 = { x: cx + r * Math.cos(endLine), y: cy + r * Math.sin(endLine) };
  const large = Math.abs(endLine - from) > Math.PI ? 1 : 0;
  const tip = { x: cx + r * Math.cos(end), y: cy + r * Math.sin(end) };
  // the head points along the chord from its base to the tip, so it follows the curve
  const back = end - (dir * h) / r;
  const b = { x: cx + r * Math.cos(back), y: cy + r * Math.sin(back) };
  const tl = Math.hypot(tip.x - b.x, tip.y - b.y) || 1;
  const tx = (tip.x - b.x) / tl;
  const ty = (tip.y - b.y) / tl;
  const hw = h * 0.52;
  let lab = null;
  if (label) {
    const mid = from + sweep * 0.55;
    const lr = r + fs * 0.9;
    let lx = labelAt?.x ?? cx + lr * Math.cos(mid);
    let ly = labelAt?.y ?? cy + lr * Math.sin(mid) + fs * 0.35;
    const anchor = labelAt?.anchor ?? (Math.cos(mid) > 0.3 ? 'start' : Math.cos(mid) < -0.3 ? 'end' : 'middle');
    if (box) {
      lx = keepIn(lx, symWidth(label, value, fs), anchor, box);
      ly = clamp(ly, fs + 2, box.h - 4);
    }
    lab = <SvgSym x={lx} y={ly} text={label} value={value} color={color} fs={fs} anchor={anchor} />;
  }
  return (
    <g opacity={opacity} pointerEvents="none">
      <path
        d={`M${p0.x},${p0.y} A${r},${r} 0 ${large} ${dir > 0 ? 1 : 0} ${p1.x},${p1.y}`}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={dash}
      />
      <path
        d={`M${tip.x},${tip.y} L${b.x - ty * hw},${b.y + tx * hw} L${b.x + ty * hw},${b.y - tx * hw} Z`}
        fill={color}
        stroke={color}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {lab}
    </g>
  );
}

/**
 * A dimension line between two points (a lever arm, a radius): end bars, and
 * a label beside its middle on side `side` (+1 / −1 of the left normal).
 */
export function DimLine({ x1, y1, x2, y2, color, label, value, fs = 12, side = 1, width = 2, bar = 6, labelAt, box, dash }) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 3) return null;
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const nx = -uy;
  const ny = ux;
  let lab = null;
  if (label) {
    const off = fs * 0.9 * side;
    let lx = labelAt?.x ?? (x1 + x2) / 2 + nx * off;
    let ly = labelAt?.y ?? (y1 + y2) / 2 + ny * off + fs * 0.36;
    const anchor = labelAt?.anchor ?? (Math.abs(nx * side) > 0.6 ? (nx * side > 0 ? 'start' : 'end') : 'middle');
    if (box) {
      lx = keepIn(lx, symWidth(label, value, fs), anchor, box);
      ly = clamp(ly, fs + 2, box.h - 4);
    }
    lab = <SvgSym x={lx} y={ly} text={label} value={value} color={color} fs={fs} anchor={anchor} />;
  }
  return (
    <g pointerEvents="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={dash} />
      <line x1={x1 - nx * bar} y1={y1 - ny * bar} x2={x1 + nx * bar} y2={y1 + ny * bar} stroke={color} strokeWidth={1.6} />
      <line x1={x2 - nx * bar} y1={y2 - ny * bar} x2={x2 + nx * bar} y2={y2 + ny * bar} stroke={color} strokeWidth={1.6} />
      {lab}
    </g>
  );
}

/** A right-angle mark at corner (x, y) between the unit directions u and v (screen). */
export function RightAngle({ x, y, ux, uy, vx, vy, s = 8, color = '#475569' }) {
  return (
    <path
      d={`M${x + ux * s},${y + uy * s} L${x + ux * s + vx * s},${y + uy * s + vy * s} L${x + vx * s},${y + vy * s}`}
      fill="none"
      stroke={color}
      strokeWidth="1.4"
      pointerEvents="none"
    />
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

/** The dark panel that holds sliders, graphs and the method. */
export function Panel({ children, className = '' }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4 ${className}`}>{children}</div>;
}

/** A small "title + three numbers" box for the dark panels. `items` = [[term, value, colour]]. */
export function InfoBox({ title, items, children }) {
  return (
    <div className="rounded-xl bg-black/25 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{title}</p>
      <dl className="mt-1.5 grid grid-cols-3 gap-2 text-center">
        {items.map(([k, val, c]) => (
          <div key={k}>
            <dt className="text-[11px] leading-tight text-gray-500">
              <Sym>{k}</Sym>
            </dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums" style={{ color: c }}>
              <Sym>{val}</Sym>
            </dd>
          </div>
        ))}
      </dl>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

function LegendItem({ color, label, kind = 'line' }) {
  return (
    <li className="flex items-center gap-1.5">
      <svg width="20" height="12" aria-hidden="true" className="shrink-0">
        {kind === 'dash' && (
          <>
            <line x1="1" y1="6" x2="13" y2="6" stroke={color} strokeWidth="2" strokeDasharray="3 2" />
            <path d="M19,6 L12,2.5 L12,9.5 Z" fill={color} />
          </>
        )}
        {(kind === 'line' || kind === 'arrow') && (
          <line x1="1" y1="6" x2={kind === 'arrow' ? 13 : 19} y2="6" stroke={color} strokeWidth="3" strokeLinecap="round" />
        )}
        {kind === 'arrow' && <path d="M19,6 L12,2 L12,10 Z" fill={color} />}
        {kind === 'arc' && (
          <>
            <path d="M3,10 A7,7 0 0 1 15,5" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
            <path d="M18.5,7.5 L12.5,2.2 L11.8,8.6 Z" fill={color} />
          </>
        )}
        {kind === 'dim' && (
          <>
            <line x1="2" y1="6" x2="18" y2="6" stroke={color} strokeWidth="2" />
            <line x1="2" y1="2" x2="2" y2="10" stroke={color} strokeWidth="1.6" />
            <line x1="18" y1="2" x2="18" y2="10" stroke={color} strokeWidth="1.6" />
          </>
        )}
        {kind === 'dot' && <circle cx="10" cy="6" r="4.5" fill={color} />}
        {kind === 'dashline' && <line x1="1" y1="6" x2="19" y2="6" stroke={color} strokeWidth="1.8" strokeDasharray="4 3" />}
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

/** A light metre grid with a fixed step (world units), drawn through the view. */
export function PaperGrid({ view, W, H, step, color = '#e8edf3', strong }) {
  const lines = [];
  const x0 = Math.ceil(view.wx(0) / step) * step;
  const y0 = Math.ceil(view.wy(H) / step) * step;
  for (let x = x0; x <= view.wx(W) + 1e-9; x += step) {
    const strongLine = strong && Math.abs(x) < 1e-9;
    lines.push(<line key={`gx${x.toFixed(4)}`} x1={view.sx(x)} x2={view.sx(x)} y1={0} y2={H} stroke={strongLine ? strong : color} strokeWidth={1} />);
  }
  for (let y = y0; y <= view.wy(0) + 1e-9; y += step) {
    const strongLine = strong && Math.abs(y) < 1e-9;
    lines.push(<line key={`gy${y.toFixed(4)}`} x1={0} x2={W} y1={view.sy(y)} y2={view.sy(y)} stroke={strongLine ? strong : color} strokeWidth={1} />);
  }
  return <g aria-hidden="true">{lines}</g>;
}

/* ------------------------------------------------------ free-body paper */

/** A small light paper for a free-body diagram, with a title chip. */
export function FbdPaper({ title, height = 236, ariaLabel, children }) {
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 220);
  const lines = [];
  for (let x = 20; x < W; x += 20) lines.push(<line key={`v${x}`} x1={x} x2={x} y1={0} y2={height} stroke="#eef2f7" />);
  for (let y = 20; y < height; y += 20) lines.push(<line key={`h${y}`} x1={0} x2={W} y1={y} y2={y} stroke="#eef2f7" />);
  return (
    <div ref={ref} className="relative overflow-hidden rounded-xl border border-slate-300/70 bg-white">
      <svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} role="img" aria-label={ariaLabel} className="cl-scene block select-none">
        <rect width={W} height={height} fill="#fbfcfe" />
        <g aria-hidden="true">{lines}</g>
        {width > 0 && children(W, height)}
      </svg>
      {title && (
        <span className="pointer-events-none absolute left-2 top-2 rounded-lg border border-slate-200 bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
          {title}
        </span>
      )}
    </div>
  );
}

/** A dashed coordinate axis through (x, y) along the unit vector (ux, uy). */
export function FbdAxis({ x, y, ux, uy, len, back = 0.6, label, fs = 12 }) {
  const x2 = x + ux * len;
  const y2 = y + uy * len;
  const nx = -uy;
  const ny = ux;
  return (
    <g aria-hidden="true" pointerEvents="none">
      <line x1={x - ux * len * back} y1={y - uy * len * back} x2={x2 - ux * 7} y2={y2 - uy * 7} stroke="#94a3b8" strokeWidth="1.3" strokeDasharray="5 4" />
      <path d={`M${x2},${y2} L${x2 - ux * 9 + nx * 4},${y2 - uy * 9 + ny * 4} L${x2 - ux * 9 - nx * 4},${y2 - uy * 9 - ny * 4} Z`} fill="#94a3b8" />
      <text x={x2 + ux * 9} y={y2 + uy * 9 + fs * 0.36} textAnchor="middle" fontSize={fs} fontStyle="italic" fontWeight="700" fill="#475569">
        {label}
      </text>
    </g>
  );
}

/* ------------------------------------------------------------ the method */

/**
 * The scene beside the method panel. On desktop the two sit side by side and
 * the scene takes the panel's height (`renderScene(fitH)`); below that they
 * stack and the scene keeps its own height (fitH = null).
 */
export function SceneRow({ renderScene, method }) {
  const [ref, size] = useElementSize();
  const lg = useMediaQuery('(min-width: 1024px)');
  const fitH = lg && size.height > 0 ? Math.max(452, Math.round(size.height)) : null;
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      {renderScene(fitH)}
      <div ref={ref}>{method}</div>
    </div>
  );
}

/** The panel of numbered steps beside the scene, with a formula badge. */
export function MethodPanel({ badge, title, top, children, className = '' }) {
  return (
    <Panel className={className}>
      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-100">
        {badge && <span className="rounded-md border border-white/10 bg-white/10 px-1.5 py-0.5 font-serif text-[13px] italic">{badge}</span>}
        {title}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        {top && <div>{top}</div>}
        <ol className={`space-y-2.5 ${top ? '' : 'sm:col-span-2 lg:col-span-1'}`}>{children}</ol>
      </div>
    </Panel>
  );
}

export function Step({ n, title, children }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-400/15 text-[11px] font-bold text-cyan-300" aria-hidden="true">
        {n}
      </span>
      <div className="min-w-0 flex-1 text-[13px] leading-snug text-gray-300">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500">
          <Sym>{title}</Sym>
        </p>
        {children}
      </div>
    </li>
  );
}

/** One equation: an axis tag, the formula, and the same with numbers. */
export function Eq({ tag, sym, nums, result, resultColor = '#fdba74' }) {
  return (
    <div className="mt-1">
      <p className="flex flex-wrap items-baseline gap-x-2">
        {tag && <span className="min-w-7 shrink-0 text-[11px] font-semibold text-cyan-300/80">{tag}</span>}
        <span className="font-serif text-[14.5px] italic text-gray-100">
          <Sym>{sym}</Sym>
        </span>
      </p>
      {(nums || result) && (
        <p className={`tabular-nums text-gray-400 ${tag ? 'pl-9' : ''}`}>
          {nums && <Sym>{nums}</Sym>}
          {result && (
            <>
              {' '}
              <b style={{ color: resultColor }}>
                <Sym>{result}</Sym>
              </b>
            </>
          )}
        </p>
      )}
    </div>
  );
}

/** Coloured chips naming the forces of the diagram. */
export function ForceChips({ items, prefix }) {
  return (
    <p className="mt-1 flex flex-wrap items-center gap-1.5">
      {prefix && <span className="text-xs text-gray-400">{prefix}</span>}
      {items.map((f) => (
        <span key={f.sym} className="rounded-md border px-1.5 py-0.5 font-serif text-[13px] italic" style={{ borderColor: `${f.color}88`, background: `${f.color}22`, color: f.text }}>
          <Sym>{f.sym}</Sym>
        </span>
      ))}
    </p>
  );
}
