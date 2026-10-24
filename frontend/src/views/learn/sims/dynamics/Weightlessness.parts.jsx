import { Pause, Play, RotateCcw, Timer } from 'lucide-react';

import { Arrow, Btn, useElementSize } from '../kit/ui';
import { PALETTE } from '../kit/scene';

/**
 * Drawing pieces of the "Vaznsizlik" (weightlessness) lab: the scene shell of
 * the chosen design (light lab paper, legend chips on top, chips on the
 * right, the legend under the scene on phones), Start/Pause/Reset, labelled
 * vectors and a little pictogram person who can stand, hold an apple, float
 * or be pressed down by an overload. No words live here — every label
 * arrives through props.
 */

/** Free-fall acceleration at the Earth's surface, m/s². */
export const G = 9.8;

/** Colours of the lesson's quantities (forces get their own, kept in every tab). */
export const C = {
  mg: '#dc2626', // force of gravity mg
  mgText: '#fca5a5',
  N: '#2563eb', // normal (support reaction) force N
  NText: '#93c5fd',
  P: '#9333ea', // weight P — acts on the support
  PText: '#d8b4fe',
  vel: PALETTE.vel,
  velText: PALETTE.velText,
  acc: PALETTE.acc,
  accText: PALETTE.accText,
  water: '#0284c7',
  waterText: '#7dd3fc',
  time: PALETTE.time,
  ink: PALETTE.ink,
  muted: PALETTE.muted,
  grid: PALETTE.grid,
};

/* ------------------------------------------------------------- controls */

/** Start / Pause / Resume / Again + Reset, in the reference's size. */
export function PlayControls({ labels, running, done, started, onToggle, onReset, className = '', disabled }) {
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

export function GroupLabel({ children }) {
  return <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{children}</p>;
}

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

/** A chip in the scene's top-right corner (time speed-up, clock, force scale…). */
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

/** A short horizontal bar for the force-scale chip: `px` long, in the force colour. */
export function ScaleBar({ px, color = C.ink }) {
  const w = Math.max(6, Math.round(px));
  return (
    <svg width={w + 4} height="10" aria-hidden="true" className="shrink-0">
      <line x1="2" y1="5" x2={w + 2} y2="5" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <line x1="2" y1="1" x2="2" y2="9" stroke={color} strokeWidth="1.5" />
      <line x1={w + 2} y1="1" x2={w + 2} y2="9" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

/**
 * The light lab-paper scene: `children(W, H, narrow)` draws into an SVG of
 * the measured width; `height` may be a number or `(W, narrow) => px`.
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

/** Light square grid over a rectangle of the scene (purely decorative paper). */
export function PaperCells({ x0, y0, x1, y1, step, color = '#eef2f7' }) {
  const lines = [];
  for (let x = x0; x <= x1 + 0.5; x += step) lines.push(<line key={`x${x}`} x1={x} x2={x} y1={y0} y2={y1} stroke={color} />);
  for (let y = y0; y <= y1 + 0.5; y += step) lines.push(<line key={`y${y}`} x1={x0} x2={x1} y1={y} y2={y} stroke={color} />);
  return <g aria-hidden="true">{lines}</g>;
}

/* -------------------------------------------------------------- labels */

/** Text with a white halo, readable over lines and drawings on the lab paper. */
export function Label({ x, y, children, color = C.ink, size = 12, weight = 700, anchor = 'middle', italic = false, halo = '#fff' }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={size}
      fontWeight={weight}
      fontStyle={italic ? 'italic' : undefined}
      fill={color}
      stroke={halo}
      strokeWidth={3.5}
      paintOrder="stroke"
      strokeLinejoin="round"
    >
      {children}
    </text>
  );
}

/**
 * A vector from (x, y) by (dx, dy) screen px, with a label at its tip.
 * `place` puts the label 'tip' (beyond the head), 'left' or 'right' of the shaft's middle.
 */
export function Vec({ x, y, dx, dy, color, label, width = 3.5, head = 12, place = 'tip', size = 12, gap = 10 }) {
  const len = Math.hypot(dx, dy);
  if (len < 2) return null;
  const ux = dx / len;
  const uy = dy / len;
  let lx = x + dx + ux * (gap + size * 0.4);
  let ly = y + dy + uy * (gap + size * 0.2) + size * 0.35;
  let anchor = 'middle';
  if (place === 'left' || place === 'right') {
    const s = place === 'left' ? -1 : 1;
    lx = x + dx * 0.55 + s * (gap + 2);
    ly = y + dy * 0.55 + size * 0.35;
    anchor = s < 0 ? 'end' : 'start';
  }
  return (
    <g>
      <Arrow x1={x} y1={y} x2={x + dx} y2={y + dy} color={color} width={width} head={head} />
      <circle cx={x} cy={y} r={width * 0.9} fill={color} />
      {label && (
        <Label x={lx} y={ly} color={color} size={size} anchor={anchor} italic>
          {label}
        </Label>
      )}
    </g>
  );
}

/* --------------------------------------------------------------- person */

const SKIN = '#f1c6a3';
const HAIR = '#3b2a1e';
const PANTS = '#334155';
const SHOE = '#1e293b';

/**
 * Joint angles in radians, measured from "straight down"; positive turns the
 * limb towards the way the person faces. [upper, extra for the lower part].
 */
const POSES = {
  stand: { torso: 0, back: [0.1, 0.06], front: [-0.06, 0.06], legB: [0.05, 0], legF: [-0.05, 0] },
  hold: { torso: 0, back: [0.08, 0.06], front: [1.45, 0.12], legB: [0.05, 0], legF: [-0.05, 0] },
  float: { torso: 0, back: [1.05, 0.55], front: [1.35, 0.35], legB: [0.6, -1.05], legF: [0.32, -0.75] },
  pressed: { torso: 0.18, back: [0.45, 0.35], front: [0.35, 0.45], legB: [0.95, -1.75], legF: [0.85, -1.6] },
};

function limb(o, a1, a2, l1, l2) {
  const e = { x: o.x + Math.sin(a1) * l1, y: o.y - Math.cos(a1) * l1 };
  const h = { x: e.x + Math.sin(a1 + a2) * l2, y: e.y - Math.cos(a1 + a2) * l2 };
  return [o, e, h];
}

/**
 * Skeleton of the pictogram in units of the standing height, y up. Grounded
 * poses put the lower foot at y = 0; floating ones keep the hip at 0.5.
 */
export function personGeometry(pose = 'stand', grounded = true) {
  const p = POSES[pose] ?? POSES.stand;
  const hip = { x: 0, y: 0 };
  const sh = { x: Math.sin(p.torso) * 0.3, y: Math.cos(p.torso) * 0.3 };
  const head = { x: Math.sin(p.torso) * 0.42, y: Math.cos(p.torso) * 0.42 };
  const armB = limb(sh, ...p.back, 0.16, 0.15);
  const armF = limb(sh, ...p.front, 0.16, 0.15);
  const legB = limb(hip, ...p.legB, 0.25, 0.25);
  const legF = limb(hip, ...p.legF, 0.25, 0.25);
  const dy = grounded ? -Math.min(legB[2].y, legF[2].y) : 0.5;
  const up = (q) => ({ x: q.x, y: q.y + dy });
  return {
    hip: up(hip),
    sh: up(sh),
    head: up(head),
    armB: armB.map(up),
    armF: armF.map(up),
    legB: legB.map(up),
    legF: legF.map(up),
  };
}

/**
 * The pictogram person. (x, y) is the screen point under the feet (grounded)
 * or the screen point of y = 0 in the figure's units (floating); `h` is the
 * standing height in px; `rotate` turns the whole figure about (x, y − h/2).
 */
export function Person({ x, y, h, pose = 'stand', facing = 1, shirt = '#0ea5e9', grounded = true, rotate = 0, opacity = 1 }) {
  const g = personGeometry(pose, grounded);
  const pt = (q) => `${(x + facing * q.x * h).toFixed(1)},${(y - q.y * h).toFixed(1)}`;
  const poly = (pts, w, color, key) => (
    <polyline key={key} points={pts.map(pt).join(' ')} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
  );
  const hx = x + facing * g.head.x * h;
  const hy = y - g.head.y * h;
  const r = 0.072 * h;
  const foot = (leg, key) => {
    const f = leg[2];
    return <ellipse key={key} cx={x + facing * (f.x + 0.03) * h} cy={y - f.y * h} rx={0.05 * h} ry={0.022 * h} fill={SHOE} />;
  };
  const hand = (arm, key) => <circle key={key} cx={x + facing * arm[2].x * h} cy={y - arm[2].y * h} r={0.03 * h} fill={SKIN} />;
  const torsoTop = { x: g.sh.x, y: g.sh.y + 0.01 };
  return (
    <g transform={rotate ? `rotate(${rotate} ${x} ${y - 0.5 * h})` : undefined} opacity={opacity}>
      {poly(g.armB, 0.058 * h, shadeOf(shirt), 'ab')}
      {hand(g.armB, 'hb')}
      {poly(g.legB, 0.082 * h, '#475569', 'lb')}
      {foot(g.legB, 'fb')}
      {poly(g.legF, 0.082 * h, PANTS, 'lf')}
      {foot(g.legF, 'ff')}
      {poly([g.hip, torsoTop], 0.15 * h, shirt, 'torso')}
      <circle cx={hx} cy={hy} r={r} fill={SKIN} />
      <path
        d={`M${hx - r},${hy - r * 0.05} A${r},${r} 0 0 1 ${hx + r},${hy - r * 0.05} Q${hx + facing * r * 0.2},${hy - r * 0.55} ${hx - r},${hy - r * 0.05} Z`}
        fill={HAIR}
      />
      <circle cx={hx + facing * r * 0.45} cy={hy + r * 0.05} r={r * 0.11} fill={HAIR} />
      {poly(g.armF, 0.058 * h, shirt, 'af')}
      {hand(g.armF, 'hf')}
    </g>
  );
}

/** Screen position of the person's front hand (for something held in it). */
export function frontHand({ x, y, h, pose = 'hold', facing = 1, grounded = true }) {
  const g = personGeometry(pose, grounded);
  const q = g.armF[2];
  return { x: x + facing * q.x * h, y: y - q.y * h };
}

/** A slightly darker shade of a #rrggbb colour (the far arm). */
function shadeOf(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = 0.78;
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}

/* ----------------------------------------------------------------- misc */

/** A red apple with a leaf, centre (x, y), radius r px. */
export function Apple({ x, y, r }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#dc2626" stroke="#991b1b" strokeWidth={1} />
      <circle cx={x - r * 0.35} cy={y - r * 0.3} r={r * 0.25} fill="#fff" opacity="0.35" />
      <line x1={x} y1={y - r} x2={x + r * 0.15} y2={y - r * 1.45} stroke="#78350f" strokeWidth={Math.max(1.2, r * 0.16)} strokeLinecap="round" />
      <path d={`M${x + r * 0.12},${y - r * 1.25} q${r * 0.6},${-r * 0.5} ${r * 0.95},${-r * 0.05} q${-r * 0.5},${r * 0.35} ${-r * 0.95},${r * 0.05} Z`} fill="#16a34a" />
    </g>
  );
}

/** Seven-segment-like LCD box with a big value and a small caption (a scale's display). */
export function LcdBox({ x, y, w, h, value, unit, caption, dim }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={10} fill="#0f172a" stroke="#334155" strokeWidth={2} />
      <rect x={x + 6} y={y + 6} width={w - 12} height={h - 12} rx={6} fill={dim ? '#1c2a1f' : '#0b2e1d'} />
      {caption && (
        <text x={x + 12} y={y + 20} fontSize={Math.max(9, h * 0.15)} fontWeight="700" fill="#4ade80" opacity="0.75" letterSpacing="0.08em">
          {caption}
        </text>
      )}
      <text
        x={x + w - 14}
        y={y + h - 14}
        textAnchor="end"
        fontSize={h * 0.42}
        fontWeight="700"
        fill="#86efac"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
        <tspan fontSize={h * 0.2} dx="4" fill="#4ade80">
          {unit}
        </tspan>
      </text>
    </g>
  );
}

/** Rounds `v` up to a "nice" axis maximum (1, 2, 2.5, 5 × 10ⁿ steps of `parts`). */
export function niceMax(v, parts = 4) {
  const raw = Math.max(v, 1e-9) / parts;
  const p = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw - 1e-12) return m * p * parts;
  return 10 * p * parts;
}
