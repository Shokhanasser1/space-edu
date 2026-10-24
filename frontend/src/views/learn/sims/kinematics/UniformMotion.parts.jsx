import { fmt, useElementSize } from '../kit/ui';

/**
 * Drawing pieces shared by the three uniform-motion lessons (uniform motion,
 * its graphs, relativity of motion): the light "lab paper" scene panel of the
 * chosen design with its legend and chips, a multi-select chip row, side-view
 * vehicles and a stick figure. No words in here - every string arrives
 * through props from a lesson's own TEXT table.
 */

/* ---------------------------------------------------------------- numbers */

export const MINUS = '−';

/** fmt() with a real minus sign. */
export function nf(n, digits, decimal) {
  return fmt(n, digits, decimal).replace('-', MINUS);
}

/** Like nf(), but whole numbers lose their decimals: 20 -> "20", 1.5 -> "1.5". */
export function nfa(n, digits, decimal) {
  const whole = Math.abs(n - Math.round(n)) < 0.5 * 10 ** -(digits + 1);
  return nf(n, whole ? 0 : digits, decimal);
}

/** A number as it stands after an operator: negatives in brackets, "(−15)". */
export function paren(s) {
  return s.startsWith(MINUS) ? `(${s})` : s;
}

/* ------------------------------------------------------------------ scene */

const LEGEND_SWATCH = {
  line: (c) => <line x1="1" y1="5" x2="19" y2="5" stroke={c} strokeWidth="3" strokeLinecap="round" />,
  dash: (c) => <line x1="1" y1="5" x2="19" y2="5" stroke={c} strokeWidth="1.8" strokeDasharray="4 3" />,
  arrow: (c) => (
    <>
      <line x1="1" y1="5" x2="13" y2="5" stroke={c} strokeWidth="3" strokeLinecap="round" />
      <path d="M19,5 L12,1 L12,9 Z" fill={c} />
    </>
  ),
  dot: (c) => <circle cx="10" cy="5" r="4" fill={c} />,
  ring: (c) => <circle cx="10" cy="5" r="3.5" fill="#fff" stroke={c} strokeWidth="2" />,
  area: (c) => <rect x="3" y="0.5" width="14" height="9" rx="2" fill={c} fillOpacity="0.28" stroke={c} strokeWidth="1.2" />,
};

export function LegendItem({ color, label, kind = 'line' }) {
  return (
    <li className="flex items-center gap-1.5">
      <svg width="20" height="10" aria-hidden="true" className="shrink-0">
        {(LEGEND_SWATCH[kind] ?? LEGEND_SWATCH.line)(color)}
      </svg>
      <span>{label}</span>
    </li>
  );
}

/** The time / scale chip in the scene's top-right corner. */
export function SceneChip({ icon: Icon, children, tone = '#0891b2', strong }) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] sm:text-[12px] font-medium shadow-sm tabular-nums ${
        strong ? 'text-white' : 'border-slate-200 bg-white/90 text-slate-600'
      }`}
      style={strong ? { background: tone, borderColor: tone } : undefined}
    >
      {Icon && <Icon size={14} style={{ color: strong ? '#fff' : tone }} aria-hidden="true" />}
      {children}
    </span>
  );
}

/**
 * The light working area of the chosen design: a white panel with a thin
 * border, the legend along the top (moved under the scene on phones), chips
 * on the right, and the SVG drawn at the measured width.
 *
 *   <ScenePanel height={(W, narrow) => …} legend={[{ color, label, kind }]} chips={<SceneChip …/>}>
 *     {(W, H, narrow) => <g>…</g>}
 *   </ScenePanel>
 *
 * `onScrub(x, y, W, H, first)` receives pointer presses and drags in SVG units.
 */
export function ScenePanel({ height, ariaLabel, legend = [], chips = null, children, onScrub, footer = null }) {
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 280);
  const narrow = W < 560;
  const H = Math.round(typeof height === 'function' ? height(W, narrow) : height);

  const point = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-300/70 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_30px_-12px_rgba(0,0,0,0.6)]">
      <div ref={ref} className="w-full">
        <svg
          width="100%"
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={ariaLabel}
          className={`cl-scene block select-none ${onScrub ? 'touch-pan-y' : ''}`}
          onPointerDown={
            onScrub
              ? (e) => {
                  const [x, y] = point(e);
                  if (onScrub(x, y, W, H, true)) e.currentTarget.setPointerCapture?.(e.pointerId);
                }
              : undefined
          }
          onPointerMove={
            onScrub
              ? (e) => {
                  if (!e.buttons) return;
                  const [x, y] = point(e);
                  onScrub(x, y, W, H, false);
                }
              : undefined
          }
        >
          {width > 0 && children(W, H, narrow)}
        </svg>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 sm:p-3">
        {legend.length > 0 && (
          <ul className="hidden sm:flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-[12px] text-slate-600 shadow-sm backdrop-blur">
            {legend.map((l) => (
              <LegendItem key={l.label} {...l} />
            ))}
          </ul>
        )}
        {chips && <div className="ml-auto flex flex-col items-end gap-1.5">{chips}</div>}
      </div>

      {legend.length > 0 && (
        <ul className="flex sm:hidden flex-wrap gap-x-3 gap-y-1 border-t border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          {legend.map((l) => (
            <LegendItem key={l.label} {...l} />
          ))}
        </ul>
      )}
      {footer}
    </div>
  );
}

/* --------------------------------------------------------------- controls */

/** Several toggles at once (aria-pressed buttons in a labelled group). */
export function ToggleChips({ label, options, values, onToggle, className = '' }) {
  return (
    <div role="group" aria-label={label} className={`grid gap-1.5 ${className}`}>
      {options.map((o) => {
        const on = values.includes(o.value);
        const Icon = o.icon;
        const accent = o.color ?? '#22d3ee';
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(o.value)}
            style={on ? { borderColor: `${accent}99`, background: `${accent}1f` } : undefined}
            className={`min-h-10 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 ${
              on ? 'text-white' : 'border-white/10 bg-white/[0.035] text-gray-400 hover:bg-white/[0.08]'
            }`}
          >
            <span className="flex items-center gap-2">
              {Icon && <Icon size={18} strokeWidth={2.2} aria-hidden="true" style={{ color: on ? accent : undefined }} />}
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-tight">{o.label}</span>
                {o.sub && <span className="mt-0.5 block text-[11px] leading-tight text-gray-400 tabular-nums">{o.sub}</span>}
              </span>
              <span
                className="ml-auto grid h-4 w-4 shrink-0 place-items-center rounded border"
                style={{ borderColor: on ? accent : 'rgba(255,255,255,0.25)', background: on ? accent : 'transparent' }}
                aria-hidden="true"
              >
                {on && (
                  <svg width="10" height="10" viewBox="0 0 10 10">
                    <path d="M2,5.2 L4.2,7.4 L8,2.8" fill="none" stroke="#0b1020" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Dark sub-panel used under the scene (controls, graphs). */
export const PANEL = 'rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4';

/** Small uppercase heading inside a panel. */
export function PanelTitle({ children, className = '' }) {
  return <p className={`text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 ${className}`}>{children}</p>;
}

/* --------------------------------------------------------------- vehicles */

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}

const NS = { vectorEffect: 'non-scaling-stroke' };

/**
 * A side-view vehicle standing on the ground line `y`, centred on `x`, drawn
 * `len` px long and facing +x (facing = 1) or −x (−1). The drawings are
 * icons, not to scale: the position is the vehicle's centre.
 * kind: 'car' | 'train' | 'bike' | 'plane' | 'cart' | 'walker'.
 */
export function Vehicle({ kind, x, y, len, facing = 1, color = '#2563eb', phase = 0, moving = false }) {
  if (kind === 'walker') {
    return <Person x={x} floor={y} h={len * 1.6} facing={facing} phase={phase} moving={moving} color={color} />;
  }
  const s = len / 100;
  const dark = shade(color, 0.62);
  return (
    <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${(facing * s).toFixed(4)} ${s.toFixed(4)})`}>
      {kind === 'car' && <CarShape color={color} dark={dark} />}
      {kind === 'train' && <TrainShape color={color} dark={dark} />}
      {kind === 'bike' && <BikeShape color={color} phase={phase} />}
      {kind === 'plane' && <PlaneShape color={color} dark={dark} />}
      {kind === 'cart' && <CartShape color={color} dark={dark} />}
    </g>
  );
}

function Wheel({ cx, cy, r }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#1e293b" />
      <circle cx={cx} cy={cy} r={r * 0.42} fill="#cbd5e1" />
    </g>
  );
}

function CarShape({ color, dark }) {
  return (
    <g>
      <path
        d="M-48,-12 L-48,-24 Q-48,-30 -42,-31 L-27,-32 L-15,-44 Q-13,-46 -9,-46 L15,-46 Q19,-46 22,-43 L33,-32 L44,-30 Q49,-29 49,-23 L49,-12 Z"
        fill={color}
        stroke={dark}
        strokeWidth="1.4"
        {...NS}
      />
      <path d="M-23,-33 L-13,-43 L-1,-43 L-1,-33 Z" fill="#e0f2fe" />
      <path d="M3,-33 L3,-43 L14,-43 Q16,-43 18,-41 L26,-33 Z" fill="#e0f2fe" />
      <rect x="44" y="-27" width="4" height="4" rx="1" fill="#fde047" />
      <rect x="-49" y="-27" width="3" height="4" rx="1" fill="#f87171" />
      <Wheel cx={-28} cy={-9} r={9} />
      <Wheel cx={28} cy={-9} r={9} />
    </g>
  );
}

function TrainShape({ color, dark }) {
  return (
    <g>
      <rect x="-46" y="-11" width="92" height="5" fill="#334155" />
      <path d="M-50,-10 L-50,-45 Q-50,-48 -47,-48 L28,-48 Q43,-48 48,-34 L50,-24 L50,-10 Z" fill={color} stroke={dark} strokeWidth="1.4" {...NS} />
      <rect x="-50" y="-22" width="100" height="4" fill="#fff" fillOpacity="0.65" />
      {[-43, -29, -15, -1].map((wx) => (
        <rect key={wx} x={wx} y="-42" width="10" height="9" rx="1.5" fill="#e0f2fe" />
      ))}
      <path d="M28,-44 L37,-44 Q43,-43 45,-34 L28,-34 Z" fill="#e0f2fe" />
      <circle cx="47" cy="-15" r="2.2" fill="#fde047" />
      {[-37, -24, 24, 37].map((wx) => (
        <circle key={wx} cx={wx} cy="-5" r="5" fill="#1e293b" />
      ))}
    </g>
  );
}

function BikeShape({ color, phase }) {
  const C = [-4, -17];
  const hip = [-12, -50];
  const a = phase * Math.PI * 2;
  const pedal = (k) => [C[0] + Math.cos(a + k * Math.PI) * 9, C[1] + Math.sin(a + k * Math.PI) * 9];
  const knee = (p) => [(hip[0] + p[0]) / 2 + 9, (hip[1] + p[1]) / 2 - 4];
  const p1 = pedal(0);
  const p2 = pedal(1);
  const k1 = knee(p1);
  const k2 = knee(p2);
  const ink = '#0f172a';
  return (
    <g strokeLinecap="round" strokeLinejoin="round" fill="none">
      <circle cx="-30" cy="-17" r="17" stroke="#1e293b" strokeWidth="2.6" {...NS} />
      <circle cx="30" cy="-17" r="17" stroke="#1e293b" strokeWidth="2.6" {...NS} />
      <path d="M-30,-17 L-4,-17 L-12,-44 Z M-12,-44 L22,-42 L-4,-17 M22,-42 L30,-17 M19,-49 L22,-42 M-17,-46 L-7,-46" stroke={color} strokeWidth="2.6" {...NS} />
      <path d={`M${hip[0]},${hip[1]} L${k2[0]},${k2[1]} L${p2[0]},${p2[1]}`} stroke={ink} strokeOpacity="0.5" strokeWidth="3" {...NS} />
      <path d={`M${hip[0]},${hip[1]} L6,-74 M6,-74 L20,-50`} stroke={ink} strokeWidth="3" {...NS} />
      <path d={`M${hip[0]},${hip[1]} L${k1[0]},${k1[1]} L${p1[0]},${p1[1]}`} stroke={ink} strokeWidth="3" {...NS} />
      <circle cx="12" cy="-84" r="7.5" fill={ink} />
    </g>
  );
}

function PlaneShape({ color, dark }) {
  return (
    <g>
      <path d="M-48,-22 L-41,-40 L-33,-40 L-29,-22 Z" fill={color} />
      <path
        d="M-50,-17 Q-50,-24 -41,-24 L35,-24 Q50,-23 50,-17 Q50,-11 35,-10 L-41,-10 Q-50,-10 -50,-17 Z"
        fill="#f8fafc"
        stroke="#475569"
        strokeWidth="1.3"
        {...NS}
      />
      <path d="M38,-22 Q46,-21 48,-18 L38,-18 Z" fill="#38bdf8" />
      {Array.from({ length: 10 }, (_, i) => (
        <circle key={i} cx={-30 + i * 6.6} cy="-18" r="1.5" fill="#38bdf8" />
      ))}
      <path d="M-8,-15 L12,-15 L-6,4 L-15,4 Z" fill={color} stroke={dark} strokeWidth="1" {...NS} />
    </g>
  );
}

function CartShape({ color, dark }) {
  return (
    <g>
      <rect x="-50" y="-44" width="100" height="32" rx="8" fill={color} stroke={dark} strokeWidth="1.4" {...NS} />
      <rect x="-42" y="-39" width="84" height="7" rx="3.5" fill="#fff" fillOpacity="0.35" />
      <Wheel cx={-30} cy={-10} r={10} />
      <Wheel cx={30} cy={-10} r={10} />
    </g>
  );
}

/* ----------------------------------------------------------------- people */

/**
 * A stick figure with its feet on `floor`, `h` px tall. pose 'stand' walks
 * when `moving` (phase = distance walked in strides), 'sit' sits on a seat at
 * half its height.
 */
export function Person({ x, floor, h, facing = 1, phase = 0, moving = false, color = '#e11d48', pose = 'stand' }) {
  const sw = Math.max(1.8, h * 0.075);
  const headR = h * 0.1;
  if (pose === 'sit') {
    const hipY = floor - h * 0.5;
    const shoulderY = hipY - h * 0.33;
    const kneeX = x + facing * h * 0.24;
    return (
      <g stroke={color} strokeWidth={sw} strokeLinecap="round" fill="none">
        <line x1={x} y1={hipY} x2={kneeX} y2={hipY} />
        <line x1={kneeX} y1={hipY} x2={kneeX} y2={floor} />
        <line x1={x} y1={hipY} x2={x} y2={shoulderY} />
        <line x1={x} y1={shoulderY + h * 0.04} x2={x + facing * h * 0.16} y2={hipY - h * 0.03} />
        <circle cx={x + facing * h * 0.01} cy={shoulderY - headR * 1.25} r={headR} fill={color} stroke="none" />
      </g>
    );
  }
  const swing = moving ? Math.sin(phase * Math.PI) * 0.5 : 0;
  const hipY = floor - h * 0.47;
  const shoulderY = floor - h * 0.78;
  const leg = h * 0.47;
  const arm = h * 0.34;
  const foot = (a) => [x + Math.sin(a) * leg * facing, hipY + Math.cos(a) * leg];
  const hand = (a) => [x + Math.sin(a) * arm * facing, shoulderY + Math.cos(a) * arm];
  // standing still: feet a little apart and arms a little out, so the figure reads as a person
  const [f1x, f1y] = foot(moving ? swing : 0.17);
  const [f2x, f2y] = foot(moving ? -swing : -0.17);
  const [h1x, h1y] = hand(moving ? -swing * 0.9 : 0.24);
  const [h2x, h2y] = hand(moving ? swing * 0.9 : -0.24);
  return (
    <g stroke={color} strokeWidth={sw} strokeLinecap="round" fill="none">
      <line x1={x} y1={hipY} x2={f2x} y2={f2y} strokeOpacity="0.55" />
      <line x1={x} y1={shoulderY} x2={h2x} y2={h2y} strokeOpacity="0.55" />
      <line x1={x} y1={hipY} x2={x} y2={shoulderY - h * 0.04} />
      <line x1={x} y1={hipY} x2={f1x} y2={f1y} />
      <line x1={x} y1={shoulderY} x2={h1x} y2={h1y} />
      <circle cx={x + facing * h * 0.01} cy={floor - h * 0.9} r={headR} fill={color} stroke="none" />
    </g>
  );
}

/** Nice tick step for an axis spanning `span` units in `px` pixels, at least `minPx` apart. */
export function tickStep(span, px, minPx) {
  const raw = (span / Math.max(px, 1)) * minPx;
  const p = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 5, 10]) if (m * p >= raw) return m * p;
  return 10 * p;
}
