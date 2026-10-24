import { Check, Pause, Play, RotateCcw, Timer } from 'lucide-react';

import { Btn, Segmented, fmt, niceStep, textWidth, useElementSize } from '../kit/ui';

/**
 * Pieces shared by the three labs of the lesson "To'liq mexanik energiyaning
 * saqlanish qonuni" (EnergyConservation): the energy colours, Start/Pause,
 * the light scene shell, formula tiles, the energy-bar column with its
 * constant-total line and an energy–position graph. No words live here:
 * every label arrives through props from the lesson's TEXT table.
 */

/** Colours of the energies — the same in every tab of the lesson. */
export const EN = {
  ek: '#059669', // kinetic energy (green, like the velocity)
  ekBar: '#10b981',
  ekText: '#6ee7b7',
  ep: '#2563eb', // potential energy (blue)
  epBar: '#3b82f6',
  epText: '#93c5fd',
  heat: '#ea580c', // heat Q (orange)
  heatBar: '#f97316',
  heatText: '#fdba74',
  total: '#e2e8f0', // total mechanical energy (white / gray)
  totalInk: '#334155',
  weight: '#dc2626',
  body: '#db2777',
};

/* ---------------------------------------------------------------- numbers */

/** fmt with a true minus sign. */
export function num(n, digits = 1, decimal = '.') {
  return fmt(n, digits, decimal).replace('-', '−');
}

/** An energy in joules with sensible precision (2450 · 49.0 · 4.90). */
export function fmtE(v, decimal = '.') {
  const a = Math.abs(v);
  return fmt(v, a >= 100 ? 0 : a >= 10 ? 1 : 2, decimal);
}

/** "Nice" value ≥ v from the 1 / 2 / 2.5 / 5 × 10ⁿ series. */
export function niceCeil(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v - 1e-9) return m * p;
  return 10 * p;
}

/**
 * Chooses the sentence under a running scene. Every sentence stays at least
 * `minShow` seconds of real time, so a fast swing cannot flicker through
 * them. An event (lowest point, turning point …) that happens meanwhile
 * waits — only the latest one — and is dropped if it grows older than
 * `fresh` s; otherwise the motion phase (`phase.k`) is shown. `final`
 * (stopped, landed) replaces everything at once. Returns `msg` itself when
 * nothing changes, so a key built from it stays stable.
 */
export function schedule(msg, { wall, event, phase, final, minShow = 2.5, fresh = 1.2 }) {
  if (final) return msg && msg.k === final.k && msg.final ? msg : { ...final, final: true, wall, pending: null };
  if (msg?.final) return msg;
  let pending = msg?.pending ?? null;
  if (event) pending = { ...event, event: true, at: wall };
  if (msg && wall - msg.wall < minShow) return pending === (msg.pending ?? null) ? msg : { ...msg, pending };
  if (pending && wall - pending.at <= fresh) return { ...pending, wall, pending: null };
  if (msg && !msg.event && msg.k === phase.k) return msg.pending ? { ...msg, pending: null } : msg;
  return { ...phase, wall, pending: null };
}

/** Drops the underscore of E_k / E_p for screen readers. */
export function plain(s) {
  return String(s ?? '')
    .replace(/_(\w)/g, '$1')
    .replace(/₀/g, '0');
}

/* --------------------------------------------------------------- symbols */

const SUBS = { '₀': '0', '₁': '1', '₂': '2' };

/** Renders "E_k", "E_p", "v₀" with real subscripts in HTML. */
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
    if (ch === '_' && i + 1 < children.length && /[a-zA-Z0-9]/.test(children[i + 1])) {
      flush();
      out.push(
        <sub key={out.length} className="text-[0.72em]">
          {children[i + 1]}
        </sub>,
      );
      i += 1;
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

/** The SVG twin of Rich: subscripts as shifted <tspan>s. Put inside a <text>. */
export function SvgRich({ text, fs = 12 }) {
  const s = String(text ?? '');
  const out = [];
  let buf = '';
  let shifted = false;
  const flush = () => {
    if (!buf) return;
    out.push(
      <tspan key={out.length} dy={shifted ? -fs * 0.28 : undefined}>
        {buf}
      </tspan>,
    );
    shifted = false;
    buf = '';
  };
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    const sub = ch === '_' && i + 1 < s.length && /[a-zA-Z0-9]/.test(s[i + 1]) ? s[i + 1] : SUBS[ch];
    if (sub) {
      flush();
      out.push(
        <tspan key={out.length} dy={shifted ? 0 : fs * 0.28} fontSize={fs * 0.74}>
          {sub}
        </tspan>,
      );
      shifted = true;
      if (ch === '_') i += 1;
    } else buf += ch;
  }
  if (buf) flush();
  else if (shifted) out.push(<tspan key={out.length} dy={-fs * 0.28} />);
  return <>{out}</>;
}

/* -------------------------------------------------------------- controls */

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

/** An on/off switch drawn like the Segmented chips (aria-pressed). */
export function ToggleChip({ label, sub, on, onChange, accent = '#fb923c' }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      style={on ? { borderColor: `${accent}99`, background: `${accent}1f` } : undefined}
      className={`flex w-full min-h-11 items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 ${
        on ? 'text-white' : 'border-white/10 bg-white/[0.035] text-gray-300 hover:bg-white/[0.08]'
      }`}
    >
      <span
        className="grid h-5 w-5 shrink-0 place-items-center rounded-md border"
        style={on ? { background: accent, borderColor: accent } : { borderColor: 'rgba(255,255,255,0.3)' }}
        aria-hidden="true"
      >
        {on && <Check size={14} strokeWidth={3} className="text-slate-950" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-tight">{label}</span>
        {sub && <span className="mt-0.5 block text-[11px] leading-tight text-gray-400">{sub}</span>}
      </span>
    </button>
  );
}

/** ×1 / ×½ / ×¼ time-speed chips. */
export function SpeedPicker({ label, value, onChange }) {
  return (
    <div>
      <p className="mb-1.5 text-sm text-gray-300">{label}</p>
      <Segmented
        label={label}
        className="grid-cols-3"
        value={value}
        onChange={onChange}
        accent="#22d3ee"
        options={[
          { value: 1, label: '×1' },
          { value: 0.5, label: '×½' },
          { value: 0.25, label: '×¼' },
        ]}
      />
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
        {kind === 'ring' && <circle cx="10" cy="5" r="3.5" fill="#fff" stroke={color} strokeWidth="2" />}
        {kind === 'dim' && (
          <>
            <line x1="10" y1="1" x2="10" y2="9" stroke={color} strokeWidth="2" />
            <line x1="6" y1="1" x2="14" y2="1" stroke={color} strokeWidth="1.5" />
            <line x1="6" y1="9" x2="14" y2="9" stroke={color} strokeWidth="1.5" />
          </>
        )}
        {(kind === 'line' || kind === 'arrow') && (
          <line x1="1" y1="5" x2={kind === 'arrow' ? 13 : 19} y2="5" stroke={color} strokeWidth="3" strokeLinecap="round" />
        )}
        {kind === 'arrow' && <path d="M19,5 L12,1 L12,9 Z" fill={color} />}
      </svg>
      <span>
        <Rich>{label}</Rich>
      </span>
    </li>
  );
}

/** A chip in the scene's top-right corner (time slow-down, friction …). */
export function Chip({ icon: Icon = Timer, children, color = '#0891b2' }) {
  return (
    <span className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[11px] sm:text-[12px] font-medium tabular-nums text-slate-600 shadow-sm">
      {Icon && <Icon size={14} style={{ color }} aria-hidden="true" />}
      {children}
    </span>
  );
}

/**
 * The light scene panel of the chosen design. `height(W, narrow)` sizes the
 * drawing; `children(W, H, narrow)` draws it. The legend floats over the top
 * from `sm` up and moves under the scene on phones.
 */
export function LabScene({ legend = [], chips, height, ariaLabel, children, minW = 280, className = '' }) {
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

/* ----------------------------------------------------------- energy bars */

/**
 * The energy column beside a scene: one vertical bar per energy, the total
 * E = E_k + E_p drawn stacked (blue + green), and a dashed line at the
 * starting energy E₀ that the total stays on while nothing but gravity does
 * work. `bars` = [{ id, sym, value, color, textColor, stack?: [{ value, color }] }].
 * Fills the height its grid row gives it (at least `minH`).
 */
export function EnergyBars({ title, bars, e0, e0Label, unit, decimal, note, ariaLabel, minH = 230 }) {
  const [ref, { width, height }] = useElementSize();
  const W = Math.max(width, 180);
  const H = Math.max(height, minH);
  const fs = 12;
  const pad = { l: 6, r: 6, t: 40, b: 30 };
  const yMax = Math.max(e0, ...bars.map((b) => b.value), 1e-9) * 1.12;
  const gy = (v) => H - pad.b - (Math.max(0, v) / yMax) * (H - pad.t - pad.b);
  const slot = (W - pad.l - pad.r) / bars.length;
  const bw = Math.min(44, slot * 0.6);
  const y0 = gy(0);
  const yE0 = gy(e0);
  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
      <p className="text-sm font-semibold text-gray-200">{title}</p>
      <div ref={ref} className="relative mt-1 w-full flex-1" style={{ minHeight: minH }}>
        {width > 0 && (
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="absolute inset-0 block overflow-visible">
            <line x1={pad.l} x2={W - pad.r} y1={y0} y2={y0} stroke="rgba(255,255,255,0.3)" />
            {bars.map((b, i) => {
              const cx = pad.l + slot * (i + 0.5);
              const top = gy(b.value);
              const segs = b.stack ?? [{ value: b.value, color: b.color }];
              let acc = 0;
              return (
                <g key={b.id}>
                  <rect x={cx - bw / 2} y={gy(yMax / 1.12)} width={bw} height={y0 - gy(yMax / 1.12)} rx={6} fill="rgba(255,255,255,0.04)" />
                  {segs.map((sg, j) => {
                    const yA = gy(acc);
                    acc += Math.max(0, sg.value);
                    const yB = gy(acc);
                    return yA - yB > 0.3 ? <rect key={j} x={cx - bw / 2} y={yB} width={bw} height={yA - yB} fill={sg.color} /> : null;
                  })}
                  {b.stack && y0 - top > 1 && (
                    <rect x={cx - bw / 2} y={top} width={bw} height={y0 - top} fill="none" stroke="#f8fafc" strokeWidth={1.5} rx={2} />
                  )}
                  <text x={cx} y={Math.min(top, y0) - 7} textAnchor="middle" fontSize={fs - 0.5} fontWeight="700" fill={b.textColor ?? '#fff'} className="tabular-nums">
                    {fmtE(b.value, decimal)}
                  </text>
                  <text x={cx} y={H - 9} textAnchor="middle" fontSize={fs + 2} fontStyle="italic" fontWeight="700" fill={b.textColor ?? '#e2e8f0'} fontFamily="serif">
                    <SvgRich text={b.sym} fs={fs + 2} />
                  </text>
                </g>
              );
            })}
            {/* constant-total line */}
            <line x1={pad.l} x2={W - pad.r} y1={yE0} y2={yE0} stroke="#f8fafc" strokeWidth={1.5} strokeDasharray="6 4" opacity="0.85" />
            <text x={W - pad.r} y={14} textAnchor="end" fontSize={fs - 1} fontWeight="600" fill="#cbd5e1">
              <SvgRich text={e0Label} fs={fs - 1} />
            </text>
            <line
              x1={W - pad.r - textWidth(plain(e0Label), fs - 1, 600) - 26}
              x2={W - pad.r - textWidth(plain(e0Label), fs - 1, 600) - 6}
              y1={10}
              y2={10}
              stroke="#f8fafc"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
            <text x={pad.l} y={14} fontSize={fs - 1} fill="#64748b">
              {unit}
            </text>
          </svg>
        )}
      </div>
      {note && (
        <p className="mt-1 text-xs leading-snug text-gray-500">
          <Rich>{note}</Rich>
        </p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- energy graph */

/**
 * An energy–position graph for the dark panel: x may run below zero (a
 * pendulum swinging both ways). `series` = [{ id, color, points: [{x,y}|null],
 * dash, width, opacity }] — a null breaks the line; `dots` mark the present.
 */
export function EnergyGraph({
  title,
  legend = [],
  series,
  dots = [],
  xMin = 0,
  xMax,
  yMax,
  xLabel,
  yLabel,
  note,
  height = 210,
  decimal = '.',
  ariaLabel,
  marker,
}) {
  const [ref, { width }] = useElementSize();
  const H = height;
  const pad = { l: 48, r: 14, t: 20, b: 26 };
  const W = Math.max(width, 220);
  const gx = (v) => pad.l + ((v - xMin) / (xMax - xMin)) * (W - pad.l - pad.r);
  const gy = (v) => H - pad.b - (v / yMax) * (H - pad.t - pad.b);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);
  const xStep = niceStep((W - pad.l - pad.r) / (xMax - xMin), 54);
  const xTicks = [];
  for (let v = Math.ceil(xMin / xStep - 1e-9) * xStep; v <= xMax + 1e-9; v += xStep) xTicks.push(v);
  const xDigits = xStep < 1 ? (xStep < 0.1 ? 2 : 1) : 0;
  const yDigits = yMax / 4 < 1 ? 2 : yMax / 4 < 10 ? 1 : 0;
  const clipId = `eg-clip-${String(title ?? 'g').length}-${Math.round(W)}`;
  const pathOf = (pts) => {
    let d = '';
    let pen = false;
    for (const p of pts) {
      if (!p) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${gx(p.x).toFixed(1)},${gy(p.y).toFixed(1)}`;
      pen = true;
    }
    return d;
  };
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
              style={s.dash ? { borderTop: `2px dashed ${s.color}`, height: 0 } : { background: s.color, height: 2 }}
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
              <rect x={pad.l} y={pad.t - 6} width={W - pad.l - pad.r} height={H - pad.t - pad.b + 6} />
            </clipPath>
          </defs>
          {yTicks.map((v) => (
            <g key={`y${v}`}>
              <line x1={pad.l} x2={W - pad.r} y1={gy(v)} y2={gy(v)} stroke={v === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'} />
              <text x={pad.l - 6} y={gy(v) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                {fmt(v, yDigits, decimal)}
              </text>
            </g>
          ))}
          {xTicks.map((v) => (
            <g key={`x${v}`}>
              <line x1={gx(v)} x2={gx(v)} y1={pad.t} y2={H - pad.b} stroke={Math.abs(v) < 1e-9 && xMin < 0 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.05)'} />
              <text x={gx(v)} y={H - 6} textAnchor="middle" fontSize="11" fill="#94a3b8">
                {num(v, xDigits, decimal)}
              </text>
            </g>
          ))}
          {xLabel && (
            <text x={W - pad.r} y={H - pad.b - 6} textAnchor="end" fontSize="11" fill="#64748b">
              {xLabel}
            </text>
          )}
          {yLabel && (
            <text x={pad.l + 6} y={pad.t - 7} fontSize="11" fill="#64748b">
              {yLabel}
            </text>
          )}
          <line x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.2)" />
          {marker !== undefined && marker !== null && (
            <line x1={gx(marker)} x2={gx(marker)} y1={pad.t} y2={H - pad.b} stroke="rgba(34,211,238,0.45)" strokeDasharray="3 4" />
          )}
          <g clipPath={`url(#${clipId})`}>
            {series.map((s) => (
              <path
                key={s.id}
                d={pathOf(s.points)}
                fill="none"
                stroke={s.color}
                strokeWidth={s.width ?? 2.5}
                strokeDasharray={s.dash}
                opacity={s.opacity ?? 1}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
          </g>
          {dots.map((d) => (
            <circle key={d.id} cx={gx(d.x)} cy={gy(Math.min(d.y, yMax))} r="4.5" fill={d.color} stroke="#0b0b16" strokeWidth="1.5" />
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
