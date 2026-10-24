import { useCallback, useSyncExternalStore } from 'react';
import { Pause, Play, RotateCcw, Ruler, Timer } from 'lucide-react';

import { Arrow, Btn, clamp, fmt, niceStep, textWidth, useElementSize } from '../kit/ui';
import { PALETTE } from '../kit/scene';

/**
 * Pieces shared by the three labs of the lesson "Center of gravity of a
 * body": the light scene shell, force arrows with symbol labels (subscripts
 * written as `x_{C}`), the centre-of-gravity mark, the formula panel and
 * Start/Pause/Reset. No words live here — every label arrives through props
 * from the lesson's TEXT table.
 */

export const G = 9.8; // m/s²

/** Colours kept the same in every scene of the lesson. */
export const CC = {
  weight: PALETTE.force, // the weight of one part, m·g
  weightText: '#fca5a5',
  result: '#991b1b', // the resultant of the weights, M·g, through C
  resultText: '#f87171',
  normal: '#2563eb', // the support's reaction N
  normalText: '#93c5fd',
  cg: '#0f172a', // the centre-of-gravity mark
  cgText: '#e2e8f0',
  stable: '#059669',
  stableText: '#6ee7b7',
  tip: '#e11d48',
  tipText: '#fda4af',
  line1: '#7c3aed',
  line2: '#db2777',
  line3: '#0891b2',
  plate: '#f3d9a4',
  plateEdge: '#a16207',
  wood: '#f6d79b',
  woodEdge: '#b7791f',
};

export const rad = (d) => (d * Math.PI) / 180;
export const deg = (r) => (r * 180) / Math.PI;

/** fmt with a true minus sign. */
export function num(n, digits = 1, decimal = '.') {
  return fmt(n, digits, decimal).replace('-', '−');
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

/** Pointer position in the coordinates of the SVG that holds `el`. */
export function svgPoint(e, el) {
  const svg = el?.ownerSVGElement ?? el;
  const ctm = svg?.getScreenCTM?.();
  if (!ctm) return { x: 0, y: 0 };
  const p = svg.createSVGPoint();
  p.x = e.clientX;
  p.y = e.clientY;
  const q = p.matrixTransform(ctm.inverse());
  return { x: q.x, y: q.y };
}

/* ------------------------------------------------------------ symbols */

/** Splits "x_{C} = 0.5" into plain and subscript runs. */
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
 * A force drawn from (x, y) by (dx, dy) pixels, labelled at its tip.
 * `labelAt` = { x, y, anchor } overrides the label position; `box` = { w, h }
 * keeps the label inside the drawing.
 */
export function ForceArrow({ x, y, dx, dy, color, label, value, fs = 12, width = 3.2, head = 11, dash, opacity = 1, gap = 7, box, labelAt }) {
  const len = Math.hypot(dx, dy);
  if (len < 2) return null;
  const ux = dx / len;
  const uy = dy / len;
  let lx = x + dx + ux * gap;
  const ly = y + dy + uy * gap;
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

/**
 * The centre-of-gravity sign: a circle with two opposite quarters filled.
 * `pulse` adds the soft ring used when a new C has just been found.
 */
export function CgMark({ x, y, r = 7, color = CC.cg, pulse = false, opacity = 1 }) {
  return (
    <g opacity={opacity} pointerEvents="none">
      {pulse && <circle cx={x} cy={y} r={r + 5} fill="#f59e0b" className="cl-pulse" />}
      <circle cx={x} cy={y} r={r + 2.5} fill="#fff" opacity="0.9" />
      <circle cx={x} cy={y} r={r} fill="#fff" stroke={color} strokeWidth="1.6" />
      <path d={`M${x},${y} L${x + r},${y} A${r},${r} 0 0 1 ${x},${y + r} Z`} fill={color} />
      <path d={`M${x},${y} L${x - r},${y} A${r},${r} 0 0 1 ${x},${y - r} Z`} fill={color} />
    </g>
  );
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

/* -------------------------------------------------------------- controls */

/** Start / Pause / Resume / Again + Reset, in the reference's size. */
export function PlayControls({ labels, running, done, started, onToggle, onReset, disabled, className = '' }) {
  return (
    <div className={`grid grid-cols-2 gap-2 xl:flex ${className}`}>
      <Btn variant="primary" icon={running ? Pause : Play} onClick={onToggle} disabled={disabled} className="xl:min-w-[168px] min-h-[52px] text-[15px]">
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

/** The dark panel that holds sliders, graphs and the formulas. */
export function Panel({ children, className = '' }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4 ${className}`}>{children}</div>;
}

/* ---------------------------------------------------------------- scene */

function LegendItem({ color, label, kind = 'line' }) {
  return (
    <li className="flex items-center gap-1.5">
      <svg width="20" height="12" aria-hidden="true" className="shrink-0">
        {kind === 'dash' && <line x1="1" y1="6" x2="19" y2="6" stroke={color} strokeWidth="2" strokeDasharray="4 3" />}
        {(kind === 'line' || kind === 'arrow') && (
          <line x1="1" y1="6" x2={kind === 'arrow' ? 13 : 19} y2="6" stroke={color} strokeWidth="3" strokeLinecap="round" />
        )}
        {kind === 'arrow' && <path d="M19,6 L12,2 L12,10 Z" fill={color} />}
        {kind === 'cg' && (
          <g>
            <circle cx="10" cy="6" r="5" fill="#fff" stroke={color} strokeWidth="1.4" />
            <path d="M10,6 L15,6 A5,5 0 0 1 10,11 Z" fill={color} />
            <path d="M10,6 L5,6 A5,5 0 0 1 10,1 Z" fill={color} />
          </g>
        )}
        {kind === 'area' && <rect x="2" y="2" width="16" height="8" rx="2" fill={color} opacity="0.35" stroke={color} strokeWidth="1.2" />}
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
export function ForceScale({ kF, label, unit, decimal = '.', unitScale = 1 }) {
  const step = niceStep(kF * unitScale, 22);
  const px = step * kF * unitScale;
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
export function LabScene({ legend = [], chips, height, ariaLabel, children, minW = 280, className = '', svgProps }) {
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
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="cl-scene block select-none" {...svgProps}>
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
export function Ground({ W, y, depth = 14, color = '#64748b', fill = '#f1f5f9' }) {
  const hatch = [];
  for (let x = -depth; x < W + depth; x += 12) {
    hatch.push(<line key={x} x1={x} y1={y + depth} x2={x + depth} y2={y} stroke="#cbd5e1" strokeWidth="1.2" />);
  }
  return (
    <g aria-hidden="true">
      <rect x={0} y={y} width={W} height={depth} fill={fill} />
      {hatch}
      <line x1={0} x2={W} y1={y} y2={y} stroke={color} strokeWidth="2" />
    </g>
  );
}

/* ------------------------------------------------------- the formula panel */

/**
 * The scene beside the formula panel. On desktop the two sit side by side
 * and the scene takes the panel's height (`renderScene(fitH)`); below that
 * they stack and the scene keeps its own height (fitH = null).
 */
export function SceneRow({ renderScene, side, minH = 452 }) {
  const [ref, size] = useElementSize();
  const lg = useMediaQuery('(min-width: 1024px)');
  const fitH = lg && size.height > 0 ? Math.max(minH, Math.round(size.height)) : null;
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      {renderScene(fitH)}
      <div ref={ref}>{side}</div>
    </div>
  );
}

/** The panel of formulas: a badge with the key formula, a title, then numbered steps. */
export function FormulaPanel({ badge, title, children, className = '' }) {
  return (
    <Panel className={className}>
      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-100">
        {badge && (
          <span className="rounded-md border border-white/10 bg-white/10 px-1.5 py-0.5 font-serif text-[13px] italic">
            <Sym>{badge}</Sym>
          </span>
        )}
        {title}
      </p>
      <ol className="mt-3 space-y-3">{children}</ol>
    </Panel>
  );
}

export function Step({ n, title, children, done }) {
  return (
    <li className="flex gap-2.5">
      <span
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
          done ? 'bg-emerald-400/20 text-emerald-300' : 'bg-cyan-400/15 text-cyan-300'
        }`}
        aria-hidden="true"
      >
        {done ? '✓' : n}
      </span>
      <div className="min-w-0 flex-1 text-[13px] leading-snug text-gray-300">
        {title && <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500">{title}</p>}
        {children}
      </div>
    </li>
  );
}

/** One formula line: the symbols, then the same with numbers and a coloured result. */
export function Eq({ sym, nums, result, resultColor = '#fde68a' }) {
  return (
    <div className="mt-1">
      {sym && (
        <p className="font-serif text-[14.5px] italic text-gray-100">
          <Sym>{sym}</Sym>
        </p>
      )}
      {(nums || result) && (
        <p className="tabular-nums text-gray-400">
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
