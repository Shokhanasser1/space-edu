import { useId } from 'react';
import { Pause, Play, RotateCcw, Timer } from 'lucide-react';

import { Btn, Segmented, clamp, fmt, groupThousands, useElementSize } from '../kit/ui';

/**
 * Pieces shared by the three labs of the lesson "Suyuqlikning quvurlarda
 * oqishi. Bernulli qonuni": the liquid and pressure colours, number
 * formatting, Start/Pause, the light scene shell with its legend and chips,
 * formula tiles, a profile graph for the dark panel and the quasi-1D pipe
 * (cross-section S(x), volume V(x) and its inverse) that moves the water.
 * No words live here: every label arrives through props from TEXT.
 */

/* ---------------------------------------------------------------- colours */

/** Water (translucent blue) and the colours of the pressure parts. */
export const WATER = {
  fill: '#bae6fd',
  mid: '#7dd3fc',
  deep: '#38bdf8',
  edge: '#0284c7',
  ink: '#0369a1',
  band: '#60a5fa',
};

export const PR = {
  stat: '#2563eb', // static pressure p (the column)
  statBar: '#3b82f6',
  statText: '#93c5fd',
  dyn: '#ea580c', // dynamic pressure ρv²/2
  dynBar: '#f97316',
  dynText: '#fdba74',
  total: '#e2e8f0', // p + ρv²/2
  totalInk: '#334155',
  low: '#2563eb', // pressure below p₀ (field colours)
  high: '#dc2626', // pressure above p₀
};

export const GLASS = { stroke: '#64748b', fill: 'rgba(241,245,249,0.55)' };

/* ---------------------------------------------------------------- numbers */

/** fmt with a true minus sign. */
export function num(n, digits = 1, decimal = '.') {
  return fmt(n, digits, decimal).replace('-', '−');
}

/** A pressure (or force) in whole units, thousands grouped from 10 000 up: 1500 · 101 300. */
export function fmtP(n) {
  const r = Math.round(n);
  const s = Math.abs(r) >= 10000 ? groupThousands(Math.abs(r)) : String(Math.abs(r));
  return r < 0 ? `−${s}` : s;
}

/** Ticks from a to b with a 1/2/2.5/5·10ⁿ step, about `n` of them. */
export function niceTicks(a, b, n = 4) {
  const span = Math.max(1e-9, b - a);
  const raw = span / n;
  const p = 10 ** Math.floor(Math.log10(raw));
  let step = 10 * p;
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * p >= raw) {
      step = m * p;
      break;
    }
  }
  const out = [];
  for (let v = Math.ceil(a / step - 1e-9) * step; v <= b + 1e-9; v += step) out.push(Math.abs(v) < 1e-9 ? 0 : v);
  return { ticks: out, step };
}

/* --------------------------------------------------------------- symbols */

const SUBS = { '₀': '0', '₁': '1', '₂': '2', '₃': '3' };

/** Renders "v₁", "p₀", "S_B" with real subscripts in HTML. */
export function Rich({ children }) {
  if (typeof children !== 'string') return children ?? null;
  const out = [];
  let buf = '';
  const flush = () => {
    if (buf) out.push(buf);
    buf = '';
  };
  for (let i = 0; i < children.length; i += 1) {
    const ch = children[i];
    if (ch === '_' && i + 1 < children.length && /[\p{L}0-9]/u.test(children[i + 1])) {
      flush();
      let j = i + 1;
      let sub = '';
      while (j < children.length && /[\p{L}0-9]/u.test(children[j]) && sub.length < 6) {
        sub += children[j];
        j += 1;
      }
      out.push(
        <sub key={out.length} className="text-[0.72em]">
          {sub}
        </sub>,
      );
      i = j - 1;
    } else if (SUBS[ch]) {
      flush();
      out.push(
        <sub key={out.length} className="text-[0.72em] not-italic">
          {SUBS[ch]}
        </sub>,
      );
    } else buf += ch;
  }
  flush();
  return <>{out}</>;
}

/** Drops the underscore notation for screen readers and SVG text. */
export function plain(s) {
  return String(s ?? '').replace(/_([\p{L}0-9]+)/gu, '$1');
}

/* -------------------------------------------------------------- controls */

/** Start / Pause / Resume + Reset, in the reference's size. */
export function PlayControls({ labels, running, started, onToggle, onReset, resetDisabled, className = '' }) {
  return (
    <div className={`grid grid-cols-2 gap-2 xl:flex ${className}`}>
      <Btn variant="primary" icon={running ? Pause : Play} onClick={onToggle} className="xl:min-w-[148px] min-h-[52px] text-[15px]">
        {running ? labels.pause : started ? labels.resume : labels.start}
      </Btn>
      <Btn icon={RotateCcw} onClick={onReset} disabled={resetDisabled} className="min-h-[52px] text-[15px]">
        {labels.reset}
      </Btn>
    </div>
  );
}

/** Small caption above a group of chips. */
export function GroupLabel({ children }) {
  return <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{children}</p>;
}

/** Time-speed chips: `options` = [{ value, label }]. */
export function SpeedPicker({ label, value, onChange, options }) {
  return (
    <div>
      <p className="mb-1.5 text-sm text-gray-300">{label}</p>
      <Segmented label={label} className="grid-cols-3" value={value} onChange={onChange} accent="#22d3ee" options={options} />
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

export function LegendItem({ color, label, kind = 'line' }) {
  const gid = `lg${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <li className="flex items-center gap-1.5">
      <svg width="20" height="12" aria-hidden="true" className="shrink-0">
        {kind === 'dash' && <line x1="1" y1="6" x2="19" y2="6" stroke={color} strokeWidth="2" strokeDasharray="4 3" />}
        {kind === 'dot' && <circle cx="10" cy="6" r="4" fill={color} />}
        {kind === 'swatch' && <rect x="2" y="1.5" width="16" height="9" rx="2" fill={color} fillOpacity="0.55" stroke={color} strokeWidth="1" />}
        {kind === 'water' && (
          <>
            <rect x="2" y="1.5" width="16" height="9" rx="2" fill={WATER.mid} stroke={WATER.edge} strokeWidth="1" />
            <circle cx="7" cy="6" r="1.4" fill="#fff" />
            <circle cx="13" cy="6" r="1.4" fill="#fff" />
          </>
        )}
        {kind === 'grad' && (
          <>
            <defs>
              <linearGradient id={gid} x1="0" x2="1">
                <stop offset="0" stopColor={PR.low} />
                <stop offset="0.5" stopColor="#f8fafc" />
                <stop offset="1" stopColor={PR.high} />
              </linearGradient>
            </defs>
            <rect x="1" y="2" width="18" height="8" rx="2" fill={`url(#${gid})`} stroke="#cbd5e1" strokeWidth="0.8" />
          </>
        )}
        {(kind === 'line' || kind === 'arrow') && (
          <line x1="1" y1="6" x2={kind === 'arrow' ? 13 : 19} y2="6" stroke={color} strokeWidth="3" strokeLinecap="round" />
        )}
        {kind === 'arrow' && <path d="M19,6 L12,2 L12,10 Z" fill={color} />}
      </svg>
      <span>
        <Rich>{label}</Rich>
      </span>
    </li>
  );
}

/** A chip in the scene's top-right corner (time slow-down, scale …). */
export function Chip({ icon: Icon = Timer, children, color = '#0891b2', className = 'flex' }) {
  return (
    <span className={`${className} items-center gap-1.5 rounded-xl border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[11px] sm:text-[12px] font-medium tabular-nums text-slate-600 shadow-sm`}>
      {Icon && <Icon size={14} style={{ color }} aria-hidden="true" />}
      <span>
        <Rich>{children}</Rich>
      </span>
    </span>
  );
}

/**
 * The light scene panel of the chosen design. `height(W, narrow)` sizes the
 * drawing; `children(W, H, narrow)` draws it. The legend floats over the top
 * from `sm` up and moves under the scene on phones.
 */
export function LabScene({ legend = [], chips, height, ariaLabel, children, minW = 280, className = '', footer }) {
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, minW);
  const narrow = W < 560;
  const H = Math.round(typeof height === 'function' ? height(W, narrow) : height);
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-300/70 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_30px_-12px_rgba(0,0,0,0.6)] ${className}`}
    >
      <div ref={ref} className="w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="cl-scene block select-none">
          {width > 0 && children(W, H, narrow)}
        </svg>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 sm:p-3">
        {legend.length > 0 && (
          <ul className="hidden sm:flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-[12px] text-slate-600 shadow-sm backdrop-blur max-w-[70%]">
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

/** A formula with its numbers put in: a coloured tag, the general form, the substituted line. */
export function FormulaTile({ tag, color = '#22d3ee', general, filled, ok }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 transition-colors ${ok ? 'bg-emerald-400/[0.06]' : 'bg-black/25'}`}
      style={{ borderColor: ok ? 'rgba(52,211,153,0.45)' : 'rgba(255,255,255,0.08)' }}
    >
      {tag && (
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden="true" />
          <span>
            <Rich>{tag}</Rich>
          </span>
        </p>
      )}
      <p className="mt-1 font-serif text-[15px] italic text-gray-200">
        <Rich>{general}</Rich>
      </p>
      {filled && (
        <p className="mt-0.5 text-[13px] tabular-nums text-gray-400">
          <Rich>{filled}</Rich>
        </p>
      )}
    </div>
  );
}

/** A compact key–value box for the controls panel. */
export function InfoBox({ title, rows }) {
  return (
    <div className="rounded-xl bg-black/25 px-3 py-2.5">
      {title && <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{title}</p>}
      <dl className="mt-1.5 space-y-1">
        {rows.map(([k, v, c]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 text-[13px]">
            <dt className="text-gray-400 leading-snug">
              <Rich>{k}</Rich>
            </dt>
            <dd className="shrink-0 font-semibold tabular-nums" style={{ color: c ?? '#e5e7eb' }}>
              <Rich>{v}</Rich>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ----------------------------------------------------------------- graph */

/**
 * A line graph for the dark panel. `series` = [{ id, color, points: [{x,y}],
 * dash, width }]; `fills` = [{ id, upper: points, lower: points, color,
 * opacity }] shades between two curves; `markers` = [{ x, label }] dashed
 * verticals; `dots` = [{ id, x, y, color }].
 */
export function LineGraph({
  title,
  legend = [],
  series,
  fills = [],
  markers = [],
  dots = [],
  xMin = 0,
  xMax,
  yMin = 0,
  yMax,
  xLabel,
  yLabel,
  note,
  height = 210,
  decimal = '.',
  ariaLabel,
  xDigits,
  yDigits,
  xTickCount = 5,
}) {
  const [ref, { width }] = useElementSize();
  const H = height;
  const pad = { l: 50, r: 14, t: 22, b: 26 };
  const W = Math.max(width, 220);
  const gx = (v) => pad.l + ((v - xMin) / (xMax - xMin)) * (W - pad.l - pad.r);
  const gy = (v) => H - pad.b - ((v - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
  const yt = niceTicks(yMin, yMax, 4);
  const xt = niceTicks(xMin, xMax, xTickCount);
  const yd = yDigits ?? (yt.step < 1 ? (yt.step < 0.1 ? 2 : 1) : 0);
  const xd = xDigits ?? (xt.step < 1 ? (xt.step < 0.1 ? 2 : 1) : 0);
  const clipId = `lg-clip-${String(title ?? 'g').length}-${Math.round(W)}-${Math.round(H)}`;
  const line = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${gx(p.x).toFixed(1)},${gy(clamp(p.y, yMin - (yMax - yMin), yMax + (yMax - yMin))).toFixed(1)}`).join('');
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {title && (
          <p className="text-sm font-semibold text-gray-200">
            <Rich>{title}</Rich>
          </p>
        )}
        {legend.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-xs text-gray-400">
            <span
              className="w-4 rounded"
              style={s.dash ? { borderTop: `2px dashed ${s.color}`, height: 0 } : s.swatch ? { background: s.color, opacity: 0.6, height: 8 } : { background: s.color, height: 2 }}
              aria-hidden="true"
            />
            <span>
              <Rich>{s.label}</Rich>
            </span>
          </span>
        ))}
      </div>
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel ?? plain(title)} className="block overflow-visible">
          <defs>
            <clipPath id={clipId}>
              <rect x={pad.l} y={pad.t - 4} width={W - pad.l - pad.r} height={H - pad.t - pad.b + 8} />
            </clipPath>
          </defs>
          {yt.ticks.map((v) => (
            <g key={`y${v}`}>
              <line x1={pad.l} x2={W - pad.r} y1={gy(v)} y2={gy(v)} stroke={v === 0 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.08)'} />
              <text x={pad.l - 6} y={gy(v) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                {Math.abs(v) >= 10000 ? fmtP(v) : num(v, yd, decimal)}
              </text>
            </g>
          ))}
          {xt.ticks.map((v) => (
            <text key={`x${v}`} x={gx(v)} y={H - 6} textAnchor="middle" fontSize="11" fill="#94a3b8">
              {num(v, xd, decimal)}
            </text>
          ))}
          {xLabel && (
            <text x={W - pad.r} y={H - pad.b - 6} textAnchor="end" fontSize="11" fill="#64748b">
              {xLabel}
            </text>
          )}
          {yLabel && (
            <text x={pad.l + 6} y={pad.t - 8} fontSize="11" fill="#64748b">
              {yLabel}
            </text>
          )}
          <line x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.2)" />
          {markers.map((m) => (
            <g key={`m${m.x}`}>
              <line x1={gx(m.x)} x2={gx(m.x)} y1={pad.t} y2={H - pad.b} stroke={m.color ?? 'rgba(34,211,238,0.4)'} strokeDasharray="3 4" />
              {m.label && (
                <text x={gx(m.x)} y={pad.t - 8} textAnchor="middle" fontSize="11" fontWeight="700" fill={m.color ?? '#67e8f9'}>
                  {m.label}
                </text>
              )}
            </g>
          ))}
          <g clipPath={`url(#${clipId})`}>
            {fills.map((f) =>
              f.upper.length > 1 ? (
                <path
                  key={f.id}
                  d={`${line(f.upper)}${f.lower
                    .slice()
                    .reverse()
                    .map((p) => `L${gx(p.x).toFixed(1)},${gy(p.y).toFixed(1)}`)
                    .join('')}Z`}
                  fill={f.color}
                  opacity={f.opacity ?? 0.2}
                />
              ) : null,
            )}
            {series.map((s) =>
              s.points.length > 1 ? (
                <path
                  key={s.id}
                  d={line(s.points)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={s.width ?? 2.5}
                  strokeDasharray={s.dash}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null,
            )}
          </g>
          {dots.map((d) => (
            <circle key={d.id} cx={gx(d.x)} cy={gy(clamp(d.y, yMin, yMax))} r="4.5" fill={d.color} stroke="#0b0b16" strokeWidth="1.5" />
          ))}
        </svg>
      </div>
      {note && (
        <p className="mt-1 text-xs leading-snug text-gray-500">
          <Rich>{note}</Rich>
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ pipe */

/**
 * A pipe made of straight pieces and cones: `parts` = [{ len, S0, S1 }]
 * (metres, m²); along a cone the radius changes linearly. Returns S(x), the
 * radius relative to √Sref, the volume V(x) from the inlet, its inverse
 * xOfV(V), the total length L and volume Vtot. A water particle that has
 * travelled the volume V (= ∫Q dt) since the inlet is at x = xOfV(V), so
 * every particle moves at v = Q/S(x) — the continuity law built in.
 */
export function makePipe(parts, Sref, n = 720) {
  const L = parts.reduce((a, p) => a + p.len, 0);
  const S = (x) => {
    let x0 = 0;
    for (let i = 0; i < parts.length; i += 1) {
      const p = parts[i];
      if (x <= x0 + p.len || i === parts.length - 1) {
        const f = clamp((x - x0) / p.len, 0, 1);
        const r0 = Math.sqrt(p.S0);
        const r1 = Math.sqrt(p.S1);
        const r = r0 + (r1 - r0) * f;
        return r * r;
      }
      x0 += p.len;
    }
    return parts[parts.length - 1].S1;
  };
  return makeProfile(S, L, Sref, n);
}

/**
 * The same bookkeeping for any cross-section (or, in a flat picture, any
 * width) w(x) on 0 ≤ x ≤ L: volume V(x) = ∫w dx and its inverse.
 */
export function makeProfile(S, L, Sref = 1, n = 720) {
  const xs = new Float64Array(n + 1);
  const Vs = new Float64Array(n + 1);
  let V = 0;
  for (let i = 0; i <= n; i += 1) {
    if (i > 0) V += S((L * (i - 0.5)) / n) * (L / n);
    xs[i] = (L * i) / n;
    Vs[i] = V;
  }
  const vOf = (x) => {
    const f = clamp(x / L, 0, 1) * n;
    const i = Math.min(n - 1, Math.floor(f));
    return Vs[i] + (Vs[i + 1] - Vs[i]) * (f - i);
  };
  const xOfV = (v) => {
    const t = clamp(v, 0, V);
    let lo = 0;
    let hi = n;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (Vs[m] <= t) lo = m;
      else hi = m;
    }
    const d = Vs[hi] - Vs[lo] || 1e-12;
    return xs[lo] + ((t - Vs[lo]) / d) * (xs[hi] - xs[lo]);
  };
  const rRel = (x) => Math.sqrt(S(x) / Sref);
  return { L, S, rRel, V: vOf, xOfV, Vtot: V };
}

/** Wall outline of a pipe as screen points: top from inlet to outlet, then bottom back. */
export function pipeOutline(pipe, sx, sy, axisY, Rpx, from = 0, to = pipe.L, n = 160) {
  const top = [];
  const bot = [];
  for (let i = 0; i <= n; i += 1) {
    const x = from + ((to - from) * i) / n;
    const r = pipe.rRel(x) * Rpx;
    top.push([sx(x), sy(axisY) - r]);
    bot.push([sx(x), sy(axisY) + r]);
  }
  return { top, bot };
}

export const pts = (arr) => arr.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
