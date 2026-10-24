import { Pause, Play, RotateCcw, Timer } from 'lucide-react';

import { Arrow, Btn, clamp, fmt, groupThousands, textWidth, useElementSize } from '../kit/ui';
import { PALETTE } from '../kit/scene';

/**
 * Drawing pieces shared by the tabs of the "Potential energy" lesson: the
 * scene shell of the chosen design (light lab paper, legend chips on top,
 * chips on the right, the legend under the scene on phones), Start/Pause/
 * Reset, force arrows with a white halo, a scale bar, an energy formula in
 * serif italic, number formatting with a real minus sign. No words live
 * here — every label arrives through props from the lesson's TEXT table.
 */

export const G = 9.8; // m/s², free-fall acceleration used in the lessons

/** One colour per quantity, the same in every tab, legend and readout. */
export const EC = {
  ep: '#2563eb', // potential energy E_p (and the height h it is measured with)
  epText: '#93c5fd',
  epSoft: '#dbeafe',
  neg: '#e11d48', // E_p below the zero level (negative)
  negText: '#fda4af',
  mg: '#dc2626', // force of gravity
  mgText: '#fca5a5',
  F: '#0d9488', // the crane's pull on the crate (cable tension)
  FText: '#5eead4',
  work: '#d97706', // work A, change ΔE_p
  workText: '#fcd34d',
  zero: '#0891b2', // the zero level
  zeroText: '#67e8f9',
  v: PALETTE.vel,
  vText: PALETTE.velText,
  ink: '#0f172a',
  muted: '#64748b',
};

/* -------------------------------------------------------------- numbers */

/** Fixed-point with a real minus sign. */
export function num(n, digits = 1, dec = '.') {
  const s = fmt(n, digits, dec);
  return s.startsWith('-') ? `−${s.slice(1)}` : s;
}

/**
 * Up to `max` decimals with trailing zeros dropped (490 → "490", 19.6 →
 * "19.6", 11.76 → "11.76"), a real minus, and thin-space thousands from
 * 10 000 up. For results a reader checks by hand.
 */
export function smart(n, dec = '.', max = 2) {
  if (!Number.isFinite(n)) return '—';
  const eps = 0.5 * 10 ** -max;
  const v = Math.abs(n) < eps ? 0 : n;
  const neg = v < 0;
  const a = Math.abs(v);
  if (a >= 10000) return (neg ? '−' : '') + groupThousands(a);
  let s = a.toFixed(max);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  if (dec !== '.') s = s.replace('.', dec);
  return (neg ? '−' : '') + s;
}

/** Signed value with an explicit "+" for positive numbers. */
export function signed(n, dec = '.', max = 2) {
  const s = smart(n, dec, max);
  return n > 0.5 * 10 ** -max ? `+${s}` : s;
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

/** A small dark info box inside a controls panel. */
export function InfoBox({ title, children }) {
  return (
    <div className="rounded-xl bg-black/25 px-3 py-2.5">
      {title && <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{title}</p>}
      <div className="mt-1.5 text-[13px] leading-snug text-gray-300">{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

export function LegendItem({ color, label, kind = 'line' }) {
  return (
    <li className="flex items-center gap-1.5">
      <svg width="20" height="10" aria-hidden="true" className="shrink-0">
        {kind === 'dash' && <line x1="1" y1="5" x2="19" y2="5" stroke={color} strokeWidth="2" strokeDasharray="4 3" />}
        {kind === 'dot' && <circle cx="10" cy="5" r="4" fill={color} />}
        {kind === 'bar' && <rect x="3" y="0.5" width="14" height="9" rx="2" fill={color} />}
        {(kind === 'line' || kind === 'arrow') && (
          <line x1="1" y1="5" x2={kind === 'arrow' ? 13 : 19} y2="5" stroke={color} strokeWidth="3" strokeLinecap="round" />
        )}
        {kind === 'arrow' && <path d="M19,5 L12,1 L12,9 Z" fill={color} />}
      </svg>
      <span>{rich(label)}</span>
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
            {legend.map((l, i) => (
              <LegendItem key={l.id ?? i} {...l} />
            ))}
          </ul>
        )}
        {chips && <div className="ml-auto flex flex-col items-end gap-1.5">{chips}</div>}
      </div>
      {legend.length > 0 && (
        <ul className="flex sm:hidden flex-wrap gap-x-3 gap-y-1 border-t border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          {legend.map((l, i) => (
            <LegendItem key={l.id ?? i} {...l} />
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

/**
 * A vertical dimension line from y1 to y2 at x, with small end ticks and an
 * arrow head at y2 (pointing away from y1). `color` tints line and heads.
 */
export function DimLine({ x, y1, y2, color, width = 2, tick = 6 }) {
  const len = Math.abs(y2 - y1);
  if (len < 1.5) return <circle cx={x} cy={y1} r={3.5} fill={color} />;
  return (
    <g aria-hidden="true">
      <line x1={x - tick} x2={x + tick} y1={y1} y2={y1} stroke={color} strokeWidth={width} />
      <line x1={x - tick} x2={x + tick} y1={y2} y2={y2} stroke={color} strokeWidth={width} />
      <Arrow x1={x} y1={y1} x2={x} y2={y2} color={color} width={width} head={Math.min(9, len * 0.45)} />
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
export function SidePill({ x, y, side = 1, gap = 8, text, bg, fs = 12, box, color, border }) {
  if (!text) return null;
  const w = richWidth(text, fs, 600) + 16;
  return <RichPill x={side === 0 ? x : x + side * (gap + w / 2)} y={y} text={text} bg={bg} size={fs} box={box} color={color} border={border} />;
}

/* ------------------------------------------------------------- rich text */

// "E_p", "h_A" or "E_{p,A}": the part after "_" is a subscript
const SUB_RE = /_\{([^}]*)\}|_([A-Za-z0-9]+)/g;

function splitSub(str) {
  const parts = [];
  let last = 0;
  let m;
  SUB_RE.lastIndex = 0;
  while ((m = SUB_RE.exec(str))) {
    parts.push({ t: str.slice(last, m.index), sub: false });
    parts.push({ t: m[1] ?? m[2], sub: true });
    last = m.index + m[0].length;
  }
  parts.push({ t: str.slice(last), sub: false });
  return parts.filter((p) => p.t !== '');
}

/** "E_p = 490 J" → text with a real <sub> (HTML). */
export function rich(str) {
  if (typeof str !== 'string' || !str.includes('_')) return str;
  return (
    <span>
      {splitSub(str).map((p, i) =>
        p.sub ? (
          <sub key={i} className="text-[0.72em] not-italic">
            {p.t}
          </sub>
        ) : (
          <span key={i}>{p.t}</span>
        ),
      )}
    </span>
  );
}

/** Same for SVG text: subscripts become smaller tspans shifted down. */
export function richSvg(str, size) {
  if (typeof str !== 'string' || !str.includes('_')) return str;
  const sh = size * 0.28;
  let down = false;
  return splitSub(str).map((p, i) => {
    const dy = p.sub ? sh : down ? -sh : undefined;
    down = p.sub;
    return (
      <tspan key={i} dy={dy} fontSize={p.sub ? size * 0.72 : undefined}>
        {p.t}
      </tspan>
    );
  });
}

/** Pixel width of a string that may contain subscripts. */
export function richWidth(str, size, weight = 600) {
  return splitSub(String(str)).reduce((w, p) => w + textWidth(p.t, p.sub ? size * 0.72 : size, weight), 0);
}

/** Plain words for screen readers: "E_p" → "E p". */
export function plain(str) {
  return String(str).replace(SUB_RE, (_, a, b) => ` ${a ?? b}`);
}

/** A rounded value label that understands subscripts and stays inside `box`. */
export function RichPill({ x, y, text, bg, color = '#fff', size = 12, box, border, weight = 600, anchor = 'middle' }) {
  if (!text) return null;
  const w = richWidth(text, size, weight) + 16;
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
      <text x={left + w / 2} y={top + h / 2 + size * 0.35} textAnchor="middle" fontSize={size} fontWeight={weight} fill={color}>
        {richSvg(text, size)}
      </text>
    </g>
  );
}

/** Text with a white halo (and subscripts), for labels drawn over busy scenery. */
export function HaloText({ x, y, children, size = 12, weight = 700, fill = EC.ink, anchor = 'start', italic, halo = '#ffffff' }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={size}
      fontWeight={weight}
      fontStyle={italic ? 'italic' : undefined}
      fill={fill}
      stroke={halo}
      strokeWidth="3.5"
      paintOrder="stroke"
      strokeLinejoin="round"
      pointerEvents="none"
    >
      {richSvg(children, size)}
    </text>
  );
}

/**
 * A formula in the serif italic of symbols, with digits, signs and brackets
 * kept upright (the italic serif draws 0 like the letter o) and "_x" as a
 * subscript.
 */
export function Formula({ text }) {
  const out = [];
  splitSub(String(text)).forEach((seg, si) => {
    if (seg.sub) {
      out.push(
        <sub key={`s${si}`} className="text-[0.72em]">
          {seg.t}
        </sub>,
      );
      return;
    }
    seg.t
      .split(/([0-9.,]+|[()=+−·/²√|≈⇒→]+)/g)
      .filter(Boolean)
      .forEach((p, i) => {
        out.push(
          /^[0-9.,]+$|^[()=+−·/²√|≈⇒→]+$/.test(p) ? (
            <span key={`${si}-${i}`} className="font-sans not-italic">
              {p}
            </span>
          ) : (
            <span key={`${si}-${i}`}>{p}</span>
          ),
        );
      });
  });
  return <span className="font-serif italic">{out}</span>;
}

/** Ground line with a hatch underneath, from x0 to x1 at y. */
export function Ground({ x0, x1, y, fill = '#f1ece4', depth = 14 }) {
  const n = Math.max(0, Math.ceil((x1 - x0) / 9));
  return (
    <g aria-hidden="true">
      <rect x={x0} y={y} width={x1 - x0} height={depth} fill={fill} />
      {Array.from({ length: n }, (_, i) => (
        <line key={`gh${i}`} x1={x0 + i * 9 + 7} x2={x0 + i * 9} y1={y + 1} y2={y + 8} stroke="#b8a993" />
      ))}
      <line x1={x0} x2={x1} y1={y} y2={y} stroke="#475569" strokeWidth="1.8" />
    </g>
  );
}
