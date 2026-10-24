import { Pause, Play, RotateCcw, Timer } from 'lucide-react';

import { Arrow, Btn, Pill, fmt, groupThousands, useElementSize } from '../kit/ui';
import { PALETTE } from '../kit/scene';

/**
 * Drawing pieces shared by the three tabs of the "Weight" lesson: the scene
 * shell of the chosen design (light lab paper, legend chips on top, chips on
 * the right, the legend under the scene on phones), Start/Pause/Reset, force
 * arrows with a white halo and a point-of-application dot, a force scale bar,
 * a front-view person and a bathroom scale. No words live here — every label
 * arrives through props from the lesson's TEXT table.
 */

export const G = 9.8; // m/s², free-fall acceleration used in the lesson

/** One colour per force kind, kept the same in all three tabs and in the legends. */
export const FC = {
  mg: '#dc2626', // force of gravity, applied to the body
  mgText: '#fca5a5',
  N: '#0284c7', // normal (support) reaction, applied to the body
  NText: '#7dd3fc',
  T: '#0d9488', // cord tension, applied to the body
  TText: '#5eead4',
  P: '#7c3aed', // weight, applied to the support / suspension
  PText: '#c4b5fd',
  a: PALETTE.acc,
  aText: PALETTE.accText,
  v: PALETTE.vel,
  vText: PALETTE.velText,
};

/* -------------------------------------------------------------- numbers */

/** Newtons as whole numbers, grouped by thousands from 10 000 up. */
export function newtons(n, dec = '.') {
  if (!Number.isFinite(n)) return '—';
  const r = Math.round(n);
  if (Math.abs(r) >= 10000) return (r < 0 ? '−' : '') + groupThousands(Math.abs(r));
  return fmt(r, 0, dec);
}

/** Fixed-point with a real minus sign. */
export function num(n, digits = 1, dec = '.') {
  const s = fmt(n, digits, dec);
  return s.startsWith('-') ? `−${s.slice(1)}` : s;
}

/** A graph axis that ends on a round number: 4 equal steps of 1, 1.5, 2, 2.5, 3, 4, 5, 6 or 8 × 10ⁿ. */
export function niceAxis(v) {
  const raw = Math.max(v, 1e-9) / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  let step = 10 * p;
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (m * p >= raw - 1e-9) {
      step = m * p;
      break;
    }
  }
  const digits = Math.abs(step - Math.round(step)) < 1e-9 ? 0 : Math.abs(step * 10 - Math.round(step * 10)) < 1e-9 ? 1 : 2;
  return { max: step * 4, step, digits };
}

/* ------------------------------------------------------------- controls */

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

/** Small caption above a group of chips. */
export function GroupLabel({ children }) {
  return <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{children}</p>;
}

/* ---------------------------------------------------------------- scene */

export function LegendItem({ color, label, kind = 'line' }) {
  return (
    <li className="flex items-center gap-1.5">
      <svg width="20" height="10" aria-hidden="true" className="shrink-0">
        {kind === 'dash' && <line x1="1" y1="5" x2="19" y2="5" stroke={color} strokeWidth="2" strokeDasharray="4 3" />}
        {kind === 'dot' && <circle cx="10" cy="5" r="4" fill={color} />}
        {kind === 'grid' && (
          <g stroke={color} strokeWidth="1">
            <rect x="2.5" y="0.5" width="15" height="9" fill="none" />
            <line x1="10" y1="0.5" x2="10" y2="9.5" />
            <line x1="2.5" y1="5" x2="17.5" y2="5" />
          </g>
        )}
        {(kind === 'line' || kind === 'arrow') && (
          <line x1="1" y1="5" x2={kind === 'arrow' ? 13 : 19} y2="5" stroke={color} strokeWidth="3" strokeLinecap="round" />
        )}
        {kind === 'arrow' && <path d="M19,5 L12,1 L12,9 Z" fill={color} />}
      </svg>
      <span>{label}</span>
    </li>
  );
}

/** A chip in the scene's top-right corner (time, scale…). */
export function Chip({ icon: Icon = Timer, children, color = '#0891b2', strong }) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] sm:text-[12px] font-medium tabular-nums shadow-sm ${
        strong ? 'text-white' : 'border-slate-200 bg-white/90 text-slate-600'
      }`}
      style={strong ? { background: color, borderColor: color } : undefined}
    >
      {Icon && <Icon size={14} style={{ color: strong ? '#fff' : color }} aria-hidden="true" />}
      {children}
    </span>
  );
}

/**
 * The light scene panel of the chosen design. `height(W, narrow)` sizes the
 * drawing to the measured width; `children(W, H, narrow)` draws it. The
 * legend floats over the top-left from `sm` up and moves under the scene on
 * phones, so the top ~56 px (≈40 px on phones) should stay quiet.
 */
export function LabScene({ legend = [], chips, height, ariaLabel, children, minW = 280 }) {
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, minW);
  const narrow = W < 560;
  const H = Math.round(typeof height === 'function' ? height(W, narrow) : height);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-300/70 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_30px_-12px_rgba(0,0,0,0.6)]">
      <div ref={ref} className="w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="cl-scene block select-none">
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
    </div>
  );
}

/** Faint square grid over a rectangle, lines `cell` px apart, anchored at (ax, ay). */
export function PaperGrid({ x0, y0, x1, y1, cell, ax = x0, ay = y1, color = PALETTE.grid }) {
  if (!(cell > 4)) return null;
  const lines = [];
  for (let x = ax - Math.floor((ax - x0) / cell) * cell; x <= x1 + 0.5; x += cell) {
    lines.push(<line key={`v${x.toFixed(1)}`} x1={x} x2={x} y1={y0} y2={y1} stroke={color} strokeWidth={1} />);
  }
  for (let y = ay - Math.floor((ay - y0) / cell) * cell; y <= y1 + 0.5; y += cell) {
    lines.push(<line key={`h${y.toFixed(1)}`} x1={x0} x2={x1} y1={y} y2={y} stroke={color} strokeWidth={1} />);
  }
  return <g aria-hidden="true">{lines}</g>;
}

/**
 * A force drawn from its point of application (x1, y1) to (x2, y2): a white
 * halo for contrast on busy drawings, the coloured arrow, and a dot at the tail.
 */
export function ForceArrow({ x1, y1, x2, y2, color, width = 3.5, head = 13, opacity = 1, dot = true }) {
  if (Math.hypot(x2 - x1, y2 - y1) < 3) {
    return dot ? <circle cx={x1} cy={y1} r={width * 0.9 + 1} fill={color} stroke="#fff" strokeWidth={1.5} opacity={opacity} /> : null;
  }
  return (
    <g opacity={opacity}>
      <Arrow x1={x1} y1={y1} x2={x2} y2={y2} color="#ffffff" width={width + 4} head={head + 4} />
      <Arrow x1={x1} y1={y1} x2={x2} y2={y2} color={color} width={width} head={head} />
      {dot && <circle cx={x1} cy={y1} r={width * 0.9 + 1} fill={color} stroke="#fff" strokeWidth={1.5} />}
    </g>
  );
}

/** A labelled scale bar: `px` pixels stand for the quantity in `label`. */
export function ScaleBar({ x, y, px, label, fs = 11, color = '#475569', align = 'left' }) {
  const x0 = align === 'right' ? x - px : x;
  return (
    <g aria-hidden="true">
      <line x1={x0} x2={x0 + px} y1={y} y2={y} stroke={color} strokeWidth={2} />
      <line x1={x0} x2={x0} y1={y - 5} y2={y + 5} stroke={color} strokeWidth={2} />
      <line x1={x0 + px} x2={x0 + px} y1={y - 5} y2={y + 5} stroke={color} strokeWidth={2} />
      <text x={x0 + px / 2} y={y - 8} textAnchor="middle" fontSize={fs} fontWeight="600" fill={color}>
        {label}
      </text>
    </g>
  );
}

/** A label pill that sits to one side of a point (side = -1 left, 1 right, 0 centred). */
export function SidePill({ x, y, side = 1, gap = 8, text, bg, fs = 12, box }) {
  if (!text) return null;
  const w = text.length * fs * 0.6 + 16;
  return <Pill x={side === 0 ? x : x + side * (gap + w / 2)} y={y} text={text} bg={bg} size={fs} box={box} />;
}

/**
 * A formula in the serif italic of symbols, with digits, signs and brackets
 * kept upright (the italic serif draws 0 like the letter o).
 */
export function Formula({ text }) {
  const parts = String(text).split(/([0-9.,]+|[()=+−·/²√]+)/g).filter(Boolean);
  return (
    <span className="font-serif italic">
      {parts.map((p, i) =>
        /^[0-9.,]+$|^[()=+−·/²√]+$/.test(p) ? (
          <span key={i} className="font-sans not-italic">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  );
}

/* ------------------------------------------------------------- figures */

/**
 * A person seen from the front, standing with the soles at `feetY`, `h` px
 * tall. Returns nothing but drawing; the centre of mass is at feetY − 0.55·h.
 */
export function Person({ cx, feetY, h, shirt = '#2563eb', pants = '#334155', skin = '#f1c7a3', hair = '#3b2a20', shoe = '#1e293b' }) {
  const u = h / 100;
  const headR = 6.6 * u;
  const headCy = feetY - h + headR;
  const shY = feetY - 80 * u;
  const hipY = feetY - 47 * u;
  const shW = 12.5 * u;
  const hipW = 9.2 * u;
  const arm = 4.6 * u;
  return (
    <g aria-hidden="true">
      {/* legs */}
      <path d={`M${cx - hipW},${hipY} L${cx - 0.8 * u},${hipY} L${cx - 2 * u},${feetY - 2.6 * u} L${cx - 8.2 * u},${feetY - 2.6 * u} Z`} fill={pants} />
      <path d={`M${cx + hipW},${hipY} L${cx + 0.8 * u},${hipY} L${cx + 2 * u},${feetY - 2.6 * u} L${cx + 8.2 * u},${feetY - 2.6 * u} Z`} fill={pants} />
      {/* shoes */}
      <ellipse cx={cx - 5.6 * u} cy={feetY - 1.5 * u} rx={4.8 * u} ry={1.6 * u} fill={shoe} />
      <ellipse cx={cx + 5.6 * u} cy={feetY - 1.5 * u} rx={4.8 * u} ry={1.6 * u} fill={shoe} />
      {/* arms */}
      <line x1={cx - shW + arm * 0.45} y1={shY + 3 * u} x2={cx - shW - 1.6 * u} y2={hipY + 1 * u} stroke={shirt} strokeWidth={arm} strokeLinecap="round" />
      <line x1={cx + shW - arm * 0.45} y1={shY + 3 * u} x2={cx + shW + 1.6 * u} y2={hipY + 1 * u} stroke={shirt} strokeWidth={arm} strokeLinecap="round" />
      <circle cx={cx - shW - 1.9 * u} cy={hipY + 3.2 * u} r={2.5 * u} fill={skin} />
      <circle cx={cx + shW + 1.9 * u} cy={hipY + 3.2 * u} r={2.5 * u} fill={skin} />
      {/* torso */}
      <path
        d={`M${cx - shW},${shY + 3 * u} Q${cx - shW},${shY} ${cx - shW + 3.4 * u},${shY} L${cx + shW - 3.4 * u},${shY} Q${cx + shW},${shY} ${cx + shW},${shY + 3 * u} L${cx + hipW + 0.6 * u},${hipY + 1.5 * u} L${cx - hipW - 0.6 * u},${hipY + 1.5 * u} Z`}
        fill={shirt}
      />
      <rect x={cx - hipW - 0.6 * u} y={hipY - 0.6 * u} width={2 * hipW + 1.2 * u} height={2.6 * u} rx={u} fill="#0f172a" opacity="0.55" />
      {/* neck + head */}
      <rect x={cx - 2.6 * u} y={headCy + headR - 1.5 * u} width={5.2 * u} height={shY - headCy - headR + 2.5 * u} fill={skin} />
      <circle cx={cx} cy={headCy} r={headR} fill={skin} />
      <path d={`M${cx - headR},${headCy - 0.6 * u} Q${cx - headR},${headCy - headR - 1.2 * u} ${cx},${headCy - headR - 0.9 * u} Q${cx + headR},${headCy - headR - 1.2 * u} ${cx + headR},${headCy - 0.6 * u} Q${cx + 2 * u},${headCy - 4.4 * u} ${cx - headR},${headCy - 0.6 * u} Z`} fill={hair} />
      <circle cx={cx - 2.3 * u} cy={headCy + 0.6 * u} r={0.75 * u} fill="#1e293b" />
      <circle cx={cx + 2.3 * u} cy={headCy + 0.6 * u} r={0.75 * u} fill="#1e293b" />
      <path d={`M${cx - 2 * u},${headCy + 3 * u} Q${cx},${headCy + 4.4 * u} ${cx + 2 * u},${headCy + 3 * u}`} fill="none" stroke="#9a3412" strokeWidth={0.7 * u} strokeLinecap="round" />
    </g>
  );
}

/**
 * A bathroom scale seen from the front: top plate at `topY` (pressed down by
 * `press` px), `w` wide, `h` tall, with a small lit window on the front.
 */
export function BathScale({ cx, topY, w, h, press = 0, lit = true, highlight }) {
  const y = topY + press;
  return (
    <g aria-hidden="true">
      {highlight && <rect x={cx - w / 2 - 4} y={y - 4} width={w + 8} height={h - press + 8} rx={h * 0.55} fill="none" stroke={highlight} strokeWidth={3} opacity="0.85" />}
      <rect x={cx - w / 2} y={y} width={w} height={h - press} rx={h * 0.45} fill="#e2e8f0" stroke="#64748b" strokeWidth={1.5} />
      <rect x={cx - w / 2 + 3} y={y + 1.5} width={w - 6} height={Math.max(2, (h - press) * 0.28)} rx={2} fill="#f8fafc" />
      <rect x={cx - w * 0.14} y={y + (h - press) * 0.42} width={w * 0.28} height={Math.max(3, (h - press) * 0.38)} rx={1.5} fill={lit ? '#0f172a' : '#334155'} />
      {lit && <rect x={cx - w * 0.11} y={y + (h - press) * 0.5} width={w * 0.22} height={Math.max(1.5, (h - press) * 0.18)} rx={1} fill="#4ade80" opacity="0.85" />}
    </g>
  );
}
