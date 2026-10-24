import { Pause, Play, RotateCcw, Timer } from 'lucide-react';

import { Arrow, Btn, Pill, fmt, groupThousands, textWidth, useElementSize } from '../kit/ui';
import { PALETTE } from '../kit/scene';

/**
 * Drawing pieces shared by the three tabs of the "Power" lesson: the scene
 * shell of the chosen design (light lab paper, legend chips on top, chips on
 * the right, the legend under the scene on phones), Start/Pause/Reset, force
 * arrows with a white halo, a side-view climbing person, number helpers.
 * No words live here — every label arrives through props from the lesson's
 * TEXT table.
 */

export const G = 9.8; // m/s²
export const HP = 736; // W in one metric horsepower (ot kuchi, o.k.)

/** One colour per quantity, the same in every tab, legend and tile. */
export const PC = {
  N: '#d97706', // power
  NText: '#fcd34d',
  A: '#0d9488', // work
  AText: '#5eead4',
  Ep: '#2563eb', // potential energy
  EpText: '#93c5fd',
  one: '#2563eb', // first climber
  oneText: '#93c5fd',
  two: PALETTE.second, // second climber
  twoText: PALETTE.secondText,
  F: PALETTE.force, // pulling / traction force
  FText: '#fca5a5',
  mg: '#475569', // gravity and its components
  mgText: '#cbd5e1',
  R: '#0891b2', // resistance (rolling + air)
  RText: '#67e8f9',
  v: PALETTE.vel,
  vText: PALETTE.velText,
  time: '#22d3ee',
  timeText: '#a5f3fc',
};

/* -------------------------------------------------------------- numbers */

/** Fixed-point with a real minus sign. */
export function num(n, digits = 1, dec = '.') {
  const s = fmt(n, digits, dec);
  return s.startsWith('-') ? `−${s.slice(1)}` : s;
}

/**
 * A number with up to `digits` decimals, trailing zeros dropped when the
 * value is whole, thousands grouped from 10 000 up.
 */
export function smart(n, dec = '.', digits = 1) {
  if (!Number.isFinite(n)) return '—';
  const p = 10 ** digits;
  const r = Math.round(n * p) / p;
  if (Math.abs(r - Math.round(r)) < 1e-9) {
    const i = Math.round(r);
    return Math.abs(i) >= 10000 ? (i < 0 ? '−' : '') + groupThousands(Math.abs(i)) : num(i, 0, dec);
  }
  return num(r, digits, dec);
}

/** Whole numbers, grouped by thousands from 10 000 up (joules, newtons). */
export function whole(n, dec = '.') {
  if (!Number.isFinite(n)) return '—';
  const r = Math.round(n);
  if (Math.abs(r) >= 10000) return (r < 0 ? '−' : '') + groupThousands(Math.abs(r));
  return num(r, 0, dec);
}

/** A power in W, kW or MW with its unit word from the TEXT table. */
export function power(w, T, digits = 1) {
  if (w >= 1e6) return `${smart(w / 1e6, T.decimal, digits)} ${T.MW}`;
  if (w >= 1000) return `${smart(w / 1000, T.decimal, digits)} ${T.kW}`;
  return `${smart(w, T.decimal, digits)} ${T.W}`;
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

/** The smallest friendly speed-up that brings a run of `total` s under `target` s on screen. */
export function pickTimeScale(total, target = 15) {
  for (const k of [1, 2, 3, 4, 5, 10, 20, 50, 100, 200]) if (total / k <= target) return k;
  return 500;
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
        {kind === 'block' && <rect x="3" y="0.5" width="14" height="9" rx="2" fill={color} />}
        {(kind === 'line' || kind === 'arrow') && (
          <line x1="1" y1="5" x2={kind === 'arrow' ? 13 : 19} y2="5" stroke={color} strokeWidth="3" strokeLinecap="round" />
        )}
        {kind === 'arrow' && <path d="M19,5 L12,1 L12,9 Z" fill={color} />}
      </svg>
      <span>{label}</span>
    </li>
  );
}

/** A chip in the scene's top-right corner (time, engine…). */
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
 * phones.
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
 * halo for contrast on busy drawings, the coloured arrow, a dot at the tail.
 */
export function ForceArrow({ x1, y1, x2, y2, color, width = 3.5, head = 13, opacity = 1, dot = true, dash }) {
  if (Math.hypot(x2 - x1, y2 - y1) < 3) {
    return dot ? <circle cx={x1} cy={y1} r={width * 0.9 + 1} fill={color} stroke="#fff" strokeWidth={1.5} opacity={opacity} /> : null;
  }
  return (
    <g opacity={opacity}>
      <Arrow x1={x1} y1={y1} x2={x2} y2={y2} color="#ffffff" width={width + 4} head={head + 4} />
      <Arrow x1={x1} y1={y1} x2={x2} y2={y2} color={color} width={width} head={head} dash={dash} />
      {dot && <circle cx={x1} cy={y1} r={width * 0.9 + 1} fill={color} stroke="#fff" strokeWidth={1.5} />}
    </g>
  );
}

/** A label pill that sits to one side of a point (side = -1 left, 1 right, 0 centred). */
export function SidePill({ x, y, side = 1, gap = 8, text, bg, fs = 12, box, color }) {
  if (!text) return null;
  const w = textWidth(text, fs, 600) + 16;
  return <Pill x={side === 0 ? x : x + side * (gap + w / 2)} y={y} text={text} bg={bg} color={color} size={fs} box={box} />;
}

/** Italic letter label with a white halo, for arrows. */
export function SymbolText({ x, y, children, color, fs = 13, anchor = 'middle' }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={fs} fontStyle="italic" fontWeight="700" fill={color} stroke="#fff" strokeWidth="3" paintOrder="stroke">
      {children}
    </text>
  );
}

/**
 * A formula in the serif italic of symbols, with digits, signs and brackets
 * kept upright (the italic serif draws 0 like the letter o).
 */
export function Formula({ text }) {
  const parts = String(text).split(/([0-9.,]+|[()=+−·/²√≈×:]+)/g).filter(Boolean);
  return (
    <span className="font-serif italic">
      {parts.map((p, i) =>
        /^[0-9.,]+$|^[()=+−·/²√≈×:]+$/.test(p) ? (
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
 * A person seen from the side, `h` px tall, with the feet on the line through
 * (x, y) of slope `slope` (rise per run, screen-up positive), facing `dir`
 * (1 right, −1 left). `phase` (cycles) drives the gait, `lean` (0…1) bends
 * the body forward from a walk to a run; `moving = false` stands still.
 */
export function Climber({ x, y, h, dir = 1, phase = 0, lean = 0, moving = true, slope = 0.55, shirt = '#2563eb', pants = '#334155', skin = '#f1c7a3', hair = '#3b2a20', shoe = '#1e293b' }) {
  const u = h / 100;
  const L1 = 25 * u;
  const L2 = 25 * u;
  const theta = moving ? ((8 + 20 * lean) * Math.PI) / 180 : (2 * Math.PI) / 180;
  const hipX = x - dir * (moving ? 2 * u * lean : 0);
  const hipY = y - (moving ? 42 : 50) * u;
  const shX = hipX + dir * Math.sin(theta) * 30 * u;
  const shY = hipY - Math.cos(theta) * 30 * u;
  const headX = shX + dir * Math.sin(theta) * 10.5 * u;
  const headY = shY - Math.cos(theta) * 10.5 * u;
  const sL = (moving ? 10 + 3 * lean : 0) * u;

  const leg = (i) => {
    let fx;
    let fy;
    if (!moving) {
      fx = hipX + dir * (i === 0 ? 2.5 : -2.5) * u;
      fy = y;
    } else {
      const p = (((phase + i / 2) % 1) + 1) % 1;
      let rel;
      let lift = 0;
      if (p < 0.5) {
        const q = p / 0.5;
        rel = sL * (-1 + 2 * q);
        lift = Math.sin(Math.PI * q) * (8 + 4 * lean) * u;
      } else {
        const q = (p - 0.5) / 0.5;
        rel = sL * (1 - 2 * q);
      }
      fx = hipX + dir * rel;
      fy = y - slope * rel - lift;
    }
    let dx = fx - hipX;
    let dy = fy - hipY;
    let d = Math.hypot(dx, dy);
    const maxD = L1 + L2 - 0.01;
    if (d > maxD) {
      dx *= maxD / d;
      dy *= maxD / d;
      fx = hipX + dx;
      fy = hipY + dy;
      d = maxD;
    }
    const a = Math.sqrt(Math.max(0, L1 * L1 - (d / 2) ** 2));
    let px = -dy / d;
    let py = dx / d;
    if (px * dir < 0) {
      px = -px;
      py = -py;
    }
    const kx = hipX + dx / 2 + px * a;
    const ky = hipY + dy / 2 + py * a;
    return { kx, ky, fx, fy };
  };

  const arm = (i) => {
    const p = moving ? Math.sin(2 * Math.PI * (phase + i / 2 + 0.5)) : 0;
    const swing = p * (0.35 + 0.4 * lean);
    const ang = theta + swing; // from the downward vertical, forward positive
    const ex = shX + dir * Math.sin(ang) * 13 * u;
    const ey = shY + Math.cos(ang) * 13 * u;
    const fore = ang + (moving ? 0.9 + 0.5 * lean : 0.15);
    const hx = ex + dir * Math.sin(fore) * 12 * u;
    const hy = ey + Math.cos(fore) * 12 * u;
    return { ex, ey, hx, hy };
  };

  const legPath = (l) => `M${hipX},${hipY} L${l.kx},${l.ky} L${l.fx},${l.fy}`;
  const armPath = (a) => `M${shX},${shY} L${a.ex},${a.ey} L${a.hx},${a.hy}`;
  const back = leg(1);
  const front = leg(0);
  const armB = arm(0);
  const armF = arm(1);
  const shoeAt = (l, col) => <ellipse cx={l.fx + dir * 2.4 * u} cy={l.fy - 1.4 * u} rx={4.4 * u} ry={1.8 * u} fill={col} />;

  return (
    <g aria-hidden="true">
      {/* far leg and arm, a shade darker */}
      <path d={legPath(back)} fill="none" stroke={pants} strokeOpacity="0.75" strokeWidth={6.5 * u} strokeLinecap="round" strokeLinejoin="round" />
      {shoeAt(back, shoe)}
      <path d={armPath(armB)} fill="none" stroke={shirt} strokeOpacity="0.7" strokeWidth={4.6 * u} strokeLinecap="round" strokeLinejoin="round" />
      {/* torso */}
      <line x1={hipX} y1={hipY} x2={shX} y2={shY} stroke={shirt} strokeWidth={12 * u} strokeLinecap="round" />
      {/* head */}
      <line x1={shX} y1={shY} x2={headX} y2={headY} stroke={skin} strokeWidth={4.5 * u} strokeLinecap="round" />
      <circle cx={headX} cy={headY - 2 * u} r={6.8 * u} fill={skin} />
      <path
        d={`M${headX - 6.8 * u},${headY - 2.6 * u} A${6.8 * u},${6.8 * u} 0 0 1 ${headX + 6.8 * u},${headY - 2.6 * u} Q${headX + dir * -1 * u},${headY - 5.4 * u} ${headX - 6.8 * u},${headY - 2.6 * u} Z`}
        fill={hair}
      />
      <circle cx={headX + dir * 3.4 * u} cy={headY - 2.4 * u} r={0.9 * u} fill="#1e293b" />
      {/* near leg and arm */}
      <path d={legPath(front)} fill="none" stroke={pants} strokeWidth={6.5 * u} strokeLinecap="round" strokeLinejoin="round" />
      {shoeAt(front, shoe)}
      <path d={armPath(armF)} fill="none" stroke={shirt} strokeWidth={4.6 * u} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={armF.hx} cy={armF.hy} r={2.3 * u} fill={skin} />
    </g>
  );
}

/* ---------------------------------------------------------------- graph */

/**
 * The kit's live graph with three small additions this lesson needs: a
 * series can stay out of the legend (`legend: false`), shade the area under
 * itself (`fill: { color, opacity }`), and the graph can carry text notes in
 * data coordinates (`notes: [{ x, y, text, color, anchor }]`).
 */
export function LiveGraph({ title, series, xMax, yMax, yMin = 0, xLabel, yLabel, marker, note, height = 200, decimal = '.', ariaLabel, xDigits = 0, yDigits = 0, notes = [], xOffset = 0 }) {
  const [ref, { width }] = useElementSize();
  const H = height;
  const pad = { l: 46, r: 14, t: 18, b: 26 };
  const W = Math.max(width, 220);
  const gx = (v) => pad.l + (v / xMax) * (W - pad.l - pad.r);
  const gy = (v) => H - pad.b - ((v - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => yMin + f * (yMax - yMin));
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * xMax);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {title && <p className="text-sm font-semibold text-gray-200">{title}</p>}
        {series
          .filter((s) => s.legend !== false)
          .map((s) => (
            <span key={s.id} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="h-0.5 w-4 rounded" style={{ background: s.color }} /> {s.label}
            </span>
          ))}
      </div>
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel ?? title} className="block overflow-visible">
          {yTicks.map((v) => (
            <g key={`y${v}`}>
              <line x1={pad.l} x2={W - pad.r} y1={gy(v)} y2={gy(v)} stroke={Math.abs(v) < 1e-9 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'} />
              <text x={pad.l - 6} y={gy(v) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                {fmt(v, yDigits, decimal)}
              </text>
            </g>
          ))}
          {xTicks.map((v) => (
            <text key={`x${v}`} x={gx(v)} y={H - 6} textAnchor="middle" fontSize="11" fill="#94a3b8">
              {fmt(xOffset + v, xDigits, decimal)}
            </text>
          ))}
          {xLabel && (
            <text x={W - pad.r} y={H - pad.b - 6} textAnchor="end" fontSize="11" fill="#64748b">
              {xLabel}
            </text>
          )}
          {yLabel && (
            <text x={pad.l + 6} y={pad.t - 6} fontSize="11" fill="#64748b">
              {yLabel}
            </text>
          )}
          <line x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.2)" />
          {series
            .filter((s) => s.fill && s.points.length > 1)
            .map((s) => (
              <polygon
                key={`fill-${s.id}`}
                points={[
                  `${gx(s.points[0].x)},${gy(Math.max(yMin, 0))}`,
                  ...s.points.map((p) => `${gx(p.x)},${gy(p.y)}`),
                  `${gx(s.points[s.points.length - 1].x)},${gy(Math.max(yMin, 0))}`,
                ].join(' ')}
                fill={s.fill.color ?? s.color}
                opacity={s.fill.opacity ?? 0.18}
              />
            ))}
          {marker !== undefined && marker > 0 && (
            <line x1={gx(marker)} x2={gx(marker)} y1={pad.t} y2={H - pad.b} stroke="rgba(34,211,238,0.45)" strokeDasharray="3 4" />
          )}
          {series.map((s) => (
            <g key={s.id}>
              <polyline
                points={s.points.map((p) => `${gx(p.x).toFixed(1)},${gy(p.y).toFixed(1)}`).join(' ')}
                fill="none"
                stroke={s.color}
                strokeWidth={s.width ?? 2.5}
                strokeDasharray={s.dash}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {s.points.length > 0 && s.dot !== false && (
                <circle cx={gx(s.points[s.points.length - 1].x)} cy={gy(s.points[s.points.length - 1].y)} r="4" fill={s.color} stroke="#0b0b16" strokeWidth="1.5" />
              )}
            </g>
          ))}
          {notes.map((n) => (
            <text
              key={`${n.text}-${n.x}`}
              x={Math.min(W - pad.r - 2, Math.max(pad.l + 2, gx(n.x)))}
              y={gy(n.y)}
              textAnchor={n.anchor ?? 'middle'}
              fontSize="12"
              fontWeight="700"
              fill={n.color ?? '#e2e8f0'}
              stroke="#0b0b16"
              strokeWidth="3"
              paintOrder="stroke"
            >
              {n.text}
            </text>
          ))}
        </svg>
      </div>
      {note && <p className="mt-1 text-xs text-gray-500">{note}</p>}
    </div>
  );
}
