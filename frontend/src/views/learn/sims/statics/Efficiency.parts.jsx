import { useCallback, useSyncExternalStore } from 'react';
import { Pause, Play, RotateCcw, Ruler, Timer } from 'lucide-react';

import { Arrow, Btn, clamp, fmt, niceStep, textWidth, useElementSize } from '../kit/ui';
import { PALETTE } from '../kit/scene';

/**
 * Pieces shared by the three labs of the lesson "Foydali ish koeffitsienti"
 * (Efficiency): the energy colours, symbols with subscripts, force arrows,
 * the light scene shell, the Sankey-like energy-flow diagram, the live
 * "A_t = A_f + losses" bar equation, the FIK panel with its numbered steps
 * and Start/Pause/Reset. No words live here — every label arrives through
 * props from the lesson's TEXT table.
 */

export const G = 9.8; // m/s²

/** Energy colours — the same as in the other energy lessons (E_p blue, heat orange, total gray). */
export const EC = {
  input: '#64748b', // total (spent) work A_t — gray
  inputBar: '#94a3b8',
  inputText: '#e2e8f0',
  useful: '#2563eb', // useful work A_f (here: E_p of the load) — blue
  usefulBar: '#3b82f6',
  usefulText: '#93c5fd',
  heat: '#ea580c', // heat Q from friction — orange
  heatBar: '#f97316',
  heatText: '#fdba74',
  block: '#d97706', // work spent lifting the pulley block — amber
  blockBar: '#f59e0b',
  blockText: '#fcd34d',
  exhaust: '#b91c1c', // other losses (exhaust, reflection…) — red
  exhaustBar: '#ef4444',
  exhaustText: '#fca5a5',
};

/** One colour per kind of force, as in the dynamics lessons. */
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
};

export const rad = (d) => (d * Math.PI) / 180;
export const deg = (r) => (r * 180) / Math.PI;

/** fmt with a true minus sign. */
export function num(n, digits = 1, decimal = '.') {
  return fmt(n, digits, decimal).replace('-', '−');
}

/** A number with thin-space thousands groups and a chosen decimal mark: 12 000 · 1 234.5 */
export function big(n, digits = 0, decimal = '.') {
  const s = fmt(n, digits, '.');
  const [i, d] = s.split('.');
  const g = i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return d ? `${g}${decimal}${d}` : g;
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

/** Splits "A_{f} = mgh" into plain and subscript runs. */
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
  const ly = y + dy + uy * g;
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

/** A small angle arc at (cx, cy) between screen angles `from` and `to` (radians), the shorter way. */
export function AngleArc({ cx, cy, r, from, to, color = '#475569' }) {
  let d = to - from;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  if (Math.abs(d) < 1e-3) return null;
  const x1 = cx + r * Math.cos(from);
  const y1 = cy + r * Math.sin(from);
  const x2 = cx + r * Math.cos(from + d);
  const y2 = cy + r * Math.sin(from + d);
  return <path d={`M${x1},${y1} A${r},${r} 0 0 ${d > 0 ? 1 : 0} ${x2},${y2}`} fill="none" stroke={color} strokeWidth="1.5" pointerEvents="none" />;
}

/**
 * A dimension line from p1 to p2 (screen px) with end ticks and a label pill
 * in the middle — for lengths like h, l and the rope travel s.
 */
export function DimLine({ p1, p2, color, label, fs = 12, box, labelOffset = 0, tick = 6, dash }) {
  const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  if (len < 3) return null;
  const ux = (p2.x - p1.x) / len;
  const uy = (p2.y - p1.y) / len;
  const nx = -uy * tick;
  const ny = ux * tick;
  const mx = (p1.x + p2.x) / 2 - uy * labelOffset;
  const my = (p1.y + p2.y) / 2 + ux * labelOffset;
  const w = label ? symWidth(label, null, fs) + 14 : 0;
  const h = fs + 9;
  let left = mx - w / 2;
  let top = my - h / 2;
  if (box) {
    left = clamp(left, 3, box.w - w - 3);
    top = clamp(top, 3, box.h - h - 3);
  }
  return (
    <g pointerEvents="none">
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth="1.6" strokeDasharray={dash} />
      <line x1={p1.x - nx} y1={p1.y - ny} x2={p1.x + nx} y2={p1.y + ny} stroke={color} strokeWidth="1.6" />
      <line x1={p2.x - nx} y1={p2.y - ny} x2={p2.x + nx} y2={p2.y + ny} stroke={color} strokeWidth="1.6" />
      {label && len > 14 && (
        <>
          <rect x={left} y={top} width={w} height={h} rx={h / 2} fill="#fff" stroke={color} strokeWidth="1.2" />
          <SvgSym x={left + w / 2} y={top + h / 2 + fs * 0.36} text={label} color={color} fs={fs} halo={false} weight={700} />
        </>
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

/** The dark panel that holds sliders, graphs and the FIK steps. */
export function Panel({ children, className = '' }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4 ${className}`}>{children}</div>;
}

/* ---------------------------------------------------------------- scene */

function LegendItem({ color, label, kind = 'line' }) {
  return (
    <li className="flex items-center gap-1.5">
      <svg width="20" height="10" aria-hidden="true" className="shrink-0">
        {kind === 'dash' && <line x1="1" y1="5" x2="19" y2="5" stroke={color} strokeWidth="2" strokeDasharray="4 3" />}
        {kind === 'box' && <rect x="3" y="0.5" width="14" height="9" rx="2" fill={color} />}
        {(kind === 'line' || kind === 'arrow') && <line x1="1" y1="5" x2={kind === 'arrow' ? 13 : 19} y2="5" stroke={color} strokeWidth="3" strokeLinecap="round" />}
        {kind === 'arrow' && <path d="M19,5 L12,1 L12,9 Z" fill={color} />}
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
export function Ground({ W, y, depth = 14, color = '#64748b', x0 = 0 }) {
  const hatch = [];
  for (let x = x0 - depth; x < W + depth; x += 12) {
    hatch.push(<line key={x} x1={x} y1={y + depth} x2={x + depth} y2={y} stroke="#cbd5e1" strokeWidth="1.2" />);
  }
  return (
    <g aria-hidden="true">
      <rect x={x0} y={y} width={W - x0} height={depth} fill="#f1f5f9" />
      {hatch}
      <line x1={x0} x2={W} y1={y} y2={y} stroke={color} strokeWidth="2" />
    </g>
  );
}

/**
 * The scene beside the FIK panel, with `under` (the live explanation) right
 * below the scene. On desktop the scene takes the panel's height minus
 * `under`, kept between 452 and 540 px so the whole lab fits a 900 px screen
 * (`renderScene(fitH)`); below that they stack and the scene keeps its own
 * height (fitH = null).
 */
export function SceneRow({ renderScene, side, under }) {
  const [ref, size] = useElementSize();
  const [uRef, uSize] = useElementSize();
  const lg = useMediaQuery('(min-width: 1024px)');
  const fitH = lg && size.height > 0 ? clamp(Math.round(size.height - (under ? uSize.height + 12 : 0)), 452, 540) : null;
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <div className="min-w-0 space-y-3">
        {renderScene(fitH)}
        {under && <div ref={uRef}>{under}</div>}
      </div>
      <div ref={ref}>{side}</div>
    </div>
  );
}

/* ------------------------------------------------------- the FIK panel */

/** "η = A_f / A_t · 100 %": the energy-flow paper and the numbered steps. */
export function FikPanel({ formula, title, flow, children, className = '' }) {
  return (
    <Panel className={className}>
      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-100">
        <span className="rounded-md border border-white/10 bg-white/10 px-1.5 py-0.5 font-serif text-[13px] italic">
          <Sym>{formula}</Sym>
        </span>
        {title}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        {flow && <div>{flow}</div>}
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

/** The η readout: big percentage with a bar that fills to η and a 100 % mark. */
export function EtaBar({ eta, color = '#22d3ee' }) {
  return (
    <div className="mt-2 relative h-2 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${clamp(eta, 0, 1) * 100}%`, background: color }} />
    </div>
  );
}

/* ---------------------------------------------------- energy-flow paper */

/** A small light paper for the energy-flow diagram, with a title chip. */
export function FlowPaper({ title, height = 220, ariaLabel, children }) {
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 240);
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

/**
 * Sankey-like energy flow inside an SVG: one input bar on the left (height
 * ∝ total) splits into ribbons; the first item (the useful part) runs
 * straight, the losses curve down. Each ribbon ends in an arrowhead with a
 * two-line label: name, then value · percent.
 *
 *   items = [{ id, label, value, color, fill, valueText }]
 *   box   = { x, y, w, h } — the area for bar + ribbons + labels
 *   labelW — width kept for the labels on the right
 *   phase — seconds; when `flowing`, dashes run along the ribbons
 */
export function SankeyFlow({ box, total, items, labelW = 150, fs = 12, barW = 14, inputColor = EC.inputBar, inputStroke = EC.input, flowing = false, phase = 0, minSlot = 34, gap = 8 }) {
  const { x, y, w, h } = box;
  const xs = x + barW;
  const head = 10;
  const xt = x + w - labelW - head - 6;
  const vals = items.map((it) => Math.max(0, it.value));
  const sum = Math.max(total, 1e-9);
  const gaps = gap * (items.length - 1);
  // px per unit, so that the output slots (each at least minSlot tall) fill h
  let k = (h - gaps) / sum;
  for (let iter = 0; iter < 6; iter += 1) {
    let fixed = 0;
    let free = 0;
    vals.forEach((v) => {
      if (v * k < minSlot) fixed += minSlot;
      else free += v;
    });
    if (free <= 0) break;
    const k2 = Math.max(0.0001, (h - gaps - fixed) / free);
    if (Math.abs(k2 - k) < 1e-7) break;
    k = k2;
  }
  const Hin = sum * k;
  const yTop = y;
  // source stack inside the input bar
  let acc = yTop;
  const src = vals.map((v) => {
    const s0 = acc;
    acc += v * k;
    return [s0, acc];
  });
  // target slots on the right
  let ty = yTop;
  const tgt = vals.map((v, i) => {
    const th = v * k;
    const slot = Math.max(th, minSlot);
    const top = i === 0 ? ty : ty + (slot - th) / 2;
    const res = [top, top + th, ty, ty + slot];
    ty += slot + gap;
    return res;
  });
  const xm = (xs + xt) / 2;
  return (
    <g>
      {/* input bar */}
      <rect x={x} y={yTop} width={barW} height={Math.max(Hin, 2)} rx={3} fill={inputColor} stroke={inputStroke} strokeWidth="1.2" />
      {items.map((it, i) => {
        const [s0, s1] = src[i];
        const [t0, t1, slotTop, slotBottom] = tgt[i];
        const thick = Math.max(t1 - t0, 1.2);
        const tt1 = t0 + thick;
        const ss1 = s0 + Math.max(s1 - s0, 1.2);
        const d = `M${xs},${s0} C${xm},${s0} ${xm},${t0} ${xt},${t0} L${xt},${tt1} C${xm},${tt1} ${xm},${ss1} ${xs},${ss1} Z`;
        const tc = (t0 + tt1) / 2;
        const sc = (s0 + ss1) / 2;
        const half = Math.max(thick / 2 + 3, 6);
        const ah = Math.min(head + 4, Math.max(8, half));
        const cy = (slotTop + slotBottom) / 2;
        const lx = xt + ah + 7;
        return (
          <g key={it.id}>
            <path d={d} fill={it.fill ?? it.color} opacity="0.82" />
            <path d={`M${xt},${tc - half} L${xt + ah},${tc} L${xt},${tc + half} Z`} fill={it.color} />
            {flowing && thick > 3 && (
              <path
                d={`M${xs},${sc} C${xm},${sc} ${xm},${tc} ${xt},${tc}`}
                fill="none"
                stroke="#fff"
                strokeOpacity="0.75"
                strokeWidth={Math.min(3, thick * 0.35)}
                strokeLinecap="round"
                strokeDasharray="2 12"
                strokeDashoffset={-((phase * 40) % 14)}
              />
            )}
            <SvgSym x={lx} y={cy - 2} text={it.label} color="#475569" fs={fs - 1} anchor="start" weight={600} halo={false} italic={false} />
            <text x={lx} y={cy + fs + 1} fontSize={fs} fontWeight="700" fill={it.color}>
              {it.valueText}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/**
 * The live bar equation  [A_t] = [A_f] + [losses]  drawn inside a scene:
 * three columns on a common scale (hMax px = `full`), the loss column
 * stacked from its parts, and a dashed line at the final total.
 *
 *   cols = [{ sym, value, color, ghost?, parts?: [{ value, color }] }] (3 columns);
 *   `ghost` marks the column's final value with a faint bar.
 */
export function BarEquation({ x, y, w, h, full, cols, title, fs = 11, valueText, decimal = '.', box }) {
  const pad = 10;
  const titleH = title ? fs + 10 : 0;
  const footH = fs * 2 + 10;
  const colW = Math.min(30, (w - pad * 2 - 2 * 18) / 3);
  const signW = (w - pad * 2 - 3 * colW) / 2;
  const top = y + titleH + 8;
  const base = y + h - footH;
  const hMax = Math.max(10, base - top);
  const kk = hMax / Math.max(full, 1e-9);
  const left = box ? clamp(x, 3, box.w - w - 3) : x;
  const dx = left - x;
  return (
    <g pointerEvents="none" transform={dx ? `translate(${dx} 0)` : undefined}>
      <rect x={x} y={y} width={w} height={h} rx={12} fill="#ffffff" fillOpacity="0.94" stroke="#e2e8f0" />
      {title && (
        <text x={x + w / 2} y={y + fs + 6} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#475569">
          {title}
        </text>
      )}
      <line x1={x + pad - 2} x2={x + w - pad + 2} y1={top} y2={top} stroke="#334155" strokeWidth="1.2" strokeDasharray="4 3" />
      <line x1={x + pad - 2} x2={x + w - pad + 2} y1={base} y2={base} stroke="#94a3b8" strokeWidth="1.2" />
      {cols.map((c, i) => {
        const cx = x + pad + i * (colW + signW);
        let yy = base;
        const parts = c.parts ?? [{ value: c.value, color: c.color }];
        return (
          <g key={i}>
            <rect x={cx} y={top} width={colW} height={hMax} rx={3} fill="#f1f5f9" />
            {c.ghost > 0 && <rect x={cx} y={base - c.ghost * kk} width={colW} height={c.ghost * kk} rx={3} fill={c.color} opacity="0.16" />}
            {c.ghost > 0 && <line x1={cx} x2={cx + colW} y1={base - c.ghost * kk} y2={base - c.ghost * kk} stroke={c.color} strokeWidth="1.2" strokeDasharray="3 2" opacity="0.7" />}
            {parts.map((p, j) => {
              const hh = Math.max(0, p.value * kk);
              yy -= hh;
              return <rect key={j} x={cx} y={yy} width={colW} height={hh} fill={p.color} rx={hh > 6 ? 3 : 0} />;
            })}
            <SvgSym x={cx + colW / 2} y={base + fs + 3} text={c.sym} color={c.color} fs={fs + 1} halo={false} />
            <text x={cx + colW / 2} y={base + fs * 2 + 6} textAnchor="middle" fontSize={fs - 1} fontWeight="600" fill="#475569">
              {valueText ? valueText(c.value) : fmt(c.value, 0, decimal)}
            </text>
            {i < 2 && (
              <text x={cx + colW + signW / 2} y={(top + base) / 2 + 6} textAnchor="middle" fontSize={fs + 6} fontWeight="700" fill="#64748b">
                {i === 0 ? '=' : '+'}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
