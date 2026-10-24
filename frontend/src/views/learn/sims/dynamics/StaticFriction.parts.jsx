import { Disc, Pause, Play, RotateCcw, Snowflake, Timer, TreePine } from 'lucide-react';

import { Arrow, Btn, clamp, fmt, niceStep, textWidth, useElementSize } from '../kit/ui';

/**
 * Drawing pieces of the "Ishqalanish kuchi. Tinchlikdagi ishqalanish" lab:
 * the scene shell of the chosen design (light lab paper, legend on top,
 * chips on the right, legend under the scene on phones), Start/Pause/Reset,
 * a force-scale chip, an x–y graph for the dark panel, and the materials
 * (wood, rubber, ice…) the surfaces are drawn with. No words live here —
 * every label arrives through props.
 */

/** Colours of the forces in every tab (kept in the legends). */
export const FC = {
  pull: '#2563eb', // tortish kuchi F
  pullText: '#93c5fd',
  pullLine: '#60a5fa',
  fric: '#dc2626', // ishqalanish kuchi
  fricText: '#fca5a5',
  fricLine: '#f87171',
  normal: '#0d9488', // tayanchning reaksiya kuchi N
  normalText: '#5eead4',
  weight: '#7c3aed', // og'irlik kuchi mg
  weightText: '#c4b5fd',
  weightLine: '#a78bfa',
  ink: '#0f172a',
  muted: '#64748b',
};

export const G = 9.8;

/**
 * Surface pairs of the box and incline tabs: coefficients of static (μ₀) and
 * sliding (μ) friction, school-table values (μ < μ₀ always).
 */
export const PAIRS = {
  wood: { mu0: 0.5, mu: 0.4, floor: 'wood', foot: null, icon: TreePine },
  rubber: { mu0: 0.8, mu: 0.6, floor: 'asphalt', foot: 'rubber', icon: Disc },
  steel: { mu0: 0.05, mu: 0.02, floor: 'ice', foot: 'steel', icon: Snowflake },
};

/* ------------------------------------------------------------- controls */

/** Start / Pause / Resume / Again + Reset, in the reference's size. */
export function PlayControls({ labels, running, done, started, onToggle, onReset, startLabel, disabled, className = '' }) {
  return (
    <div className={`grid grid-cols-2 gap-2 xl:flex ${className}`}>
      <Btn variant="primary" icon={running ? Pause : Play} onClick={onToggle} disabled={disabled} className="xl:min-w-[156px] min-h-[52px] text-[15px]">
        {running ? labels.pause : done ? labels.again : started ? labels.resume : startLabel ?? labels.start}
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
        {(kind === 'line' || kind === 'arrow') && <line x1="1" y1="5" x2={kind === 'arrow' ? 13 : 19} y2="5" stroke={color} strokeWidth="3" strokeLinecap="round" />}
        {kind === 'arrow' && <path d="M19,5 L12,1 L12,9 Z" fill={color} />}
        {kind === 'darrow' && (
          <>
            <line x1="1" y1="5" x2="13" y2="5" stroke={color} strokeWidth="2" strokeDasharray="3 2" />
            <path d="M19,5 L12,1 L12,9 Z" fill={color} />
          </>
        )}
      </svg>
      <span>{label}</span>
    </li>
  );
}

/** A chip in the scene's top-right corner (time, force scale…). */
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

/** Chip content: a bar `px` long and what it stands for ("= 20 N"). */
export function ScaleBar({ px, text, color = '#334155' }) {
  const w = Math.max(8, Math.round(px));
  return (
    <span className="flex items-center gap-1.5">
      <svg width={w + 2} height="10" aria-hidden="true">
        <line x1="1" y1="5" x2={w + 1} y2="5" stroke={color} strokeWidth="3" strokeLinecap="round" />
        <line x1="1" y1="1" x2="1" y2="9" stroke={color} strokeWidth="1.5" />
        <line x1={w + 1} y1="1" x2={w + 1} y2="9" stroke={color} strokeWidth="1.5" />
      </svg>
      {text}
    </span>
  );
}

/** A round force value (1, 2, 5 × 10ⁿ newtons) drawn at least `minPx` long at `k` px per newton. */
export function forceUnit(k, minPx = 30) {
  return niceStep(k, minPx);
}

/**
 * The light scene panel of the chosen design. `height(W, narrow)` sizes the
 * drawing to the measured width; `children(W, H, narrow)` draws it; `chips`
 * (a node, or `(W, H, narrow) => node`) sit in the top-right corner.
 * The legend floats over the top-left from `sm` up and moves under the
 * scene on phones, so the top ~50 px (≈36 px on phones) should stay quiet.
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
          <ul className="hidden sm:flex max-w-[70%] flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-[12px] text-slate-600 shadow-sm backdrop-blur">
            {legend.map((l) => (
              <LegendItem key={l.label} {...l} />
            ))}
          </ul>
        )}
        {chips && width > 0 && <div className="ml-auto flex flex-col items-end gap-1.5">{typeof chips === 'function' ? chips(W, H, narrow) : chips}</div>}
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

/** Faint lab-paper grid over the rectangle [0, W] × [top, bottom]. */
export function PaperGrid({ W, top, bottom, step = 28, x0 = 0 }) {
  const lines = [];
  for (let x = x0 % step; x <= W; x += step) lines.push(<line key={`v${x}`} x1={x} x2={x} y1={top} y2={bottom} stroke="#e2e8f0" strokeWidth={1} />);
  for (let y = bottom; y >= top; y -= step) lines.push(<line key={`h${y}`} x1={0} x2={W} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} />);
  return <g aria-hidden="true">{lines}</g>;
}

/* ------------------------------------------------------------ numbers */

const SUBS = { '₀': '0', '₁': '1', '₂': '2' };

/**
 * Renders subscript digits (μ₀, v₀) as real <sub> elements: the serif
 * italic used for symbols has no glyph for ₀ and draws it like an "o".
 * Text after "_" up to a space is set as a subscript too (F_ishq).
 */
export function Rich({ children }) {
  if (typeof children !== 'string') return children ?? null;
  const parts = [];
  let buf = '';
  let sub = '';
  let inSub = false;
  const flushBuf = () => {
    if (buf) parts.push(buf);
    buf = '';
  };
  const flushSub = () => {
    if (sub) parts.push(<sub key={parts.length} className="text-[0.72em] not-italic">{sub}</sub>);
    sub = '';
  };
  for (const ch of children) {
    if (ch === '_') {
      flushBuf();
      inSub = true;
    } else if (inSub && /[\p{L}]/u.test(ch)) {
      sub += ch;
    } else if (SUBS[ch]) {
      flushBuf();
      sub += SUBS[ch];
    } else {
      inSub = false;
      flushSub();
      buf += ch;
    }
  }
  flushSub();
  flushBuf();
  return <>{parts}</>;
}

/** fmt with a true minus sign. */
export function num(n, digits = 1, decimal = '.') {
  return fmt(n, digits, decimal).replace('-', '−');
}

/** Trims to at most `max` decimals: 49 → "49", 39.2 → "39.2", 7.84 → "7.84". */
export function trim(n, decimal = '.', max = 2) {
  for (let k = 0; k <= max; k += 1) if (Math.abs(n * 10 ** k - Math.round(n * 10 ** k)) < 1e-6) return num(n, k, decimal);
  return num(n, max, decimal);
}

const NICE = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** A "nice" axis maximum ≥ v that splits into `parts` round steps. */
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

/* -------------------------------------------------------------- graph */

/**
 * An x–y graph for the dark panel under a scene.
 *  series: [{ id, points: [{x,y}], color, dash, width, opacity, dot }]
 *  hLines: [{ y, color, label }]  — dashed reference lines with a label at the right
 *  marker: x of a dashed vertical cursor
 *  dots:   [{ x, y, color, r }]
 *  notes:  [{ x, y, text, color, anchor, dy }] — small captions in data coordinates
 */
export function XYGraph({ title, legend = [], series, xMax, yMax, xLabel, yLabel, hLines = [], marker, dots = [], notes = [], height = 220, decimal = '.', ariaLabel, note, xParts = 4, yParts = 4, xSuffix = '' }) {
  const [ref, { width }] = useElementSize();
  const H = height;
  const pad = { l: 44, r: 16, t: 20, b: 26 };
  const W = Math.max(width, 240);
  const gx = (v) => pad.l + (v / xMax) * (W - pad.l - pad.r);
  const gy = (v) => H - pad.b - (v / yMax) * (H - pad.t - pad.b);
  const xd = tickDigits(xMax, xParts);
  const yd = tickDigits(yMax, yParts);
  const yTicks = Array.from({ length: yParts + 1 }, (_, i) => (i * yMax) / yParts);
  const xTicks = Array.from({ length: xParts + 1 }, (_, i) => (i * xMax) / xParts);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {title && <p className="text-sm font-semibold text-gray-200">{typeof title === 'string' ? <Rich>{title}</Rich> : title}</p>}
        {legend.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-xs text-gray-400">
            <svg width="18" height="6" aria-hidden="true">
              <line x1="1" y1="3" x2="17" y2="3" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dash} strokeLinecap="round" />
            </svg>
            <Rich>{s.label}</Rich>
          </span>
        ))}
      </div>
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel ?? title} className="block overflow-visible">
          {yTicks.map((v) => (
            <g key={`y${v}`}>
              <line x1={pad.l} x2={W - pad.r} y1={gy(v)} y2={gy(v)} stroke={v === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'} />
              <text x={pad.l - 6} y={gy(v) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                {fmt(v, yd, decimal)}
              </text>
            </g>
          ))}
          {xTicks.map((v) => (
            <text key={`x${v}`} x={gx(v)} y={H - 6} textAnchor="middle" fontSize="11" fill="#94a3b8">
              {fmt(v, xd, decimal)}
              {xSuffix}
            </text>
          ))}
          {xLabel && (
            <text x={W - pad.r} y={H - pad.b - 6} textAnchor="end" fontSize="11" fill="#64748b">
              {xLabel}
            </text>
          )}
          {yLabel && (
            <text x={pad.l + 6} y={pad.t - 7} fontSize="11" fill="#64748b">
              <SvgRich text={yLabel} size={11} />
            </text>
          )}
          <line x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.2)" />
          {hLines.map((h) => (
            <g key={`h${h.label}`}>
              <line x1={pad.l} x2={W - pad.r} y1={gy(h.y)} y2={gy(h.y)} stroke={h.color} strokeOpacity="0.55" strokeDasharray="4 4" />
              <text x={pad.l + 6} y={gy(h.y) + (h.below ? 14 : -5)} fontSize="11" fontWeight="600" fill={h.color}>
                <SvgRich text={h.label} size={11} />
              </text>
            </g>
          ))}
          {marker !== undefined && marker > 0 && <line x1={gx(marker)} x2={gx(marker)} y1={pad.t} y2={H - pad.b} stroke="rgba(34,211,238,0.5)" strokeDasharray="3 4" />}
          {series.map((s) => (
            <polyline
              key={s.id}
              points={s.points.map((p) => `${gx(Math.min(p.x, xMax)).toFixed(1)},${gy(Math.min(p.y, yMax)).toFixed(1)}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeOpacity={s.opacity ?? 1}
              strokeWidth={s.width ?? 2.5}
              strokeDasharray={s.dash}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {notes.map((n) => (
            <text key={n.text} x={gx(n.x)} y={gy(n.y) + (n.dy ?? 0)} textAnchor={n.anchor ?? 'middle'} fontSize="11" fill={n.color ?? '#94a3b8'} fontStyle={n.italic ? 'italic' : undefined}>
              <SvgRich text={n.text} size={11} />
            </text>
          ))}
          {dots.map((d) => (
            <circle key={`${d.x}-${d.y}-${d.color}`} cx={gx(Math.min(d.x, xMax))} cy={gy(Math.min(d.y, yMax))} r={d.r ?? 4.5} fill={d.color} stroke="#0b0b16" strokeWidth="1.5" />
          ))}
        </svg>
      </div>
      {note && <p className="mt-1 text-xs leading-snug text-gray-500">{note}</p>}
    </div>
  );
}

/* ------------------------------------------------------ scene labels */

/** Splits "F_max = μ₀N" into runs; letters after "_" form a subscript run. */
function subRuns(text) {
  const runs = [];
  let cur = { t: '', sub: false };
  let inSub = false;
  for (const ch of String(text ?? '')) {
    if (ch === '_') {
      inSub = true;
      continue;
    }
    const sub = inSub && /\p{L}/u.test(ch);
    if (!sub) inSub = false;
    if (sub !== cur.sub && cur.t) {
      runs.push(cur);
      cur = { t: '', sub };
    }
    cur.sub = sub;
    cur.t += ch;
  }
  if (cur.t) runs.push(cur);
  return runs;
}

/** SVG <tspan>s for a string with "_sub" parts (use inside <text>). */
export function SvgRich({ text, size = 12 }) {
  const runs = subRuns(text);
  const out = [];
  let down = false;
  runs.forEach((r, i) => {
    const dy = r.sub && !down ? size * 0.24 : !r.sub && down ? -size * 0.24 : undefined;
    down = r.sub;
    out.push(
      <tspan key={i} dy={dy} fontSize={r.sub ? size * 0.74 : undefined}>
        {r.t}
      </tspan>,
    );
  });
  return out;
}

/** Width of a TagPill with this text. */
export function tagWidth(text, size = 12) {
  return subRuns(text).reduce((w, r) => w + textWidth(r.t, r.sub ? size * 0.74 : size, 600), 0) + 16;
}

/**
 * A rounded label pill for the scene. One "_sub" part is set as a real
 * subscript ("F_ishq = 24.5 N"). `anchor` places the pill's start, middle or
 * end at x; `box` = { w, h } keeps it inside the drawing.
 */
export function TagPill({ x, y, text, bg, color = '#fff', size = 12, box, anchor = 'middle', border }) {
  if (!text) return null;
  const w = tagWidth(text, size);
  const h = size + 10;
  let left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  let top = y - h / 2;
  if (box) {
    left = clamp(left, 4, box.w - w - 4);
    top = clamp(top, 4, box.h - h - 4);
  }
  return (
    <g pointerEvents="none">
      <rect x={left} y={top} width={w} height={h} rx={h / 2} fill={bg} stroke={border} strokeWidth={border ? 1 : 0} />
      <text x={left + 8} y={top + h / 2 + size * 0.35} fontSize={size} fontWeight={600} fill={color}>
        <SvgRich text={text} size={size} />
      </text>
    </g>
  );
}

/** A force arrow with a white halo so it reads over the drawing; a dot marks the point of application. */
export function FArrow({ x1, y1, x2, y2, color, width = 3.5, head = 13, dash, dot = true }) {
  if (Math.hypot(x2 - x1, y2 - y1) < 2) return dot ? <circle cx={x1} cy={y1} r={3.5} fill={color} stroke="#fff" strokeWidth="1.5" /> : null;
  return (
    <g>
      <Arrow x1={x1} y1={y1} x2={x2} y2={y2} color="#ffffff" width={width + 3} head={head + 3} opacity={0.85} />
      <Arrow x1={x1} y1={y1} x2={x2} y2={y2} color={color} width={width} head={head} dash={dash} />
      {dot && <circle cx={x1} cy={y1} r={3.5} fill={color} stroke="#fff" strokeWidth="1.5" />}
    </g>
  );
}

/* ----------------------------------------------------------- materials */

/** Fill colours of the surfaces. */
export const MATERIAL = {
  wood: { top: '#d9a868', body: '#c48a4a', line: '#a8723a', edge: '#8a5a2b' },
  asphalt: { top: '#4b5563', body: '#374151', line: '#6b7280', edge: '#1f2937' },
  ice: { top: '#d6f1fb', body: '#a9dcf0', line: '#ffffff', edge: '#6bb7d6' },
  wet: { top: '#3f4a5a', body: '#2f3846', line: '#7dd3fc', edge: '#1e293b' },
  snow: { top: '#f8fafc', body: '#e2e8f0', line: '#cbd5e1', edge: '#94a3b8' },
};

function hash01(i) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * A horizontal slab of material from x0 to x1 with its top at `y` and
 * thickness `h`: wood grain, asphalt speckles, ice streaks…
 */
export function Slab({ x0, x1, y, h, kind }) {
  const m = MATERIAL[kind] ?? MATERIAL.wood;
  const w = x1 - x0;
  const marks = [];
  const n = Math.max(6, Math.round(w / 26));
  for (let i = 0; i < n; i += 1) {
    const r1 = hash01(i + 3);
    const r2 = hash01(i + 41);
    const px = x0 + (i + r1 * 0.8) * (w / n);
    if (px + 46 > x1 && kind !== 'asphalt' && kind !== 'wet' && kind !== 'snow') continue;
    if (kind === 'wood') {
      const yy = y + 4 + r2 * (h - 8);
      marks.push(<path key={i} d={`M${px},${yy} q ${12 + r1 * 10},${-2 - r2 * 2} ${26 + r2 * 18},0`} stroke={m.line} strokeWidth="1.2" fill="none" opacity="0.7" />);
    } else if (kind === 'asphalt' || kind === 'wet') {
      marks.push(<circle key={i} cx={px} cy={y + 3 + r2 * (h - 6)} r={0.9 + r1 * 1.1} fill={m.line} opacity="0.8" />);
      marks.push(<circle key={`b${i}`} cx={px + 9} cy={y + 3 + r1 * (h - 6)} r={0.7 + r2} fill="#9ca3af" opacity="0.5" />);
    } else if (kind === 'ice') {
      marks.push(<line key={i} x1={px} y1={y + 3 + r2 * 4} x2={px + 14 + r1 * 16} y2={y + 2 + r2 * 3} stroke={m.line} strokeWidth="2" strokeLinecap="round" opacity="0.9" />);
    } else if (kind === 'snow') {
      marks.push(<circle key={i} cx={px} cy={y + 2 + r2 * (h - 4)} r={1.2 + r1} fill={m.line} opacity="0.8" />);
    }
  }
  return (
    <g aria-hidden="true">
      <rect x={x0} y={y} width={w} height={h} fill={m.body} />
      <rect x={x0} y={y} width={w} height={Math.min(4, h)} fill={m.top} />
      {kind === 'wet' && <rect x={x0} y={y} width={w} height={2} fill="#7dd3fc" opacity="0.7" />}
      <g clipPath={undefined}>{marks}</g>
      <line x1={x0} x2={x1} y1={y} y2={y} stroke={m.edge} strokeWidth="1.5" />
    </g>
  );
}

/** A wooden crate of size w×h with its bottom-left corner at (x, yBottom). `foot` draws a strip of another material under it. */
export function Crate({ x, yBottom, w, h, foot, label, fs = 12 }) {
  const footH = foot ? Math.max(4, Math.round(h * 0.1)) : 0;
  const top = yBottom - h;
  const bodyB = yBottom - footH;
  const bh = bodyB - top;
  const plank = bh / 3;
  return (
    <g>
      <rect x={x} y={top} width={w} height={bh} rx={3} fill="#d9a868" stroke="#8a5a2b" strokeWidth="2" />
      {[1, 2].map((i) => (
        <line key={i} x1={x + 2} x2={x + w - 2} y1={top + plank * i} y2={top + plank * i} stroke="#a8723a" strokeWidth="1.2" />
      ))}
      <line x1={x + 6} y1={bodyB - 5} x2={x + w - 6} y2={top + 5} stroke="#a8723a" strokeWidth="5" strokeLinecap="round" opacity="0.75" />
      <rect x={x + 3} y={top + 3} width={w - 6} height={bh - 6} rx={2} fill="none" stroke="#b07a40" strokeWidth="1" opacity="0.6" />
      {foot === 'rubber' && <rect x={x + 2} y={bodyB} width={w - 4} height={footH} rx={2} fill="#111827" />}
      {foot === 'steel' && (
        <g>
          <rect x={x - 2} y={bodyB + footH * 0.35} width={w + 4} height={footH * 0.65} rx={footH * 0.3} fill="#94a3b8" stroke="#475569" strokeWidth="1" />
          <rect x={x + w * 0.2} y={bodyB} width={4} height={footH * 0.5} fill="#475569" />
          <rect x={x + w * 0.8 - 4} y={bodyB} width={4} height={footH * 0.5} fill="#475569" />
        </g>
      )}
      {label && (
        <text x={x + w * 0.78} y={top + bh * 0.8} textAnchor="middle" fontSize={fs} fontWeight="800" fill="#7c2d12" opacity="0.85" letterSpacing="0.5">
          {label}
        </text>
      )}
    </g>
  );
}

/** Free length of the spring and the largest stretch, as parts of the body length. */
const SPRING0 = 0.3;
const SPRING_MAX = 0.55;

/** How far the hand sits right of the hook for a spring scale of body `len` at stretch `frac` (0…1). */
export function springScaleSpan(len, frac) {
  return 12 + frac * SPRING_MAX * len + len + 30;
}

/**
 * A spring scale (dinamometr) lying along x: its hook at `x1` on the box,
 * the body held by a hand at the right. The spring inside is anchored to the
 * body's right end and to the pointer on the rod, so as the force grows
 * (`frac` of full scale) the pointer stays with the hook while the body and
 * the hand slide away — the stretch shows on the scale.
 */
export function SpringScale({ x1, y, len, frac, h = 20, fs = 10, reading }) {
  const ext = frac * SPRING_MAX * len;
  const bx = x1 + 12 + ext; // body's left end
  const bodyR = bx + len;
  const zeroX = bodyR - 6 - SPRING0 * len; // pointer at zero force (fixed on the body)
  const pointerX = zeroX - ext; // = x1 + const: moves with the hook
  const anchorX = bodyR - 5;
  const coils = 8;
  const pts = [];
  for (let i = 0; i <= coils * 2; i += 1) {
    const px = pointerX + 3 + (i / (coils * 2)) * (anchorX - pointerX - 3);
    const py = y + (i === 0 || i === coils * 2 ? 0 : i % 2 ? -h * 0.26 : h * 0.26);
    pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  }
  const ticks = [];
  const nT = 10;
  for (let i = 0; i <= nT; i += 1) {
    const tx = zeroX - (i / nT) * SPRING_MAX * len;
    ticks.push(<line key={i} x1={tx} x2={tx} y1={y + h / 2 - 1} y2={y + h / 2 - (i % 5 === 0 ? 7 : 4)} stroke="#334155" strokeWidth={i % 5 === 0 ? 1.3 : 0.9} />);
  }
  return (
    <g>
      {/* hook on the box and the rod into the body */}
      <path d={`M${x1 + 7},${y} L${pointerX},${y}`} stroke="#475569" strokeWidth="2.4" strokeLinecap="round" />
      <path d={`M${x1 + 8},${y} q -8,0 -8,-6`} stroke="#475569" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {/* body */}
      <rect x={bx} y={y - h / 2} width={len} height={h} rx={h / 2.4} fill="#f8fafc" fillOpacity="0.92" stroke="#334155" strokeWidth="1.6" />
      <polyline points={pts.join(' ')} fill="none" stroke="#64748b" strokeWidth="1.3" strokeLinejoin="round" />
      {ticks}
      <rect x={pointerX - 2} y={y - h / 2 + 2} width={4} height={h - 4} rx={1} fill={FC.pull} />
      {/* rod where it enters the body */}
      <line x1={bx} x2={bx} y1={y - 3} y2={y + 3} stroke="#334155" strokeWidth="1.6" />
      {/* ring and hand */}
      <circle cx={bodyR + 6} cy={y} r={5.5} fill="none" stroke="#334155" strokeWidth="2" />
      {reading && (
        <text x={bx + len / 2} y={y - h / 2 - 6} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#1e3a8a">
          {reading}
        </text>
      )}
      <Hand x={bodyR + 9} y={y} s={h / 20} />
    </g>
  );
}

/** A fist holding a ring at (x, y), arm going off to the right. */
export function Hand({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M14,-9 L60,-12 L60,12 L14,9 Z" fill="#60a5fa" stroke="#1d4ed8" strokeWidth="1.2" />
      <rect x={-2} y={-11} width={20} height={22} rx={8} fill="#f2c18f" stroke="#b7794a" strokeWidth="1.3" />
      {[-5, 0, 5].map((d) => (
        <line key={d} x1={0} x2={9} y1={d} y2={d} stroke="#b7794a" strokeWidth="1" />
      ))}
    </g>
  );
}
