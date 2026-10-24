import { Pause, Play, RotateCcw, Timer } from 'lucide-react';

import { Btn, clamp, fmt, niceStep, useElementSize } from '../kit/ui';
import { PALETTE } from '../kit/scene';

/**
 * Drawing pieces shared by the straight-line kinematics labs of lessons 4–7
 * (NonUniformMotion, Acceleration, AcceleratedDisplacement, TwoBodies):
 * the scene shell of the chosen design (light lab paper, legend chips on top,
 * chips on the right, the legend under the scene on phones), Start/Pause/Reset,
 * a horizontal metre ruler, side- and top-view vehicles, a speedometer and a
 * formula tile. No words live here — every label arrives through props.
 */

/* ------------------------------------------------------------- controls */

/** Start / Pause / Resume / Again + Reset, in the reference's size. */
export function PlayControls({ labels, running, done, started, onToggle, onReset, className = '' }) {
  return (
    <div className={`grid grid-cols-2 gap-2 xl:flex ${className}`}>
      <Btn variant="primary" icon={running ? Pause : Play} onClick={onToggle} className="xl:min-w-[148px] min-h-[52px] text-[15px]">
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
        {kind === 'ring' && <circle cx="10" cy="5" r="3.5" fill="#fff" stroke={color} strokeWidth="2" />}
        {(kind === 'line' || kind === 'arrow') && (
          <line x1="1" y1="5" x2={kind === 'arrow' ? 13 : 19} y2="5" stroke={color} strokeWidth="3" strokeLinecap="round" />
        )}
        {kind === 'arrow' && <path d="M19,5 L12,1 L12,9 Z" fill={color} />}
        {kind === 'box' && <rect x="3" y="1" width="14" height="8" rx="2" fill={color} />}
      </svg>
      <span>{label}</span>
    </li>
  );
}

/** A chip in the scene's top-right corner (time speed-up, frame, clock…). */
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
 * drawing to the measured width; `children(W, H, narrow)` draws it.
 * The legend floats over the top-left from `sm` up and moves under the
 * scene on phones, so the top ~50 px (≈34 px on phones) should stay quiet.
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

/** A 1D view: world metres [x0, x1] → [padL, W − padR] pixels. */
export function lineView(x0, x1, W, padL, padR) {
  const k = (W - padL - padR) / Math.max(1e-9, x1 - x0);
  return { k, x0, x1, sx: (x) => padL + (x - x0) * k, wx: (px) => x0 + (px - padL) / k };
}

/** Faint lab-paper grid over a rectangle; vertical lines follow the ruler step. */
export function PaperGrid({ view, W, top, bottom, step, rowPx = 28 }) {
  const lines = [];
  const first = Math.ceil(view.wx(0) / step) * step;
  for (let x = first; x <= view.wx(W); x += step) {
    const px = view.sx(x);
    lines.push(<line key={`v${x.toFixed(3)}`} x1={px} x2={px} y1={top} y2={bottom} stroke={PALETTE.grid} strokeWidth={1} />);
  }
  for (let y = bottom; y >= top; y -= rowPx) {
    lines.push(<line key={`h${y}`} x1={0} x2={W} y1={y} y2={y} stroke={PALETTE.grid} strokeWidth={1} />);
  }
  return <g aria-hidden="true">{lines}</g>;
}

/**
 * A metre ruler along y: ticks every `step`, numbers every `labelEvery`
 * steps, the unit at the right end. Returns nothing outside [0, W].
 */
export function Ruler({ view, W, y, step, labelEvery = 1, unit, decimal = '.', digits = 0, color = '#475569', fs = 11, scale = 1, minorDiv = 0, reserveL = 0, reserveR = 0 }) {
  const items = [];
  const first = Math.ceil(view.wx(0) / step) * step;
  const unitW = Math.max(reserveR, unit ? unit.length * fs * 0.62 + 14 : 0);
  for (let x = first; x <= view.wx(W); x += step) {
    const i = Math.round(x / step);
    const px = view.sx(x);
    const major = i % labelEvery === 0;
    items.push(<line key={`t${i}`} x1={px} x2={px} y1={y} y2={y + (major ? 8 : 5)} stroke={color} strokeOpacity={major ? 0.9 : 0.5} strokeWidth={major ? 1.4 : 1} />);
    if (minorDiv > 1) {
      for (let m = 1; m < minorDiv; m += 1) {
        const mx = view.sx(x + (m * step) / minorDiv);
        if (mx < W) items.push(<line key={`m${i}-${m}`} x1={mx} x2={mx} y1={y} y2={y + 3} stroke={color} strokeOpacity={0.35} strokeWidth={1} />);
      }
    }
    if (major && px > 8 + reserveL && px < W - unitW - 6) {
      items.push(
        <text key={`l${i}`} x={px} y={y + 20} textAnchor="middle" fontSize={fs} fill={color} fontWeight={Math.abs(x) < 1e-9 ? 700 : 500}>
          {num(x * scale, digits, decimal)}
        </text>,
      );
    }
  }
  return (
    <g aria-hidden="true">
      <line x1={0} x2={W} y1={y} y2={y} stroke={color} strokeWidth={1.4} />
      {items}
      {unit && (
        <text x={W - 8} y={y + 20} textAnchor="end" fontSize={fs} fontWeight="700" fill={color}>
          {unit}
        </text>
      )}
    </g>
  );
}

/** Picks the ruler step for a view so labels sit at least `minPx` apart. */
export function rulerStep(view, minPx = 64) {
  return niceStep(view.k, minPx);
}

const SUBS = { '₀': '0', '₁': '1', '₂': '2' };

/**
 * Renders subscript digits (v₀, x₀₁) as real <sub> elements: the serif
 * italic used for symbols has no glyph for ₀ and draws it like an "o".
 */
export function Rich({ children }) {
  if (typeof children !== 'string') return children ?? null;
  const parts = [];
  let buf = '';
  let run = '';
  const flushSub = () => {
    if (run) parts.push(<sub key={parts.length} className="text-[0.72em] not-italic">{run}</sub>);
    run = '';
  };
  let digits = '';
  const flushDigits = () => {
    if (digits) parts.push(<span key={parts.length} className="font-sans not-italic">{digits}</span>);
    digits = '';
  };
  const flushBuf = () => {
    if (buf) parts.push(buf);
    buf = '';
  };
  for (const ch of children) {
    if (SUBS[ch]) {
      flushBuf();
      flushDigits();
      run += SUBS[ch];
    } else if (/[0-9]/.test(ch) || (digits && /[.,]/.test(ch))) {
      flushSub();
      flushBuf();
      digits += ch;
    } else {
      flushSub();
      flushDigits();
      buf += ch;
    }
  }
  flushSub();
  flushDigits();
  flushBuf();
  return <>{parts}</>;
}

/** fmt with a true minus sign. */
export function num(n, digits = 1, decimal = '.') {
  return fmt(n, digits, decimal).replace('-', '−');
}

/** Trims to at most `max` decimals: 25 → "25", 137.5 → "137.5", 33.333 → "33.33". */
export function trim(n, decimal = '.', max = 2) {
  for (let k = 0; k <= max; k += 1) if (Math.abs(n * 10 ** k - Math.round(n * 10 ** k)) < 1e-9) return num(n, k, decimal);
  return num(n, max, decimal);
}

/** fmt with an explicit sign: +2.5, −1.5, 0.0. */
export function signed(n, digits = 1, decimal = '.') {
  const s = num(n, digits, decimal);
  return n >= 0.5 * 10 ** -digits ? `+${s}` : s;
}

const NICE = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** A "nice" axis maximum ≥ v that splits into `parts` round steps (…, 15, 20, 25, 30, 40, 50, 60, 80, …). */
export function niceMax(v, parts = 4) {
  const raw = Math.max(v, 1e-6) / parts;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = NICE.find((k) => k * p >= raw - 1e-12) ?? 10;
  return m * p * parts;
}

/** Decimals needed to print the ticks of an axis 0…max split into `parts`. */
export function tickDigits(max, parts = 4) {
  const step = max / parts;
  for (let k = 0; k <= 3; k += 1) if (Math.abs(step * 10 ** k - Math.round(step * 10 ** k)) < 1e-6) return k;
  return 3;
}

function hash01(i) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Side view of a straight road on lab paper: faint grid above, trees on the
 * far verge (attached to the ground, so they show motion), the asphalt band
 * centred on `roadY` and a metre ruler under it. Vehicles stand on roadY + 4.
 */
export function SideRoad({ view, W, H, roadY, step, unit, decimal = '.', fs = 11, scale = 1, digits = 0, trees = true, minorDiv = 0, reserveL = 0, reserveR = 0 }) {
  const roadTop = roadY - 10;
  const roadBot = roadY + 10;
  const items = [];
  if (trees) {
    const treeStep = niceStep(view.k, 86);
    const first = Math.floor(view.wx(-40) / treeStep);
    const last = Math.ceil(view.wx(W + 40) / treeStep);
    for (let i = first; i <= last; i += 1) {
      const x = view.sx((i + 0.25 + hash01(i) * 0.5) * treeStep);
      const h = 34 + hash01(i + 9) * 18;
      items.push(<Tree key={`tr${i}`} x={x} y={roadTop + 1} h={h} tone={hash01(i + 3)} />);
    }
  }
  return (
    <g aria-hidden="true">
      <rect width={W} height={H} fill="#fbfcfe" />
      <PaperGrid view={view} W={W} top={0} bottom={roadTop} step={step} />
      {items}
      <rect x={0} y={roadTop} width={W} height={roadBot - roadTop} fill="#e2e8f0" />
      <line x1={0} x2={W} y1={roadTop} y2={roadTop} stroke="#94a3b8" strokeWidth={1.2} />
      <line x1={0} x2={W} y1={roadBot} y2={roadBot} stroke="#64748b" strokeWidth={1.6} />
      <line x1={0} x2={W} y1={roadY - 2} y2={roadY - 2} stroke="#fff" strokeWidth={2} strokeDasharray="12 12" />
      <rect x={0} y={roadBot + 1} width={W} height={H - roadBot} fill="#f8fafc" />
      <Ruler view={view} W={W} y={roadBot + 6} step={step} unit={unit} decimal={decimal} fs={fs} scale={scale} digits={digits} minorDiv={minorDiv} reserveL={reserveL} reserveR={reserveR} />
    </g>
  );
}

/**
 * Stroboscope marks left on a side-view road at every whole second: a ring
 * on the road, a thin pin up to a faint velocity arrow (two alternating rows
 * so neighbours do not collide) and the time label. `marks` = [{ n, px, v }]
 * with v in m/s (signed along the screen's x), `vk` px per m/s.
 */
export function StrobeMarks({ marks, roadY, rowY, vk, label, color = PALETTE.vel, labelColor = '#047857', highlight, fs = 10, arrows = true }) {
  const last = [-1e9, -1e9];
  return (
    <g aria-hidden="true">
      {marks.map((m) => {
        const row = m.n % 2;
        const ay = rowY - row * 15;
        const showLabel = m.px - last[row] >= 26;
        if (showLabel) last[row] = m.px;
        const hl = highlight === m.n;
        const len = m.v * vk;
        return (
          <g key={m.n}>
            <line x1={m.px} x2={m.px} y1={ay + 2} y2={roadY - 3} stroke={hl ? '#7c3aed' : color} strokeOpacity={hl ? 0.8 : 0.35} strokeWidth={1} strokeDasharray="2 3" />
            <circle cx={m.px} cy={roadY - 2} r={hl ? 4.5 : 3.5} fill="#fff" stroke={hl ? '#7c3aed' : color} strokeWidth={2} />
            {arrows && Math.abs(len) > 4 && (
              <g opacity={hl ? 0.95 : 0.5}>
                <line x1={m.px} x2={m.px + len - Math.sign(len) * 5} y1={ay} y2={ay} stroke={color} strokeWidth={2} strokeLinecap="round" />
                <path d={`M${m.px + len},${ay} L${m.px + len - Math.sign(len) * 6},${ay - 3.5} L${m.px + len - Math.sign(len) * 6},${ay + 3.5} Z`} fill={color} />
              </g>
            )}
            {showLabel && (
              <text x={m.px} y={ay - 5} textAnchor="middle" fontSize={fs} fontWeight={hl ? 800 : 600} fill={hl ? '#6d28d9' : labelColor} stroke="#fbfcfe" strokeWidth={3} paintOrder="stroke">
                {label(m.n)}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

/* -------------------------------------------------------------- vehicles */

function Wheel({ cx, cy, r, rot }) {
  return (
    <g transform={`translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${rot.toFixed(1)})`}>
      <circle r={r} fill="#1e293b" />
      <circle r={r * 0.55} fill="#cbd5e1" />
      <line x1={-r * 0.5} x2={r * 0.5} y1={0} y2={0} stroke="#475569" strokeWidth={Math.max(1, r * 0.16)} />
      <line y1={-r * 0.5} y2={r * 0.5} x1={0} x2={0} stroke="#475569" strokeWidth={Math.max(1, r * 0.16)} />
      <circle r={r * 0.16} fill="#334155" />
    </g>
  );
}

/**
 * Side view of a car on a road whose surface is at y. `front` is the px
 * position of the front bumper; `dir` = 1 faces right, −1 faces left.
 * `dist` (metres travelled) turns the wheels; `braking` lights the brake lamps.
 */
export function SideCar({ front, y, len = 64, color = '#2563eb', dir = 1, dist = 0, braking = false, ghost = false }) {
  const L = len;
  const r = L * 0.115;
  const rot = ((dist / (2 * Math.PI * 0.32)) * 360) % 360;
  const body = `M${L * 0.02},${-r * 0.55} L${L * 0.02},${-L * 0.25} Q${L * 0.03},${-L * 0.29} ${L * 0.09},${-L * 0.29} L${L * 0.24},${-L * 0.29}
    L${L * 0.36},${-L * 0.46} Q${L * 0.38},${-L * 0.48} ${L * 0.42},${-L * 0.48} L${L * 0.66},${-L * 0.48} Q${L * 0.7},${-L * 0.48} ${L * 0.72},${-L * 0.45}
    L${L * 0.82},${-L * 0.3} L${L * 0.94},${-L * 0.27} Q${L},${-L * 0.25} ${L},${-L * 0.18} L${L},${-r * 0.55} Z`;
  const rear = dir > 0 ? front - L : front + L;
  return (
    <g transform={`translate(${rear.toFixed(1)} ${y.toFixed(1)}) scale(${dir} 1)`} opacity={ghost ? 0.28 : 1}>
      <ellipse cx={L * 0.5} cy={0.5} rx={L * 0.5} ry={Math.max(1.5, r * 0.25)} fill="#0f172a" opacity="0.18" />
      <path d={body} fill={color} stroke="#0f172a" strokeOpacity="0.55" strokeWidth={1.2} strokeLinejoin="round" />
      <path
        d={`M${L * 0.29},${-L * 0.3} L${L * 0.385},${-L * 0.435} L${L * 0.52},${-L * 0.435} L${L * 0.52},${-L * 0.3} Z M${L * 0.555},${-L * 0.3} L${L * 0.555},${-L * 0.435} L${L * 0.655},${-L * 0.435} L${L * 0.75},${-L * 0.3} Z`}
        fill="#e0f2fe"
        stroke="#0f172a"
        strokeOpacity="0.35"
        strokeWidth={0.8}
      />
      <rect x={L * 0.93} y={-L * 0.235} width={L * 0.06} height={L * 0.05} rx={1.5} fill="#fde68a" />
      <rect x={L * 0.015} y={-L * 0.24} width={L * 0.045} height={L * 0.06} rx={1.5} fill={braking ? '#ef4444' : '#991b1b'} />
      {braking && <circle cx={L * 0.0} cy={-L * 0.21} r={L * 0.07} fill="#ef4444" opacity="0.35" />}
      <line x1={L * 0.06} x2={L * 0.94} y1={-L * 0.19} y2={-L * 0.19} stroke="#fff" strokeOpacity="0.35" strokeWidth={1} />
      <Wheel cx={L * 0.21} cy={-r} r={r} rot={rot} />
      <Wheel cx={L * 0.79} cy={-r} r={r} rot={rot} />
    </g>
  );
}

/** Side view of a city bus; `front` is the front bumper in px, facing right. */
export function SideBus({ front, y, len = 110, color = '#0d9488', dist = 0, braking = false, doorsOpen = false }) {
  const L = len;
  const H = L * 0.3;
  const r = L * 0.06;
  const rot = ((dist / (2 * Math.PI * 0.5)) * 360) % 360;
  const rear = front - L;
  const winY = -H + H * 0.14;
  const winH = H * 0.38;
  const wins = [];
  for (let i = 0; i < 5; i += 1) {
    const wx = L * (0.05 + i * 0.152);
    if (i === 3) continue;
    wins.push(<rect key={i} x={wx} y={winY} width={L * 0.13} height={winH} rx={2} fill="#e0f2fe" stroke="#0f172a" strokeOpacity="0.3" strokeWidth={0.8} />);
  }
  return (
    <g transform={`translate(${rear.toFixed(1)} ${y.toFixed(1)})`}>
      <ellipse cx={L * 0.5} cy={0.5} rx={L * 0.5} ry={Math.max(1.5, r * 0.3)} fill="#0f172a" opacity="0.18" />
      <rect x={0} y={-H} width={L} height={H - r * 0.4} rx={Math.min(8, L * 0.05)} fill={color} stroke="#0f172a" strokeOpacity="0.5" strokeWidth={1.2} />
      <rect x={0} y={-H} width={L} height={H * 0.08} rx={3} fill="#fff" opacity="0.35" />
      {wins}
      <path d={`M${L * 0.86},${winY} L${L * 0.985},${winY} L${L * 0.995},${winY + winH * 1.25} L${L * 0.86},${winY + winH * 1.25} Z`} fill="#e0f2fe" stroke="#0f172a" strokeOpacity="0.3" strokeWidth={0.8} />
      {/* door */}
      <rect x={L * 0.508} y={winY} width={L * 0.12} height={H * 0.8} rx={2} fill={doorsOpen ? '#0f172a' : '#ccfbf1'} stroke="#0f172a" strokeOpacity="0.35" strokeWidth={0.8} />
      {!doorsOpen && <line x1={L * 0.568} x2={L * 0.568} y1={winY} y2={winY + H * 0.8} stroke="#0f172a" strokeOpacity="0.35" strokeWidth={0.8} />}
      <rect x={L * 0.97} y={-H * 0.3} width={L * 0.03} height={H * 0.1} rx={1} fill="#fde68a" />
      <rect x={0} y={-H * 0.32} width={L * 0.025} height={H * 0.12} rx={1} fill={braking ? '#ef4444' : '#991b1b'} />
      {braking && <circle cx={0} cy={-H * 0.26} r={H * 0.18} fill="#ef4444" opacity="0.35" />}
      <Wheel cx={L * 0.17} cy={-r} r={r} rot={rot} />
      <Wheel cx={L * 0.8} cy={-r} r={r} rot={rot} />
    </g>
  );
}

/** Side view of a cyclist; `x` is the contact point of the front wheel… centre of the bike, px. */
export function SideCyclist({ x, y, size = 46, color = '#2563eb', dir = 1, dist = 0 }) {
  const s = size;
  const r = s * 0.22;
  const rot = ((dist / (2 * Math.PI * 0.34)) * 360) % 360;
  const pedal = (rot * Math.PI) / 180;
  const crank = { x: 0, y: -r };
  const foot = { x: crank.x + Math.cos(pedal) * r * 0.42, y: crank.y + Math.sin(pedal) * r * 0.42 };
  const seat = { x: -s * 0.12, y: -r - s * 0.42 };
  const bar = { x: s * 0.2, y: -r - s * 0.46 };
  const hip = { x: seat.x, y: seat.y - s * 0.04 };
  const shoulder = { x: s * 0.06, y: -r - s * 0.78 };
  const knee = { x: (hip.x + foot.x) / 2 + s * 0.12, y: (hip.y + foot.y) / 2 - s * 0.05 };
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${dir} 1)`}>
      <ellipse cx={0} cy={0.5} rx={s * 0.55} ry={2} fill="#0f172a" opacity="0.15" />
      {[-s * 0.34, s * 0.34].map((cx) => (
        <g key={cx} transform={`translate(${cx} ${-r}) rotate(${rot})`}>
          <circle r={r} fill="none" stroke="#1e293b" strokeWidth={Math.max(1.6, s * 0.045)} />
          <line x1={-r} x2={r} y1={0} y2={0} stroke="#94a3b8" strokeWidth={0.8} />
          <line y1={-r} y2={r} x1={0} x2={0} stroke="#94a3b8" strokeWidth={0.8} />
        </g>
      ))}
      <path
        d={`M${-s * 0.34},${-r} L${crank.x},${crank.y} L${seat.x},${seat.y} M${crank.x},${crank.y} L${bar.x - s * 0.03},${bar.y + s * 0.04} L${s * 0.34},${-r} M${-s * 0.34},${-r} L${seat.x + s * 0.03},${seat.y + s * 0.06} L${bar.x - s * 0.03},${bar.y + s * 0.04}`}
        fill="none"
        stroke={color}
        strokeWidth={Math.max(1.8, s * 0.05)}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <g stroke="#0f172a" strokeWidth={Math.max(2, s * 0.07)} strokeLinecap="round" fill="none">
        <path d={`M${hip.x},${hip.y} L${knee.x},${knee.y} L${foot.x},${foot.y}`} strokeLinejoin="round" />
        <path d={`M${hip.x},${hip.y} L${shoulder.x},${shoulder.y} L${bar.x},${bar.y}`} strokeLinejoin="round" />
      </g>
      <circle cx={shoulder.x + s * 0.07} cy={shoulder.y - s * 0.13} r={s * 0.1} fill={color} stroke="#0f172a" strokeWidth={1} />
    </g>
  );
}

/** Top view of a car (centre at x, y; length/width in px; facing right). */
export function TopCar({ x, y, len = 44, wid = 20, color = '#2563eb', braking = false, dir = 1 }) {
  const L = len;
  const Wd = wid;
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${dir} 1)`}>
      <rect x={-L / 2 + 1.5} y={-Wd / 2 + 2} width={L} height={Wd} rx={Wd * 0.3} fill="#0f172a" opacity="0.18" />
      <rect x={-L / 2} y={-Wd / 2} width={L} height={Wd} rx={Wd * 0.3} fill={color} stroke="#0f172a" strokeOpacity="0.55" strokeWidth={1.1} />
      <path d={`M${L * 0.1},${-Wd * 0.38} L${L * 0.24},${-Wd * 0.32} L${L * 0.24},${Wd * 0.32} L${L * 0.1},${Wd * 0.38} Z`} fill="#e0f2fe" opacity="0.95" />
      <path d={`M${-L * 0.3},${-Wd * 0.34} L${-L * 0.2},${-Wd * 0.3} L${-L * 0.2},${Wd * 0.3} L${-L * 0.3},${Wd * 0.34} Z`} fill="#e0f2fe" opacity="0.8" />
      <rect x={-L * 0.2} y={-Wd * 0.34} width={L * 0.3} height={Wd * 0.68} rx={2} fill="#fff" opacity="0.18" />
      <rect x={L / 2 - 3} y={-Wd / 2 + 2} width={2.5} height={Wd * 0.22} rx={1} fill="#fde68a" />
      <rect x={L / 2 - 3} y={Wd / 2 - 2 - Wd * 0.22} width={2.5} height={Wd * 0.22} rx={1} fill="#fde68a" />
      <rect x={-L / 2 + 0.5} y={-Wd / 2 + 2} width={2.5} height={Wd * 0.22} rx={1} fill={braking ? '#ef4444' : '#991b1b'} />
      <rect x={-L / 2 + 0.5} y={Wd / 2 - 2 - Wd * 0.22} width={2.5} height={Wd * 0.22} rx={1} fill={braking ? '#ef4444' : '#991b1b'} />
      {braking && (
        <>
          <circle cx={-L / 2} cy={-Wd * 0.3} r={Wd * 0.28} fill="#ef4444" opacity="0.3" />
          <circle cx={-L / 2} cy={Wd * 0.3} r={Wd * 0.28} fill="#ef4444" opacity="0.3" />
        </>
      )}
    </g>
  );
}

/** Top view of a lorry (centre at x, y; facing right). */
export function TopLorry({ x, y, len = 120, wid = 26, color = '#d97706' }) {
  const L = len;
  const Wd = wid;
  const cab = Math.min(L * 0.2, Wd * 1.1);
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
      <rect x={-L / 2 + 2} y={-Wd / 2 + 2} width={L} height={Wd} rx={3} fill="#0f172a" opacity="0.18" />
      <rect x={-L / 2} y={-Wd / 2} width={L - cab - 2} height={Wd} rx={3} fill="#f1f5f9" stroke="#0f172a" strokeOpacity="0.55" strokeWidth={1.1} />
      {Array.from({ length: 5 }, (_, i) => (
        <line key={i} x1={-L / 2 + ((i + 1) * (L - cab - 2)) / 6} x2={-L / 2 + ((i + 1) * (L - cab - 2)) / 6} y1={-Wd / 2 + 2} y2={Wd / 2 - 2} stroke="#cbd5e1" strokeWidth={1} />
      ))}
      <rect x={L / 2 - cab} y={-Wd / 2 + 1} width={cab} height={Wd - 2} rx={Wd * 0.22} fill={color} stroke="#0f172a" strokeOpacity="0.55" strokeWidth={1.1} />
      <path d={`M${L / 2 - cab * 0.42},${-Wd * 0.36} L${L / 2 - cab * 0.16},${-Wd * 0.3} L${L / 2 - cab * 0.16},${Wd * 0.3} L${L / 2 - cab * 0.42},${Wd * 0.36} Z`} fill="#e0f2fe" />
    </g>
  );
}

/* ------------------------------------------------------------ scenery */

/** A roadside tree (side view) standing on y. */
export function Tree({ x, y, h = 40, tone = 0 }) {
  const crown = tone > 0.5 ? '#bbf7d0' : '#a7f3d0';
  return (
    <g aria-hidden="true">
      <rect x={x - h * 0.04} y={y - h * 0.45} width={h * 0.08} height={h * 0.45} fill="#a8a29e" />
      <ellipse cx={x} cy={y - h * 0.62} rx={h * 0.26} ry={h * 0.34} fill={crown} stroke="#86efac" strokeWidth={1} />
    </g>
  );
}

/** A traffic light on a pole; `state` = 'red' | 'yellow' | 'green'. */
export function TrafficLight({ x, y, h = 70, state = 'red' }) {
  const box = { w: h * 0.2, h: h * 0.5 };
  const top = y - h;
  const lamp = (i, on, color) => <circle key={i} cx={x} cy={top + box.h * (0.2 + i * 0.3)} r={box.w * 0.3} fill={on ? color : '#334155'} stroke="#0f172a" strokeWidth={0.8} />;
  return (
    <g aria-hidden="true">
      <rect x={x - 1.5} y={top + box.h} width={3} height={h - box.h} fill="#64748b" />
      <rect x={x - box.w / 2} y={top} width={box.w} height={box.h} rx={4} fill="#1e293b" />
      {lamp(0, state === 'red', '#ef4444')}
      {lamp(1, state === 'yellow', '#f59e0b')}
      {lamp(2, state === 'green', '#22c55e')}
      {state !== 'off' && (
        <circle
          cx={x}
          cy={top + box.h * (state === 'red' ? 0.2 : state === 'yellow' ? 0.5 : 0.8)}
          r={box.w * 0.55}
          fill={state === 'red' ? '#ef4444' : state === 'yellow' ? '#f59e0b' : '#22c55e'}
          opacity="0.25"
        />
      )}
    </g>
  );
}

/** A bus-stop sign standing on y. */
export function BusStopSign({ x, y, h = 56, label }) {
  return (
    <g aria-hidden="true">
      <rect x={x - 1.5} y={y - h} width={3} height={h} fill="#64748b" />
      <rect x={x - h * 0.18} y={y - h - h * 0.02} width={h * 0.36} height={h * 0.36} rx={4} fill="#2563eb" />
      <text x={x} y={y - h + h * 0.24} textAnchor="middle" fontSize={h * 0.24} fontWeight="800" fill="#fff">
        {label}
      </text>
    </g>
  );
}

/* ---------------------------------------------------------- instruments */

/**
 * A car speedometer: 240° dial from 0 to `max`, ticks every `minor`, numbers
 * every `major`. The needle shows the instantaneous value; an optional
 * violet marker on the rim shows a second value (e.g. the average).
 */
export function Speedometer({ value, max, minor = 10, major = 20, unit, mark, size = 180, decimal = '.', ariaLabel }) {
  const W = size;
  const H = size * 0.9;
  const cx = W / 2;
  const cy = size * 0.52;
  const R = size * 0.43;
  const a0 = (210 * Math.PI) / 180;
  const sweep = (240 * Math.PI) / 180;
  const ang = (v) => a0 - (clamp(v, 0, max) / max) * sweep;
  const P = (a, r) => [cx + Math.cos(a) * r, cy - Math.sin(a) * r];
  const ticks = [];
  for (let v = 0; v <= max + 1e-9; v += minor) {
    const isMajor = Math.abs(v / major - Math.round(v / major)) < 1e-6;
    const [x1, y1] = P(ang(v), R);
    const [x2, y2] = P(ang(v), R - (isMajor ? size * 0.07 : size * 0.04));
    ticks.push(<line key={`k${v}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={isMajor ? '#e2e8f0' : '#64748b'} strokeWidth={isMajor ? 2 : 1.2} />);
    if (isMajor) {
      const [tx, ty] = P(ang(v), R - size * 0.14);
      ticks.push(
        <text key={`n${v}`} x={tx} y={ty + 4} textAnchor="middle" fontSize={size * 0.065} fill="#94a3b8">
          {fmt(v, 0)}
        </text>,
      );
    }
  }
  const arc = (v0, v1, r) => {
    const [x1, y1] = P(ang(v0), r);
    const [x2, y2] = P(ang(v1), r);
    const large = ((v1 - v0) / max) * 240 > 180 ? 1 : 0;
    return `M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2}`;
  };
  const [nx, ny] = P(ang(value), R - size * 0.06);
  const [bx1, by1] = P(ang(value) + Math.PI / 2, size * 0.025);
  const [bx2, by2] = P(ang(value) - Math.PI / 2, size * 0.025);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="block w-full max-w-[200px] mx-auto">
      <path d={arc(0, max, R + 3)} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={size * 0.035} strokeLinecap="round" />
      {value > 0.01 && <path d={arc(0, Math.min(value, max), R + 3)} fill="none" stroke={PALETTE.vel} strokeWidth={size * 0.035} strokeLinecap="round" />}
      {ticks}
      {mark !== undefined && mark > 0.01 && (
        <g>
          {(() => {
            const [mx, my] = P(ang(mark), R + 3 + size * 0.045);
            const [lx, ly] = P(ang(mark) + 0.06, R + 3 + size * 0.1);
            const [rx, ry] = P(ang(mark) - 0.06, R + 3 + size * 0.1);
            return <path d={`M${mx},${my} L${lx},${ly} L${rx},${ry} Z`} fill="#a78bfa" />;
          })()}
        </g>
      )}
      <path d={`M${nx},${ny} L${bx1},${by1} L${bx2},${by2} Z`} fill="#f8fafc" />
      <circle cx={cx} cy={cy} r={size * 0.045} fill="#f8fafc" stroke="#0b0b16" strokeWidth={2} />
      <text x={cx} y={cy + size * 0.3} textAnchor="middle" fontSize={size * 0.14} fontWeight="700" fill={PALETTE.velText} className="tabular-nums">
        {fmt(value, 0, decimal)}
      </text>
      <text x={cx} y={cy + size * 0.38} textAnchor="middle" fontSize={size * 0.065} fill="#94a3b8">
        {unit}
      </text>
    </svg>
  );
}

/**
 * A formula with its numbers put in: a coloured tag, the general form, the
 * substituted line and the result. `ok` adds a green check style.
 */
export function FormulaTile({ tag, color = '#22d3ee', general, filled, result, ok, dim }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 transition-colors ${ok ? 'bg-emerald-400/[0.06]' : 'bg-black/25'} ${dim ? 'opacity-50' : ''}`}
      style={{ borderColor: ok ? 'rgba(52,211,153,0.45)' : 'rgba(255,255,255,0.08)' }}
    >
      {tag && (
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden="true" />
          {tag}
        </p>
      )}
      <p className="mt-1 font-serif text-[15px] italic text-gray-200">
        <Rich>{general}</Rich>
      </p>
      {filled && <p className="mt-0.5 text-[13px] tabular-nums text-gray-400">{filled}</p>}
      {result && <p className="mt-1 text-lg font-bold tabular-nums text-white">{result}</p>}
    </div>
  );
}
