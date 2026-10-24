import { useCallback, useSyncExternalStore } from 'react';
import { Pause, Play, RotateCcw, Ruler, Timer } from 'lucide-react';

import { Arrow, Btn, clamp, fmt, niceStep, textWidth, useElementSize } from '../kit/ui';
import { PALETTE } from '../kit/scene';

/**
 * Pieces shared by the three labs of the lesson "Motion under the action of
 * several forces": the light scene shell, the free-body-diagram paper, force
 * arrows with symbol labels (subscripts written as `F_{ishq}`), the
 * "ΣF = m·a in projections" panel and Start/Pause/Reset. No words live
 * here — every label arrives through props from the lesson's TEXT table.
 */

export const G = 9.8; // m/s²

/** One colour per kind of force, kept the same in every scene and diagram. */
export const FC = {
  weight: '#dc2626',
  weightText: '#fca5a5',
  normal: '#2563eb',
  normalText: '#93c5fd',
  fric: '#7c3aed',
  fricText: '#c4b5fd',
  pull: '#db2777',
  pullText: '#f9a8d4',
  tension: '#0891b2',
  tensionText: '#67e8f9',
  vel: PALETTE.vel,
  velText: PALETTE.velText,
  acc: PALETTE.acc,
  accText: PALETTE.accText,
};

export const rad = (d) => (d * Math.PI) / 180;
export const deg = (r) => (r * 180) / Math.PI;

/** fmt with a true minus sign. */
export function num(n, digits = 1, decimal = '.') {
  return fmt(n, digits, decimal).replace('-', '−');
}

/** Rounds up to a multiple of 4, so the graph's quarter ticks are whole numbers. */
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
        {(kind === 'line' || kind === 'arrow') && (
          <line x1="1" y1="5" x2={kind === 'arrow' ? 13 : 19} y2="5" stroke={color} strokeWidth="3" strokeLinecap="round" />
        )}
        {kind === 'arrow' && <path d="M19,5 L12,1 L12,9 Z" fill={color} />}
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

/** Ground: a hatched strip under the line y = `y` across the drawing. */
export function Ground({ W, y, depth = 14, color = '#64748b' }) {
  const hatch = [];
  for (let x = -depth; x < W + depth; x += 12) {
    hatch.push(<line key={x} x1={x} y1={y + depth} x2={x + depth} y2={y} stroke="#cbd5e1" strokeWidth="1.2" />);
  }
  return (
    <g aria-hidden="true">
      <rect x={0} y={y} width={W} height={depth} fill="#f1f5f9" />
      {hatch}
      <line x1={0} x2={W} y1={y} y2={y} stroke={color} strokeWidth="2" />
    </g>
  );
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
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-start">
      {renderScene(fitH)}
      <div ref={ref}>{method}</div>
    </div>
  );
}

/** "ΣF = m·a in projections": the free-body diagram and the numbered steps. */
export function MethodPanel({ title, fbd, children, className = '' }) {
  return (
    <Panel className={className}>
      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-100">
        <span className="rounded-md border border-white/10 bg-white/10 px-1.5 py-0.5 font-serif text-[13px] italic">ΣF = m·a</span>
        {title}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <div>{fbd}</div>
        <ol className="space-y-2.5">{children}</ol>
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500">{title}</p>
        {children}
      </div>
    </li>
  );
}

/** One projected equation: an axis tag, the formula, and the same with numbers. */
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
