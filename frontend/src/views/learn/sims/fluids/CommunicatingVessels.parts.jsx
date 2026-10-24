import { useCallback, useSyncExternalStore } from 'react';
import { Pause, Play, RotateCcw, Timer } from 'lucide-react';

import { Arrow, Btn, clamp, fmt, textWidth, useElementSize } from '../kit/ui';

/**
 * Pieces shared by the four "Tutash idishlar" simulators: the light scene
 * panel of the chosen design (variant A), control groups, formula steps, and
 * the drawing of liquids — one look per liquid (water translucent blue,
 * kerosene / oil amber, mercury silver-grey), a meniscus at the walls and a
 * light ripple while the surface moves.
 */

export const G = 9.8; // m/s²

/** One look (and density, kg/m³) per liquid, kept the same in every tab. */
export const LIQ = {
  water: { rho: 1000, fill: '#60a5fa', opacity: 0.45, edge: '#2563eb', text: '#93c5fd', dot: '#3b82f6', meniscus: 1 },
  kerosene: { rho: 800, fill: '#fcd34d', opacity: 0.62, edge: '#d97706', text: '#fde68a', dot: '#f59e0b', meniscus: 1 },
  oil: { rho: 900, fill: '#f59e0b', opacity: 0.6, edge: '#b45309', text: '#fcd34d', dot: '#d97706', meniscus: 1 },
  mercury: { rho: 13600, fill: 'url(#cv-hg)', opacity: 1, edge: '#475569', text: '#e2e8f0', dot: '#94a3b8', meniscus: -1 },
};

/** Colours of the other quantities. */
export const CV = {
  pressure: '#dc2626', // pressure (force on a surface) — red, as forces are
  pressureText: '#fca5a5',
  flow: '#0891b2', // direction of flow
  level: '#7c3aed', // the common level line
  levelText: '#c4b5fd',
  glass: '#94a3b8',
  glassDark: '#64748b',
  ink: '#0f172a',
  muted: '#64748b',
  open: '#059669',
  closed: '#dc2626',
};

/** fmt with a true minus sign. */
export function num(n, digits = 1, decimal = '.') {
  return fmt(n, digits, decimal).replace('-', '−');
}

/** A number with narrow no-break spaces between thousands: 78 400 · 1 332.8 */
export function big(n, digits = 0, decimal = '.') {
  const s = fmt(n, digits, '.');
  const [i, d] = s.split('.');
  const g = i.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
  return d ? `${g}${decimal}${d}` : g;
}

/** True while the media query matches (matchMedia subscription, cleaned up on unmount). */
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

/** Splits "ρ_{1}h_{1}" into plain and subscript runs. */
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
export function symWidth(text, fs = 12, weight = 700) {
  let w = 0;
  for (const p of splitSym(text)) w += textWidth(p.t, p.sub ? fs * 0.74 : fs, weight);
  return w;
}

/** An SVG label with `_{…}` subscripts and a white halo. */
export function SvgSym({ x, y, text, color, fs = 12, anchor = 'middle', weight = 700, halo = true, italic = false }) {
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
      <tspan key={i} dy={dy} fontSize={p.sub ? fs * 0.74 : fs} fontStyle={italic && !p.sub ? 'italic' : 'normal'}>
        {p.t}
      </tspan>
    );
  });
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
    </text>
  );
}

/** A label pill with subscripts, kept inside `box` = { w, h } when given. */
export function SymPill({ x, y, text, bg, color = '#fff', fs = 12, box, border, anchor = 'middle' }) {
  if (!text) return null;
  const w = symWidth(text, fs, 600) + 16;
  const h = fs + 10;
  let left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  let top = y - h / 2;
  if (box) {
    left = clamp(left, 3, box.w - w - 3);
    top = clamp(top, 3, box.h - h - 3);
  }
  return (
    <g pointerEvents="none">
      <rect x={left} y={top} width={w} height={h} rx={h / 2} fill={bg} stroke={border} strokeWidth={border ? 1.2 : 0} />
      <SvgSym x={left + w / 2} y={top + h / 2 + fs * 0.36} text={text} color={color} fs={fs} weight={600} halo={false} />
    </g>
  );
}

/**
 * A dimension line from p1 to p2 (screen px) with end ticks and a label pill
 * in the middle — for the column heights h₁, h₂ and the level difference Δh.
 */
export function DimLine({ p1, p2, color, label, fs = 12, box, tick = 5, labelDx = 0 }) {
  const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  if (len < 3) return null;
  const ux = (p2.x - p1.x) / len;
  const uy = (p2.y - p1.y) / len;
  const nx = -uy * tick;
  const ny = ux * tick;
  return (
    <g pointerEvents="none">
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth="1.6" />
      <line x1={p1.x - nx} y1={p1.y - ny} x2={p1.x + nx} y2={p1.y + ny} stroke={color} strokeWidth="1.6" />
      <line x1={p2.x - nx} y1={p2.y - ny} x2={p2.x + nx} y2={p2.y + ny} stroke={color} strokeWidth="1.6" />
      {label && len > 12 && (
        <SymPill x={(p1.x + p2.x) / 2 + labelDx} y={(p1.y + p2.y) / 2} text={label} bg="#fff" color={color} border={color} fs={fs} box={box} />
      )}
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

/** The dark panel that holds sliders, graphs and the formula steps. */
export function Panel({ children, className = '' }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4 ${className}`}>{children}</div>;
}

/** A titled panel with a formula badge and numbered steps. */
export function FormulaPanel({ formula, title, children, className = '' }) {
  return (
    <Panel className={className}>
      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-100">
        <span className="rounded-md border border-white/10 bg-white/10 px-1.5 py-0.5 font-serif text-[13px] italic">
          <Sym>{formula}</Sym>
        </span>
        {title}
      </p>
      <ol className="mt-3 space-y-2.5">{children}</ol>
    </Panel>
  );
}

export function Step({ n, title, children, state }) {
  const ring = state === 'done' ? 'bg-emerald-400/20 text-emerald-300' : state === 'now' ? 'bg-cyan-400 text-slate-950' : 'bg-cyan-400/15 text-cyan-300';
  return (
    <li className="flex gap-2.5">
      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${ring}`} aria-hidden="true">
        {n}
      </span>
      <div className="min-w-0 flex-1 text-[13px] leading-snug text-gray-300">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500">{title}</p>
        {children}
      </div>
    </li>
  );
}

/** One formula line: the formula in serif italic, then the same with numbers and a coloured result. */
export function Eq({ sym, nums, result, resultColor = '#93c5fd' }) {
  return (
    <div className="mt-1">
      <p className="font-serif text-[14.5px] italic text-gray-100">
        <Sym>{sym}</Sym>
      </p>
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

/* ---------------------------------------------------------------- scene */

function LegendItem({ color, label, kind = 'line', fill }) {
  return (
    <li className="flex items-center gap-1.5">
      <svg width="20" height="10" aria-hidden="true" className="shrink-0">
        {kind === 'dash' && <line x1="1" y1="5" x2="19" y2="5" stroke={color} strokeWidth="2" strokeDasharray="4 3" />}
        {kind === 'box' && <rect x="3" y="0.5" width="14" height="9" rx="2" fill={fill ?? color} stroke={color} strokeWidth="1" />}
        {(kind === 'line' || kind === 'arrow') && <line x1="1" y1="5" x2={kind === 'arrow' ? 13 : 19} y2="5" stroke={color} strokeWidth="3" strokeLinecap="round" />}
        {kind === 'arrow' && <path d="M19,5 L12,1 L12,9 Z" fill={color} />}
        {kind === 'down' && (
          <>
            <line x1="10" y1="0" x2="10" y2="5" stroke={color} strokeWidth="2.5" />
            <path d="M10,10 L6.5,4.5 L13.5,4.5 Z" fill={color} />
          </>
        )}
        {kind === 'dim' && (
          <>
            <line x1="2" y1="5" x2="18" y2="5" stroke={color} strokeWidth="1.6" />
            <line x1="2" y1="1" x2="2" y2="9" stroke={color} strokeWidth="1.6" />
            <line x1="18" y1="1" x2="18" y2="9" stroke={color} strokeWidth="1.6" />
          </>
        )}
      </svg>
      <span>
        <Sym>{label}</Sym>
      </span>
    </li>
  );
}

/** A chip in the scene's top-right corner (time, scale, tap state…). */
export function Chip({ icon: Icon = Timer, children, color = '#0891b2' }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[11px] sm:text-[12px] font-medium tabular-nums text-slate-600 shadow-sm">
      {Icon && <Icon size={14} style={{ color }} aria-hidden="true" />}
      {children}
    </span>
  );
}

/**
 * The light scene panel of the chosen design. `height(W, narrow)` sizes the
 * drawing; `children(W, H, narrow)` draws it; `chips(W, narrow, H)` (or a
 * node) fills the top-right corner. The legend floats over the top-left from
 * `sm` up and moves under the scene on phones.
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
          <LiquidDefs />
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

/**
 * The scene beside a side panel, with `under` (the live explanation) right
 * below the scene. On desktop the scene takes the panel's height minus
 * `under` (`renderScene(fitH)`, kept within [minH, maxH]); below lg they stack
 * and the scene keeps its own height (fitH = null).
 */
export function SceneRow({ renderScene, side, under, minH = 420, maxH = 560, sideW = 360 }) {
  const [ref, size] = useElementSize();
  const [uRef, uSize] = useElementSize();
  const lg = useMediaQuery('(min-width: 1024px)');
  const fitH = lg && size.height > 0 ? clamp(Math.round(size.height - (under ? uSize.height + 12 : 0)), minH, maxH) : null;
  return (
    <div className="grid gap-3 lg:items-start" style={lg ? { gridTemplateColumns: `minmax(0,1fr) ${sideW}px` } : undefined}>
      <div className="min-w-0 space-y-3">
        {renderScene(fitH)}
        {under && <div ref={uRef}>{under}</div>}
      </div>
      <div ref={ref}>{side}</div>
    </div>
  );
}

/* --------------------------------------------------------------- liquids */

/** Gradients for the liquids that are not flat colours (mercury). */
function LiquidDefs() {
  return (
    <defs>
      <linearGradient id="cv-hg" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#8a96a6" />
        <stop offset="35%" stopColor="#e2e8f0" />
        <stop offset="60%" stopColor="#b9c3cf" />
        <stop offset="100%" stopColor="#7b8796" />
      </linearGradient>
      <linearGradient id="cv-glass" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#e2e8f0" stopOpacity="0.55" />
        <stop offset="45%" stopColor="#ffffff" stopOpacity="0.15" />
        <stop offset="100%" stopColor="#e2e8f0" stopOpacity="0.5" />
      </linearGradient>
      <linearGradient id="cv-concrete" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#d6dbe1" />
        <stop offset="100%" stopColor="#bcc4cd" />
      </linearGradient>
    </defs>
  );
}

/**
 * The free surface between the walls at screen x `xl`..`xr`, height `y`
 * (screen px): a meniscus at each wall (`men` px, + climbs the wall as water
 * does, − dips as mercury does) and a ripple of amplitude `amp` px. Returns
 * the points left → right.
 */
export function surfacePoints(xl, xr, y, { men = 0, amp = 0, phase = 0 } = {}) {
  const width = xr - xl;
  if (width <= 0) return [];
  const m = clamp(men, -width / 3, width / 3);
  const w = Math.min(width * 0.3, 7);
  const pts = [[xl, y - m]];
  const steps = 3;
  for (let i = 1; i <= steps; i += 1) {
    const f = i / steps;
    pts.push([xl + w * f, y - m * (1 - f) ** 2]);
  }
  const inner = xr - xl - 2 * w;
  if (inner > 1) {
    const n = Math.max(2, Math.round(inner / 5));
    for (let i = 1; i < n; i += 1) {
      const x = xl + w + (inner * i) / n;
      pts.push([x, y + (amp ? amp * Math.sin(x * 0.19 + phase) * Math.sin((Math.PI * i) / n) : 0)]);
    }
  }
  for (let i = steps; i >= 1; i -= 1) {
    const f = i / steps;
    pts.push([xr - w * f, y - m * (1 - f) ** 2]);
  }
  pts.push([xr, y - m]);
  return pts;
}

const P = (pts) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L');

/**
 * A liquid body: up the left wall (`left`, screen points bottom → top), along
 * the free surface (`surface`, left → right; or `topLine` for a closed top
 * such as an interface under another liquid), and down the right wall
 * (`right`, top → bottom). The surface is stroked darker as the meniscus
 * line. `flat` draws the fill at full strength with no line — for shapes
 * that overlap inside a group carrying the liquid's opacity, so the joins
 * show no darker seams.
 */
export function LiquidBody({ liq, left, right, surface, topLine, strokeTop = true, flat = false }) {
  const top = surface && surface.length ? surface : topLine;
  const d = `M${P(left)} L${P(top ?? [])} L${P(right)} Z`;
  return (
    <g pointerEvents="none">
      <path d={d} fill={liq.fill} fillOpacity={flat ? 1 : liq.opacity} />
      {!flat && strokeTop && surface && surface.length > 1 && <SurfaceLine liq={liq} surface={surface} />}
    </g>
  );
}

/** The meniscus line of a free surface. */
export function SurfaceLine({ liq, surface, width = 1.8 }) {
  if (!surface || surface.length < 2) return null;
  return <path d={`M${P(surface)}`} fill="none" stroke={liq.edge} strokeWidth={width} strokeLinejoin="round" strokeLinecap="round" pointerEvents="none" />;
}

/** A pressure / scale chip body: a bar `px` long with end ticks. */
export function ScaleBar({ px, color = '#0f172a' }) {
  return (
    <svg width={px + 4} height="10" aria-hidden="true" className="shrink-0">
      <line x1="2" y1="5" x2={px + 2} y2="5" stroke={color} strokeWidth="2.5" />
      <line x1="2" y1="1" x2="2" y2="9" stroke={color} strokeWidth="1.5" />
      <line x1={px + 2} y1="1" x2={px + 2} y2="9" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

/** A pressure arrow (red), pointing onto the surface it pushes on. */
export function PressureArrow({ x1, y1, x2, y2, width = 2.6, head = 8, opacity = 1 }) {
  return <Arrow x1={x1} y1={y1} x2={x2} y2={y2} color={CV.pressure} width={width} head={head} opacity={opacity} />;
}

/**
 * Moving dashes along a straight run of pipe from (x1,y1) to (x2,y2) — the
 * flow of liquid at `offset` px (grows with the flow; its sign is the
 * direction). Nothing is drawn when `on` is false.
 */
export function FlowDashes({ x1, y1, x2, y2, offset, on, color = '#ffffff', width = 2.2, dash = '6 9', opacity = 0.95 }) {
  if (!on) return null;
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeDasharray={dash}
      strokeDashoffset={-offset}
      opacity={opacity}
      pointerEvents="none"
    />
  );
}

/**
 * A vertical ruler from screen y `yBottom` (value `from`) up to value `to`,
 * at `k` px per unit, ticks every `minor` with numbers every `major`.
 * `side` = 1 puts the ticks and numbers to the right of the spine.
 */
export function Ruler({ x, yBottom, k, from = 0, to, minor = 1, major = 5, side = -1, fs = 10, decimal = '.', zeroLabel, color = '#475569', bg = '#fffbeb' }) {
  const ticks = [];
  const n = Math.round((to - from) / minor);
  const widthPx = 22;
  for (let i = 0; i <= n; i += 1) {
    const v = from + i * minor;
    const y = yBottom - (v - from) * k;
    const isMajor = Math.abs(v / major - Math.round(v / major)) < 1e-6;
    const half = Math.abs((v / major) * 2 - Math.round((v / major) * 2)) < 1e-6;
    const len = isMajor ? 9 : half ? 6 : 3.5;
    ticks.push(<line key={`t${i}`} x1={x} x2={x + side * len} y1={y} y2={y} stroke={color} strokeWidth={isMajor ? 1.3 : 0.9} />);
    if (isMajor && k * major >= 14) {
      ticks.push(
        <text key={`n${i}`} x={x + side * 11} y={y + fs * 0.36} textAnchor={side > 0 ? 'start' : 'end'} fontSize={fs} fill={color}>
          {v === 0 && zeroLabel ? zeroLabel : fmt(v, 0, decimal)}
        </text>,
      );
    }
  }
  const yTop = yBottom - (to - from) * k;
  return (
    <g pointerEvents="none" aria-hidden="true">
      <rect
        x={side > 0 ? x : x - widthPx}
        y={yTop - 4}
        width={widthPx}
        height={yBottom - yTop + 8}
        rx="3"
        fill={bg}
        stroke="#e2c27a"
        strokeWidth="0.8"
        opacity="0.9"
      />
      <line x1={x} x2={x} y1={yTop} y2={yBottom} stroke={color} strokeWidth="1.2" />
      {ticks}
    </g>
  );
}

/** A small round valve (tap) symbol on a pipe: open = handle along the pipe, green; closed = across, red. */
export function Valve({ x, y, r = 9, open, vertical = false, onClick, label }) {
  const col = open ? CV.open : CV.closed;
  const rot = (open ? 0 : 90) + (vertical ? 90 : 0);
  return (
    <g
      transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
      role={onClick ? 'presentation' : undefined}
    >
      {onClick && <circle r={r + 10} fill="transparent" />}
      <circle r={r} fill="#fff" stroke={col} strokeWidth="2.2" />
      <path d={`M${-r * 0.62},${-r * 0.5} L${r * 0.62},${r * 0.5} L${r * 0.62},${-r * 0.5} L${-r * 0.62},${r * 0.5} Z`} fill={col} opacity="0.85" />
      <g transform={`rotate(${rot})`}>
        <line x1={-r * 1.5} y1={-r - 4} x2={r * 1.5} y2={-r - 4} stroke={col} strokeWidth="3" strokeLinecap="round" />
        <line x1="0" y1={-r} x2="0" y2={-r - 4} stroke={col} strokeWidth="2" />
      </g>
      {label && (
        <text y={r + 14} textAnchor="middle" fontSize="10.5" fontWeight="700" fill={col} stroke="#fff" strokeWidth="3" paintOrder="stroke">
          {label}
        </text>
      )}
    </g>
  );
}

/** A dial manometer: 0..max on a 240° arc, needle at `value`. */
export function Dial({ x, y, r = 14, value, max, color = CV.pressure, label, fs = 10 }) {
  const a0 = (-210 * Math.PI) / 180;
  const a1 = (30 * Math.PI) / 180;
  const f = clamp(value / max, 0, 1);
  const a = a0 + (a1 - a0) * f;
  const ticks = [];
  for (let i = 0; i <= 6; i += 1) {
    const ta = a0 + ((a1 - a0) * i) / 6;
    ticks.push(
      <line key={i} x1={Math.cos(ta) * r * 0.72} y1={Math.sin(ta) * r * 0.72} x2={Math.cos(ta) * r * 0.9} y2={Math.sin(ta) * r * 0.9} stroke="#64748b" strokeWidth="1" />,
    );
  }
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} pointerEvents="none">
      <circle r={r} fill="#fff" stroke="#334155" strokeWidth="1.6" />
      {ticks}
      <line x1="0" y1="0" x2={Math.cos(a) * r * 0.78} y2={Math.sin(a) * r * 0.78} stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle r="2" fill="#334155" />
      {label && (
        <text y={r + fs + 2} textAnchor="middle" fontSize={fs} fontWeight="700" fill={color} stroke="#fff" strokeWidth="3" paintOrder="stroke">
          {label}
        </text>
      )}
    </g>
  );
}

/** A faint 1 cm grid with stronger lines every 5 cm. */
export function GridCm({ view, W, H }) {
  const lines = [];
  const step = view.k >= 7 ? 1 : 5;
  const x0 = Math.ceil(view.wx(0) / step) * step;
  const y0 = Math.ceil(view.wy(H) / step) * step;
  for (let x = x0; x <= view.wx(W); x += step) {
    const strong = Math.abs(x % 5) < 1e-6;
    lines.push(<line key={`x${x}`} x1={view.sx(x)} x2={view.sx(x)} y1={0} y2={H} stroke={strong ? '#e2e8f0' : '#f1f5f9'} strokeWidth="1" />);
  }
  for (let y = y0; y <= view.wy(0); y += step) {
    const strong = Math.abs(y % 5) < 1e-6;
    lines.push(<line key={`y${y}`} x1={0} x2={W} y1={view.sy(y)} y2={view.sy(y)} stroke={strong ? '#e2e8f0' : '#f1f5f9'} strokeWidth="1" />);
  }
  return <g aria-hidden="true">{lines}</g>;
}
