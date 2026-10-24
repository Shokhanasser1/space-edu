import { Timer } from 'lucide-react';
import { useElementSize } from '../kit/ui';
import { PALETTE } from '../kit/scene';

/**
 * Shared pieces of the curvilinear-motion simulators: the light scene frame
 * with its legend, a route made of straight pieces and circular arcs, a car
 * seen from above, and small SVG helpers.
 */

export const C = PALETTE;

/* ----------------------------------------------------------- scene frame */

function LegendMark({ kind, color }) {
  if (kind === 'arrow')
    return (
      <svg width="18" height="8" aria-hidden="true">
        <line x1="1" y1="4" x2="12" y2="4" stroke={color} strokeWidth="2.5" />
        <path d="M17,4 L11,1 L11,7 Z" fill={color} />
      </svg>
    );
  if (kind === 'dash') return <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: color }} aria-hidden="true" />;
  if (kind === 'dot') return <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden="true" />;
  return <span className="h-1 w-4 rounded" style={{ background: color }} aria-hidden="true" />;
}

export function LegendList({ items, className = '' }) {
  return (
    <ul className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] sm:text-[12px] text-slate-600 ${className}`}>
      {items.map((l) => (
        <li key={l.label} className="flex items-center gap-1.5">
          <LegendMark kind={l.kind} color={l.color} />
          <span>{l.label}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The light lab-paper panel: legend on top (below the drawing on phones), a
 * chip on the right, and `children(W, H, narrow)` drawn into an SVG exactly
 * as wide as the panel. `height` may be a function of (W, narrow).
 */
export function LabScene({ legend = [], chip, height, ariaLabel, children, className = '' }) {
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 260);
  const narrow = W < 560;
  const H = Math.round(typeof height === 'function' ? height(W, narrow) : height);
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-300/70 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_30px_-12px_rgba(0,0,0,0.6)] ${className}`}
    >
      <div ref={ref} className="cl-scene relative w-full">
        <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex items-start justify-between gap-2 sm:inset-x-3 sm:top-3">
          {!narrow && legend.length > 0 && (
            <LegendList items={legend} className="rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 shadow-sm backdrop-blur" />
          )}
          {chip && (
            <span className="ml-auto flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[11px] sm:text-[12px] font-medium tabular-nums text-slate-600 shadow-sm">
              {chip}
            </span>
          )}
        </div>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="block select-none">
          <rect width={W} height={H} fill="#fbfcfe" />
          {width > 0 && children(W, H, narrow)}
        </svg>
      </div>
      {narrow && legend.length > 0 && <LegendList items={legend} className="border-t border-slate-200 bg-slate-50 px-3 py-2" />}
    </div>
  );
}

export function TimeChip({ text }) {
  return (
    <>
      <Timer size={14} className="text-cyan-600" aria-hidden="true" />
      <span>{text}</span>
    </>
  );
}

/** Text with a white halo, for labels drawn over lines on the paper. */
export function Label({ x, y, children, color = C.ink, size = 12, anchor = 'middle', weight = 700, italic }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={size}
      fontWeight={weight}
      fontStyle={italic ? 'italic' : undefined}
      fill={color}
      stroke="#fff"
      strokeWidth="3.5"
      strokeLinejoin="round"
      paintOrder="stroke"
    >
      {children}
    </text>
  );
}

/**
 * The unit of the y axis, written beside the top of the y axis line (kit's
 * AxisNumbers puts it in the corner, under the legend chips).
 */
export function YUnit({ text, narrow, x }) {
  return (
    <text
      x={x + 6}
      y={narrow ? 54 : 58}
      fontSize="11"
      fontWeight="700"
      fill="#475569"
      stroke="#fbfcfe"
      strokeWidth="3"
      paintOrder="stroke"
    >
      {text}
    </text>
  );
}

/** A small right-angle mark at (x, y) between the unit screen directions u and w. */
export function RightAngle({ x, y, u, w, size = 10, color = C.ink }) {
  const a = { x: x + u.x * size, y: y + u.y * size };
  const b = { x: x + (u.x + w.x) * size, y: y + (u.y + w.y) * size };
  const c = { x: x + w.x * size, y: y + w.y * size };
  return <path d={`M${a.x},${a.y} L${b.x},${b.y} L${c.x},${c.y}`} fill="none" stroke={color} strokeWidth="1.3" />;
}

/** Direction of velocity in degrees, 0…360, counted anticlockwise from the +x axis. */
export function headingDeg(rad) {
  const d = (rad * 180) / Math.PI;
  return ((d % 360) + 360) % 360;
}

/* ---------------------------------------------------------------- routes */

/**
 * A route from (x0, y0) with heading h0 (rad, anticlockwise from +x) made of
 * ['L', length] straight pieces and ['A', radius, degrees] arcs (positive
 * degrees turn left, negative turn right).
 */
export function buildRoute(x0, y0, h0, specs) {
  let x = x0;
  let y = y0;
  let h = h0;
  let s = 0;
  const segs = [];
  for (const sp of specs) {
    if (sp[0] === 'L') {
      const len = sp[1];
      segs.push({ type: 'L', s0: s, len, x, y, h });
      x += len * Math.cos(h);
      y += len * Math.sin(h);
      s += len;
    } else {
      const R = sp[1];
      const sw = (sp[2] * Math.PI) / 180;
      const sg = Math.sign(sw);
      const cx = x - sg * R * Math.sin(h);
      const cy = y + sg * R * Math.cos(h);
      const len = R * Math.abs(sw);
      segs.push({ type: 'A', s0: s, len, R, h, sg, cx, cy });
      h += sw;
      x = cx + sg * R * Math.sin(h);
      y = cy - sg * R * Math.cos(h);
      s += len;
    }
  }
  return { segs, length: s };
}

/** Position, heading and (for arcs) the centre and radius of the bend at distance s along the route. */
export function routeAt(route, s) {
  const ss = Math.max(0, Math.min(s, route.length));
  let seg = route.segs[route.segs.length - 1];
  for (const g of route.segs) {
    if (ss <= g.s0 + g.len + 1e-9) {
      seg = g;
      break;
    }
  }
  const u = ss - seg.s0;
  if (seg.type === 'L') return { x: seg.x + u * Math.cos(seg.h), y: seg.y + u * Math.sin(seg.h), h: seg.h, R: Infinity };
  const h = seg.h + (seg.sg * u) / seg.R;
  return { x: seg.cx + seg.sg * seg.R * Math.sin(h), y: seg.cy - seg.sg * seg.R * Math.cos(h), h, R: seg.R, cx: seg.cx, cy: seg.cy, sg: seg.sg };
}

/** Points along the route every `step` metres, as [{ x, y }]. */
export function sampleRoute(route, step = 0.5, sMax = route.length) {
  const pts = [];
  const n = Math.max(2, Math.ceil(sMax / step));
  for (let i = 0; i <= n; i += 1) pts.push(routeAt(route, (sMax * i) / n));
  return pts;
}

/* ------------------------------------------------------------------ car */

/** A car seen from above at screen (x, y), pointing along the world heading h (rad). */
export function CarTop({ x, y, h, len, wid, color = C.ink, ghost }) {
  const deg = (-h * 180) / Math.PI;
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${deg.toFixed(1)})`} opacity={ghost ? 0.28 : 1}>
      <rect x={-len / 2} y={-wid / 2} width={len} height={wid} rx={wid * 0.32} fill={color} stroke="#fff" strokeWidth={ghost ? 1 : 1.6} />
      {!ghost && (
        <>
          <rect x={len * 0.08} y={-wid * 0.36} width={len * 0.2} height={wid * 0.72} rx={wid * 0.12} fill="#7dd3fc" />
          <rect x={-len * 0.36} y={-wid * 0.34} width={len * 0.14} height={wid * 0.68} rx={wid * 0.1} fill="#94a3b8" />
          <rect x={len * 0.42} y={-wid * 0.42} width={len * 0.06} height={wid * 0.2} rx={1} fill="#fde68a" />
          <rect x={len * 0.42} y={wid * 0.22} width={len * 0.06} height={wid * 0.2} rx={1} fill="#fde68a" />
        </>
      )}
    </g>
  );
}
