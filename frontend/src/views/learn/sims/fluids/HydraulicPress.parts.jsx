import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Ruler, Timer } from 'lucide-react';

import { Arrow, clamp, fmt, niceStep, textWidth, useElementSize } from '../kit/ui';
import { PALETTE } from '../kit/scene';

/**
 * Pieces shared by the three labs of the lesson "Gidravlik press": the
 * colours of the forces and of the oil, symbols with subscripts, force
 * arrows, a dial manometer, rows of equal pressure arrows, flowing dashes,
 * the hand, the loads (crate, car, truck), the light scene shell, the
 * scene + side-panel row and the numbered calculation steps. No words live
 * here — every label arrives through props from the lesson's TEXT table.
 */

export const G = 9.8; // m/s²

/** Hydraulic oil — the same amber look as in the other fluids lessons. */
export const OIL = { fill: '#facb7a', hi: '#fde3b0', edge: '#b45309', dark: '#92400e', flow: '#fff7e6' };

/** One colour per force: hand F₁ pink, liquid on the large piston F₂ blue, weight red, pressure rust. */
export const FC = {
  f1: '#db2777',
  f1Text: '#f9a8d4',
  f2: '#2563eb',
  f2Text: '#93c5fd',
  mg: '#dc2626',
  mgText: '#fca5a5',
  p: '#9a3412',
  pText: '#fdba74',
  vel: PALETTE.vel,
  velText: PALETTE.velText,
  work: '#7c3aed',
  workText: '#c4b5fd',
  gain: '#059669',
  gainText: '#6ee7b7',
};

export const STEEL = { body: '#d5dde7', face: '#e9eef4', mid: '#94a3b8', dark: '#64748b', edge: '#334155', ram: '#aab6c6' };

/** fmt with a true minus sign. */
export function num(n, digits = 1, decimal = '.') {
  return fmt(n, digits, decimal).replace('-', '−');
}

/** Thin-space thousands and a chosen decimal mark: 12 000 · 1 234.5 */
export function big(n, digits = 0, decimal = '.') {
  const s = fmt(n, digits, '.');
  const neg = s.startsWith('-');
  const [i, d] = (neg ? s.slice(1) : s).split('.');
  const g = i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${neg ? '−' : ''}${g}${d ? decimal + d : ''}`;
}

/** An area in cm² written in m² without trailing zeros: 2 → 0.0002, 200 → 0.02. */
export function m2(cm2, decimal = '.') {
  const s = (cm2 / 1e4).toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  return decimal === '.' ? s : s.replace('.', decimal);
}

/** The smallest "round" full scale ≥ 1.25·value. */
export function pickRange(value, ranges = [100, 250, 500, 1000, 2500, 5000, 10000]) {
  for (const r of ranges) if (r >= value * 1.25) return r;
  return ranges[ranges.length - 1];
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

/**
 * Follows `target` with a critically damped spring (time constant `tau`
 * seconds) — needles and levels settle smoothly and never jump. Runs its
 * own requestAnimationFrame only while moving; cancelled on unmount.
 */
export function useSmooth(target, tau = 0.12, eps = 1e-3) {
  const [value, setValue] = useState(target);
  const pos = useRef(target);
  const vel = useRef(0);
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const w = 2 / tau;
    const step = (now) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      // exact step of a critically damped spring — stable for any dt
      const x0 = pos.current - target;
      const e = Math.exp(-w * dt);
      const c = (vel.current + w * x0) * dt;
      pos.current = target + (x0 + c) * e;
      vel.current = (vel.current - w * c) * e;
      const tol = eps * Math.max(1, Math.abs(target));
      if (Math.abs(pos.current - target) < tol && Math.abs(vel.current) < tol * w) {
        pos.current = target;
        vel.current = 0;
        setValue(target);
        return;
      }
      setValue(pos.current);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, tau, eps]);
  return value;
}

/* ------------------------------------------------------------ symbols */

/** Splits "F_{old} = p·S" into plain and subscript runs. */
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
        <tspan dy={low ? -shift : undefined} fontStyle="normal" fontWeight={600}>
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

/** A dimension line from p1 to p2 (screen px) with end ticks and a label pill in the middle. */
export function DimLine({ p1, p2, color, label, fs = 12, box, tick = 6, align = 'center' }) {
  const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  if (len < 3) return null;
  const ux = (p2.x - p1.x) / len;
  const uy = (p2.y - p1.y) / len;
  const nx = -uy * tick;
  const ny = ux * tick;
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  const w = label ? symWidth(label, null, fs) + 14 : 0;
  const h = fs + 9;
  let left = align === 'left' ? mx - w - 5 : align === 'right' ? mx + 5 : mx - w / 2;
  let top = my - h / 2;
  if (box) {
    left = clamp(left, 3, box.w - w - 3);
    top = clamp(top, 3, box.h - h - 3);
  }
  return (
    <g pointerEvents="none">
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth="1.6" />
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

/** A label pill in the drawing: rounded rect + text, kept inside `box`. */
export function Tag({ x, y, text, color = '#0f172a', bg = '#fff', border, fs = 12, box, anchor = 'middle', weight = 700 }) {
  if (!text) return null;
  const w = symWidth(text, null, fs) + 14;
  const h = fs + 9;
  let left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  let top = y - h / 2;
  if (box) {
    left = clamp(left, 3, box.w - w - 3);
    top = clamp(top, 3, box.h - h - 3);
  }
  return (
    <g pointerEvents="none">
      <rect x={left} y={top} width={w} height={h} rx={h / 2} fill={bg} stroke={border ?? color} strokeWidth="1.2" />
      <SvgSym x={left + w / 2} y={top + h / 2 + fs * 0.36} text={text} color={color} fs={fs} halo={false} weight={weight} italic={false} />
    </g>
  );
}

/* -------------------------------------------------------------- controls */

/** Small caption above a group of controls. */
export function GroupLabel({ children }) {
  return <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{children}</p>;
}

/** The dark panel that holds sliders, graphs and the calculation steps. */
export function Panel({ children, className = '' }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4 ${className}`}>{children}</div>;
}

/** A chip in the scene's top-right corner (time, scale…). */
export function Chip({ icon: Icon = Timer, children, color = '#0891b2' }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[11px] sm:text-[12px] font-medium tabular-nums text-slate-600 shadow-sm">
      {Icon && <Icon size={14} style={{ color }} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** A scale bar of a round number of units at `k` px per unit (forces, lengths). */
export function ScaleBar({ k, text }) {
  const step = niceStep(k, 22);
  const px = step * k;
  return (
    <>
      <svg width={px + 4} height="10" aria-hidden="true" className="shrink-0">
        <line x1="2" y1="5" x2={px + 2} y2="5" stroke="#0f172a" strokeWidth="2.5" />
        <line x1="2" y1="1" x2="2" y2="9" stroke="#0f172a" strokeWidth="1.5" />
        <line x1={px + 2} y1="1" x2={px + 2} y2="9" stroke="#0f172a" strokeWidth="1.5" />
      </svg>
      {text(step)}
    </>
  );
}

/** The scale chip: "1 cell = 5 cm · |—| 5 kN". */
export function ScaleChip({ children }) {
  return (
    <Chip icon={Ruler} color="#dc2626">
      {children}
    </Chip>
  );
}

/* ---------------------------------------------------------------- scene */

function LegendItem({ color, label, kind = 'line', mark }) {
  if (kind === 'note') {
    return (
      <li className="flex items-center gap-1.5 italic text-slate-500">
        <Sym>{label}</Sym>
      </li>
    );
  }
  if (kind === 'num') {
    return (
      <li className="flex items-center gap-1.5">
        <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: color }} aria-hidden="true">
          {mark}
        </span>
        <span>
          <Sym>{label}</Sym>
        </span>
      </li>
    );
  }
  return (
    <li className="flex items-center gap-1.5">
      <svg width="20" height="10" aria-hidden="true" className="shrink-0">
        {kind === 'dash' && <line x1="1" y1="5" x2="19" y2="5" stroke={color} strokeWidth="2" strokeDasharray="4 3" />}
        {kind === 'box' && <rect x="3" y="0.5" width="14" height="9" rx="2" fill={color} stroke="rgba(0,0,0,0.25)" />}
        {(kind === 'line' || kind === 'arrow') && <line x1="1" y1="5" x2={kind === 'arrow' ? 13 : 19} y2="5" stroke={color} strokeWidth="3" strokeLinecap="round" />}
        {kind === 'arrow' && <path d="M19,5 L12,1 L12,9 Z" fill={color} />}
        {kind === 'arrows' && (
          <>
            {[4, 10, 16].map((x) => (
              <g key={x}>
                <line x1={x} y1="9.5" x2={x} y2="4" stroke={color} strokeWidth="1.5" />
                <path d={`M${x},1 L${x - 2.2},4.5 L${x + 2.2},4.5 Z`} fill={color} />
              </g>
            ))}
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

/**
 * The light scene panel of the chosen design. `height(W, narrow)` sizes the
 * drawing; `children(W, H, narrow)` draws it; `chips(W, narrow, H)` (or a node)
 * fills the top-right corner. The legend floats over the top-left from `sm`
 * up and moves under the scene on phones.
 */
export function LabScene({ legend = [], chips, height, ariaLabel, children, minW = 280, className = '', defs, legendBelow = false }) {
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
          {defs && <defs>{defs}</defs>}
          <rect width={W} height={H} fill="#fbfcfe" />
          {width > 0 && children(W, H, narrow)}
        </svg>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 sm:p-3">
        {legend.length > 0 && !legendBelow && (
          <ul className="hidden sm:flex max-w-[62%] flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-[12px] text-slate-600 shadow-sm backdrop-blur">
            {legend.map((l, i) => (
              <LegendItem key={i} {...l} />
            ))}
          </ul>
        )}
        {chipNode && <div className="ml-auto flex shrink-0 flex-col items-end gap-1.5">{chipNode}</div>}
      </div>
      {legend.length > 0 && (
        <ul
          className={`${legendBelow ? 'flex sm:text-[12px] sm:gap-x-4' : 'flex sm:hidden'} flex-wrap gap-x-3 gap-y-1 border-t border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600`}
        >
          {legend.map((l, i) => (
            <LegendItem key={i} {...l} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Ground: a hatched strip under the line y = `y` across the drawing. */
export function Ground({ W, y, depth = 14, x0 = 0 }) {
  const hatch = [];
  for (let x = x0 - depth; x < W + depth; x += 12) {
    hatch.push(<line key={x} x1={x} y1={y + depth} x2={x + depth} y2={y} stroke="#cbd5e1" strokeWidth="1.2" />);
  }
  return (
    <g aria-hidden="true">
      <rect x={x0} y={y} width={W - x0} height={depth} fill="#f1f5f9" />
      {hatch}
      <line x1={x0} x2={W} y1={y} y2={y} stroke="#64748b" strokeWidth="2" />
    </g>
  );
}

/**
 * The scene beside the calculation panel, with `under` (the live explanation)
 * right below the scene. On desktop the scene takes the panel's height minus
 * `under`, kept between `min` and `max` px (`renderScene(fitH)`); below that
 * they stack and the scene keeps its own height (fitH = null).
 */
export function SceneRow({ renderScene, side, under, min = 452, max = 560 }) {
  const [ref, size] = useElementSize();
  const [uRef, uSize] = useElementSize();
  const lg = useMediaQuery('(min-width: 1024px)');
  const fitH = lg && size.height > 0 ? clamp(Math.round(size.height - (under ? uSize.height + 12 : 0)), min, max) : null;
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <div className="min-w-0 space-y-3">
        {renderScene(fitH)}
        {under && <div ref={uRef}>{under}</div>}
      </div>
      <div ref={ref}>{side}</div>
    </div>
  );
}

/* ------------------------------------------------------ the steps panel */

/** A formula badge and a title, then numbered calculation steps. */
export function StepsPanel({ formula, title, children, className = '' }) {
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

export function Step({ n, title, children, tone }) {
  return (
    <li className="flex gap-2.5">
      <span
        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-400/15 text-[11px] font-bold text-cyan-300"
        style={tone ? { background: `${tone}26`, color: tone } : undefined}
        aria-hidden="true"
      >
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

/** Horizontal bars on one scale, for a readout tile: [{ label, value, color, text }]. */
export function CompareBars({ rows, max }) {
  const top = Math.max(max ?? 0, ...rows.map((r) => r.value), 1e-9);
  return (
    <div className="mt-2 space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="w-9 shrink-0 font-serif text-[13px] italic text-gray-300">
            <Sym>{r.label}</Sym>
          </span>
          <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-200" style={{ width: `${clamp(r.value / top, 0, 1) * 100}%`, background: r.color }} />
          </span>
          {r.text && <span className="w-[4.6rem] shrink-0 text-right text-[11px] tabular-nums text-gray-400">{r.text}</span>}
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------- instruments */

/**
 * A dial manometer at (x, y) with radius r: 270° scale from 0 to `max`, a
 * red needle at `value`, and the reading in a pill under the dial. `label`
 * (e.g. "p₁") sits above.
 */
export function Gauge({ x, y, r, value, max, unit, label, decimal = '.', digits = 0, fs = 11, readout }) {
  const ang = (v) => ((135 + (clamp(v, 0, max * 1.04) / max) * 270) * Math.PI) / 180;
  const ticks = [];
  for (let i = 0; i <= 20; i += 1) {
    const a = ang((i / 20) * max);
    const major = i % 5 === 0;
    const r0 = r * (major ? 0.7 : 0.78);
    ticks.push(
      <line
        key={i}
        x1={x + Math.cos(a) * r0}
        y1={y + Math.sin(a) * r0}
        x2={x + Math.cos(a) * r * 0.86}
        y2={y + Math.sin(a) * r * 0.86}
        stroke="#334155"
        strokeWidth={major ? 1.4 : 0.8}
      />,
    );
  }
  const fr = r >= 34 ? [0, 0.5, 1] : r >= 28 ? [0, 1] : [];
  const ld = fr.some((f) => !Number.isInteger(f * max)) ? 1 : 0;
  const labels = fr.map((f) => {
    const a = ang(f * max);
    const rr = r * 0.48;
    return (
      <text key={f} x={x + Math.cos(a) * rr} y={y + Math.sin(a) * rr + 3} textAnchor="middle" fontSize={Math.max(7, r * 0.24)} fontWeight="600" fill="#475569">
        {big(f * max, ld, decimal)}
      </text>
    );
  });
  const a = ang(value);
  const text = readout ?? `${big(value, digits, decimal)} ${unit}`;
  const pw = textWidth(text, fs, 700) + 12;
  return (
    <g pointerEvents="none">
      {label && <SvgSym x={x} y={y - r - 6} text={label} color="#0f172a" fs={fs + 1} halo />}
      <circle cx={x} cy={y} r={r + 3} fill="#94a3b8" />
      <circle cx={x} cy={y} r={r + 1} fill="#e2e8f0" />
      <circle cx={x} cy={y} r={r - 1} fill="#ffffff" stroke="#cbd5e1" />
      {/* the coloured band of the working range */}
      <path
        d={`M${x + Math.cos(ang(0)) * r * 0.9},${y + Math.sin(ang(0)) * r * 0.9} A${r * 0.9},${r * 0.9} 0 1 1 ${x + Math.cos(ang(max)) * r * 0.9},${y + Math.sin(ang(max)) * r * 0.9}`}
        fill="none"
        stroke="#fde68a"
        strokeWidth={r * 0.08}
      />
      {ticks}
      {labels}
      <text x={x} y={y + r * 0.5} textAnchor="middle" fontSize={Math.max(7, r * 0.24)} fill="#64748b">
        {unit}
      </text>
      <line x1={x - Math.cos(a) * r * 0.14} y1={y - Math.sin(a) * r * 0.14} x2={x + Math.cos(a) * r * 0.8} y2={y + Math.sin(a) * r * 0.8} stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
      <circle cx={x} cy={y} r={Math.max(2.5, r * 0.1)} fill="#0f172a" />
      <rect x={x - pw / 2} y={y + r + 6} width={pw} height={fs + 8} rx={(fs + 8) / 2} fill="#fff" stroke="#94a3b8" />
      <text x={x} y={y + r + 6 + (fs + 8) / 2 + fs * 0.36} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#0f172a">
        {text}
      </text>
    </g>
  );
}

/**
 * A row of equal pressure arrows pushing on a surface: along x from `a` to
 * `b` at the surface line `at` (dir 'up' | 'down'), or along y (dir 'left' |
 * 'right'). Arrow tips touch the surface; `len` px is the same for all.
 */
export function PressureArrows({ a, b, at, dir = 'up', len, color = FC.p, spacing = 14, width = 1.8, head = 6, opacity = 1 }) {
  if (len < 3 || b - a < 2) return null;
  const n = Math.max(1, Math.round((b - a) / spacing));
  const step = (b - a) / n;
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const c = a + step * (i + 0.5);
    let x1;
    let y1;
    let x2;
    let y2;
    if (dir === 'up') [x1, y1, x2, y2] = [c, at + len, c, at + 1];
    else if (dir === 'down') [x1, y1, x2, y2] = [c, at - len, c, at - 1];
    else if (dir === 'left') [x1, y1, x2, y2] = [at + len, c, at + 1, c];
    else [x1, y1, x2, y2] = [at - len, c, at - 1, c];
    out.push(<Arrow key={i} x1={x1} y1={y1} x2={x2} y2={y2} color={color} width={width} head={head} />);
  }
  return (
    <g pointerEvents="none" opacity={opacity}>
      {out}
    </g>
  );
}

/** Dashes running along a path at `speed` px/s while `active` (phase in seconds). */
export function FlowDashes({ d, phase, active, speed = 40, color = OIL.flow, width = 2.4, reverse = false }) {
  if (!active) return null;
  const off = ((phase * speed) % 16) * (reverse ? 1 : -1);
  return <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray="4 12" strokeDashoffset={off} opacity="0.95" pointerEvents="none" />;
}

/** A fist pressing down on a rod top at (x, y): sleeve above, knuckles below. */
export function Hand({ x, y, s = 1, pressing }) {
  const w = 22 * s;
  const h = 16 * s;
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} pointerEvents="none">
      <rect x={-w * 0.36} y={-h - 18 * s} width={w * 0.72} height={20 * s} rx={4 * s} fill="#3b82f6" stroke="#1e40af" strokeWidth="1.2" />
      <rect x={-w / 2} y={-h} width={w} height={h} rx={6 * s} fill="#f1c27d" stroke="#b07a3b" strokeWidth="1.3" />
      {[-0.25, 0, 0.25].map((f) => (
        <line key={f} x1={f * w} x2={f * w} y1={-h * 0.92} y2={-h * 0.38} stroke="#b07a3b" strokeWidth="1" />
      ))}
      {pressing && <line x1={-w / 2 - 3} x2={w / 2 + 3} y1={1} y2={1} stroke="#b07a3b" strokeWidth="1" opacity="0.5" />}
    </g>
  );
}

/** Sizes of the loads in drawing cm (drawn smaller than real — the chip says so). */
export const LOAD_SIZE = { crate: { w: 24, h: 20 }, car: { w: 50, h: 17 }, truck: { w: 56, h: 22 } };

/** A load standing with its bottom centre at (cx, yb): crate, car or truck. `k` px per drawing cm. */
export function Load({ kind, cx, yb, k, label, fs = 11 }) {
  const { w: wc, h: hc } = LOAD_SIZE[kind];
  const w = wc * k;
  const h = hc * k;
  const x0 = cx - w / 2;
  let body;
  if (kind === 'crate') {
    body = (
      <g>
        <rect x={x0} y={yb - h} width={w} height={h} rx={2} fill="#d4a15e" stroke="#8a5a24" strokeWidth="1.6" />
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={x0 + 2} x2={x0 + w - 2} y1={yb - h * f} y2={yb - h * f} stroke="#a86f2e" strokeWidth="1" />
        ))}
        <line x1={x0 + 3} y1={yb - 3} x2={x0 + w - 3} y2={yb - h + 3} stroke="#8a5a24" strokeWidth="2.2" />
        <line x1={x0 + 3} y1={yb - h + 3} x2={x0 + w - 3} y2={yb - 3} stroke="#8a5a24" strokeWidth="2.2" />
        <rect x={x0} y={yb - h} width={w} height={h} rx={2} fill="none" stroke="#8a5a24" strokeWidth="3" />
      </g>
    );
  } else if (kind === 'car') {
    const r = h * 0.2;
    const P = (fx, fy) => `${(x0 + fx * w).toFixed(1)},${(yb - fy * h).toFixed(1)}`;
    body = (
      <g>
        <path
          d={`M${P(0.02, 0.2)} L${P(0.02, 0.48)} Q${P(0.03, 0.58)} ${P(0.12, 0.6)} L${P(0.3, 0.63)} L${P(0.4, 0.96)} L${P(0.68, 0.96)} L${P(0.8, 0.62)} L${P(0.95, 0.58)} Q${P(0.99, 0.55)} ${P(0.99, 0.45)} L${P(0.99, 0.2)} Z`}
          fill="#475569"
          stroke="#1e293b"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d={`M${P(0.34, 0.63)} L${P(0.42, 0.9)} L${P(0.53, 0.9)} L${P(0.53, 0.63)} Z`} fill="#bfdbfe" stroke="#1e293b" strokeWidth="1" />
        <path d={`M${P(0.56, 0.63)} L${P(0.56, 0.9)} L${P(0.665, 0.9)} L${P(0.755, 0.63)} Z`} fill="#bfdbfe" stroke="#1e293b" strokeWidth="1" />
        <line x1={x0 + 0.02 * w} x2={x0 + 0.99 * w} y1={yb - 0.42 * h} y2={yb - 0.42 * h} stroke="#94a3b8" strokeWidth="1" />
        <rect x={x0 + 0.015 * w} y={yb - 0.5 * h} width={0.04 * w} height={0.07 * h} rx={1} fill="#fde68a" />
        <rect x={x0 + 0.945 * w} y={yb - 0.5 * h} width={0.04 * w} height={0.07 * h} rx={1} fill="#f87171" />
        {[0.2, 0.8].map((f) => (
          <g key={f}>
            <circle cx={x0 + f * w} cy={yb - r} r={r} fill="#111827" />
            <circle cx={x0 + f * w} cy={yb - r} r={r * 0.5} fill="#cbd5e1" />
          </g>
        ))}
      </g>
    );
  } else {
    const r = h * 0.17;
    const P = (fx, fy) => `${(x0 + fx * w).toFixed(1)},${(yb - fy * h).toFixed(1)}`;
    body = (
      <g>
        <rect x={x0 + 0.02 * w} y={yb - 0.98 * h} width={0.66 * w} height={0.8 * h} rx={2} fill="#e2e8f0" stroke="#334155" strokeWidth="1.5" />
        {[0.2, 0.36, 0.52].map((f) => (
          <line key={f} x1={x0 + f * w} x2={x0 + f * w} y1={yb - 0.94 * h} y2={yb - 0.24 * h} stroke="#cbd5e1" strokeWidth="1" />
        ))}
        <path d={`M${P(0.7, 0.18)} L${P(0.7, 0.8)} L${P(0.86, 0.8)} L${P(0.98, 0.52)} L${P(0.98, 0.18)} Z`} fill="#64748b" stroke="#1e293b" strokeWidth="1.5" strokeLinejoin="round" />
        <path d={`M${P(0.75, 0.52)} L${P(0.75, 0.74)} L${P(0.84, 0.74)} L${P(0.93, 0.52)} Z`} fill="#bfdbfe" stroke="#1e293b" strokeWidth="1" />
        <rect x={x0 + 0.02 * w} y={yb - 0.24 * h} width={0.96 * w} height={0.07 * h} fill="#334155" />
        {[0.14, 0.32, 0.84].map((f) => (
          <g key={f}>
            <circle cx={x0 + f * w} cy={yb - r} r={r} fill="#111827" />
            <circle cx={x0 + f * w} cy={yb - r} r={r * 0.45} fill="#cbd5e1" />
          </g>
        ))}
      </g>
    );
  }
  const lw = textWidth(label ?? '', fs, 700) + 12;
  const ly = kind === 'car' ? yb - h * 0.33 : kind === 'truck' ? yb - h * 0.58 : yb - h * 0.5;
  const lx = kind === 'truck' ? x0 + w * 0.35 : kind === 'car' ? x0 + w * 0.3 : cx - w * 0.12;
  return (
    <g pointerEvents="none">
      {body}
      {label && (
        <g>
          <rect x={lx - lw / 2} y={ly - (fs + 6) / 2} width={lw} height={fs + 6} rx={(fs + 6) / 2} fill="#ffffff" fillOpacity="0.92" stroke="#334155" strokeWidth="1" />
          <text x={lx} y={ly + fs * 0.36} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#0f172a">
            {label}
          </text>
        </g>
      )}
    </g>
  );
}

/** Centre of mass height of a load above its bottom, in drawing cm. */
export const loadCom = (kind) => LOAD_SIZE[kind].h * (kind === 'car' ? 0.42 : 0.5);
