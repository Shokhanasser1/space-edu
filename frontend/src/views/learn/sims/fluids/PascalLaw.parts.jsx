import { useCallback, useSyncExternalStore } from 'react';
import { Pause, Play, RotateCcw, Ruler, Timer } from 'lucide-react';

import { Arrow, Btn, RangeField, clamp, fmt, groupThousands, textWidth, useElementSize } from '../kit/ui';

/**
 * Pieces shared by the three labs of the lesson "Pressure. Pascal's law":
 * number formatting for pressures and areas that span ten orders of
 * magnitude, a logarithmic slider, the light scene shell with its legend and
 * chips, arrows that are broken when they would be too long to draw, and the
 * dark panels. No words live here — every label arrives through props from
 * the lesson's TEXT table.
 */

export const G = 9.8; // m/s²

/** Colours of the lesson's quantities (the kit's PALETTE plus pressure). */
export const COL = {
  force: '#dc2626', // force F
  forceText: '#fca5a5',
  press: '#ea580c', // pressure p, Δp (arrows perpendicular to the surface)
  pressText: '#fdba74',
  area: '#7c3aed', // support area S
  areaText: '#c4b5fd',
  depth: '#0f766e', // sinking depth, volume
  depthText: '#5eead4',
  gas: '#2563eb', // molecules, hits
  gasText: '#93c5fd',
  ink: '#0f172a',
  muted: '#64748b',
};

/** True while the media query matches (subscribed with matchMedia, cleaned up on unmount). */
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/* ------------------------------------------------------------- numbers */

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

/** `n` to `digits` significant figures, trailing zeros dropped, thousands grouped. */
export function sig(n, digits = 3, decimal = '.') {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  const r = Number(n.toPrecision(digits));
  if (Math.abs(r) >= 1000) return groupThousands(r);
  let s = r.toFixed(Math.max(0, digits - 1 - Math.floor(Math.log10(Math.abs(r)))));
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return decimal === '.' ? s : s.replace('.', decimal);
}

/** "2·10⁸" — scientific notation with superscript digits. */
export function sci(n, digits = 3, decimal = '.') {
  if (!Number.isFinite(n) || n <= 0) return '—';
  let e = Math.floor(Math.log10(n));
  let m = Number((n / 10 ** e).toPrecision(digits));
  if (m >= 10) {
    m /= 10;
    e += 1;
  }
  const exp = String(e)
    .split('')
    .map((c) => SUP[c] ?? c)
    .join('');
  return `${sig(m, digits, decimal)}·10${exp}`;
}

/** Rounds to `digits` significant figures (for slider values). */
export function roundSig(v, digits = 2) {
  if (!Number.isFinite(v) || v === 0) return v;
  return Number(v.toPrecision(digits));
}

/**
 * A pressure in its best unit: { v, u, pa } — the number, the unit and, for
 * kPa and above, the same value in pascals ("= 14 700 Pa").
 */
export function pressureParts(p, T) {
  const dec = T.decimal;
  if (p < 10000) return { v: p < 100 ? sig(p, 3, dec) : groupThousands(p), u: T.Pa, pa: null };
  if (p < 1e6) return { v: sig(p / 1e3, 3, dec), u: T.kPa, pa: `${groupThousands(p)} ${T.Pa}` };
  if (p < 1e9) return { v: sig(p / 1e6, 3, dec), u: T.MPa, pa: `${sci(p, 3, dec)} ${T.Pa}` };
  return { v: sig(p / 1e9, 3, dec), u: T.GPa, pa: `${sci(p, 3, dec)} ${T.Pa}` };
}

/** "3 920 Pa", "14.7 kPa", "200 MPa". */
export function fmtP(p, T) {
  const x = pressureParts(p, T);
  return `${x.v} ${x.u}`;
}

/** An area in square metres ("0.02", "1·10⁻⁸") and the same in cm² or mm² ("200 sm²"). */
export function areaParts(S, T) {
  const dec = T.decimal;
  const v = S >= 1e-4 ? sig(S, 3, dec) : sci(S, 2, dec);
  let alt = null;
  if (S >= 1e-4 && S < 1) alt = `${sig(S * 1e4, 3, dec)} ${T.cm2}`;
  else if (S < 1e-4) alt = `${sig(S * 1e6, 3, dec)} ${T.mm2}`;
  return { v, u: T.m2, alt };
}

/** "0.02 m²" or "200 sm²" — the handier of the two for labels. */
export function fmtSshort(S, T) {
  const a = areaParts(S, T);
  return a.alt && S < 0.1 ? a.alt : `${a.v} ${a.u}`;
}

/** "19.6 N", "392 kN". */
export function fmtF(F, T) {
  return F < 1000 ? `${sig(F, 3, T.decimal)} ${T.N}` : `${sig(F / 1000, 3, T.decimal)} ${T.kN}`;
}

/** A depth in cm (or mm below 1 cm). */
export function fmtDepth(h, T) {
  if (h >= 0.01) return `${sig(h * 100, 2, T.decimal)} ${T.cm}`;
  return `${sig(h * 1000, 2, T.decimal)} ${T.mm}`;
}

/** fmt with a true minus sign. */
export function num(n, digits = 1, decimal = '.') {
  return fmt(n, digits, decimal).replace('-', '−');
}

/** "раз" / "раза" after a number in Russian. */
export function raz(k) {
  const n = Number(String(k).replace(',', '.').replace(/\s/g, ''));
  if (!Number.isInteger(n)) return 'раза';
  const d = n % 10;
  const dd = n % 100;
  return d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? 'раза' : 'раз';
}

/* ------------------------------------------------------------ symbols */

/** Splits "p_{0}V_{0}" into plain and subscript runs. */
function splitSym(text) {
  const out = [];
  const re = /_\{([^}]*)\}/g;
  let last = 0;
  let m = re.exec(text);
  while (m) {
    if (m.index > last) out.push({ t: text.slice(last, m.index) });
    out.push({ t: m[1], sub: true });
    last = re.lastIndex;
    m = re.exec(text);
  }
  if (last < text.length) out.push({ t: text.slice(last) });
  return out;
}

/** HTML text with `_{…}` subscripts. */
export function Sym({ children }) {
  if (typeof children !== 'string') return children ?? null;
  return (
    <>
      {splitSym(children).map((p, i) =>
        p.sub ? (
          <sub key={i} className="text-[0.72em] not-italic">
            {p.t}
          </sub>
        ) : (
          <span key={i}>{p.t}</span>
        ),
      )}
    </>
  );
}

/* ------------------------------------------------------------- controls */

/**
 * A slider on a logarithmic scale (for quantities that span decades). The
 * thumb position runs 0…1000; the value is rounded to `digits` significant
 * figures. Presets can still set any value inside [min, max].
 */
export function LogRange({ id, label, symbol, value, min, max, onChange, display, accent, hint, digits = 2 }) {
  const pos = clamp((1000 * Math.log(value / min)) / Math.log(max / min), 0, 1000);
  return (
    <RangeField
      id={id}
      label={label}
      symbol={symbol}
      min={0}
      max={1000}
      step={1}
      value={Math.round(pos)}
      display={display}
      valueText={display}
      accent={accent}
      hint={hint}
      onChange={(u) => onChange(clamp(roundSig(min * (max / min) ** (u / 1000), digits), min, max))}
    />
  );
}

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

/** Small caption above a group of controls. */
export function GroupLabel({ children }) {
  return <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{children}</p>;
}

/** The dark panel that holds sliders, graphs and notes. */
export function Panel({ children, className = '' }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4 ${className}`}>{children}</div>;
}

/** A small "title + three numbers" box for the dark panels. `items` = [[term, value, colour]]. */
export function InfoBox({ title, items, children, cols = 3 }) {
  return (
    <div className="rounded-xl bg-black/25 px-3 py-2.5">
      {title && <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{title}</p>}
      <dl className={`mt-1.5 grid gap-2 text-center ${cols === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {items.map(([k, val, c]) => (
          <div key={k}>
            <dt className="text-[11px] leading-tight text-gray-500">
              <Sym>{k}</Sym>
            </dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums" style={{ color: c }}>
              <Sym>{val}</Sym>
            </dd>
          </div>
        ))}
      </dl>
      {children}
    </div>
  );
}

/**
 * The formula line of a panel: p = F / S, then the same with numbers and the
 * result — written large, in the serif italic of the reference.
 */
export function Formula({ sym, nums, result, resultColor = COL.pressText, note }) {
  return (
    <div className="rounded-xl bg-black/25 px-3 py-2.5">
      <p className="font-serif text-[17px] italic text-gray-100">
        <Sym>{sym}</Sym>
      </p>
      <p className="mt-1 text-[13.5px] tabular-nums text-gray-400">
        <Sym>{nums}</Sym>{' '}
        <b style={{ color: resultColor }}>
          <Sym>{result}</Sym>
        </b>
      </p>
      {note && <p className="mt-1.5 text-[11px] leading-snug text-gray-500">{note}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

function LegendItem({ color, label, kind = 'line' }) {
  return (
    <li className="flex items-center gap-1.5">
      <svg width="20" height="12" aria-hidden="true" className="shrink-0">
        {(kind === 'line' || kind === 'arrow') && (
          <line x1="1" y1="6" x2={kind === 'arrow' ? 13 : 19} y2="6" stroke={color} strokeWidth="3" strokeLinecap="round" />
        )}
        {kind === 'arrow' && <path d="M19,6 L12,2 L12,10 Z" fill={color} />}
        {kind === 'arrows' && (
          <>
            {[4, 10, 16].map((x) => (
              <g key={x}>
                <line x1={x} y1="1" x2={x} y2="7" stroke={color} strokeWidth="1.6" />
                <path d={`M${x},11 L${x - 2.4},6.5 L${x + 2.4},6.5 Z`} fill={color} />
              </g>
            ))}
          </>
        )}
        {kind === 'dot' && <circle cx="10" cy="6" r="4.5" fill={color} />}
        {kind === 'ring' && <circle cx="10" cy="6" r="4" fill="none" stroke={color} strokeWidth="2" />}
        {kind === 'jet' && (
          <>
            <path d="M1,6 L14,4.5 L14,7.5 Z" fill={color} />
            <circle cx="17" cy="6" r="1.6" fill={color} />
          </>
        )}
        {kind === 'fill' && <rect x="2" y="2" width="16" height="8" rx="2" fill={color} />}
        {kind === 'dim' && (
          <>
            <line x1="10" y1="1" x2="10" y2="11" stroke={color} strokeWidth="1.8" />
            <line x1="6" y1="1" x2="14" y2="1" stroke={color} strokeWidth="1.5" />
            <line x1="6" y1="11" x2="14" y2="11" stroke={color} strokeWidth="1.5" />
          </>
        )}
      </svg>
      <span>
        <Sym>{label}</Sym>
      </span>
    </li>
  );
}

/** A chip in the scene's top-right corner (time, scale…). */
export function Chip({ icon: Icon = Timer, children, color = '#0891b2' }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[11px] sm:text-[12px] font-medium tabular-nums text-slate-600 shadow-sm">
      {Icon && <Icon size={14} style={{ color }} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** A scale chip: a bar of `px` pixels standing for `text`. */
export function ScaleChip({ px, text, label, color = COL.press }) {
  return (
    <Chip icon={Ruler} color={color}>
      {label}
      <svg width={px + 4} height="10" aria-hidden="true" className="shrink-0">
        <line x1="2" y1="5" x2={px + 2} y2="5" stroke={color} strokeWidth="2.5" />
        <line x1="2" y1="1" x2="2" y2="9" stroke={color} strokeWidth="1.5" />
        <line x1={px + 2} y1="1" x2={px + 2} y2="9" stroke={color} strokeWidth="1.5" />
      </svg>
      {text}
    </Chip>
  );
}

/**
 * The light scene panel of the chosen design. `height(W, narrow)` sizes the
 * drawing; `children(W, H, narrow)` draws it; `chips(W, narrow, H)` (or a node)
 * fills the top-right corner. The legend floats over the top-left from `sm`
 * up and moves under the scene on phones.
 */
export function LabScene({ legend = [], chips, height, ariaLabel, children, minW = 280, className = '' }) {
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, minW);
  const narrow = W < 560;
  const H = Math.round(typeof height === 'function' ? height(W, narrow) : height);
  const chipNode = typeof chips === 'function' ? chips(W, narrow, H) : chips;
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-300/70 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_30px_-12px_rgba(0,0,0,0.6)] ${className}`}
    >
      <div ref={ref} className="w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="cl-scene block select-none">
          <rect width={W} height={H} fill="#fbfcfe" />
          {width > 0 && children(W, H, narrow)}
        </svg>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 sm:p-3">
        {legend.length > 0 && (
          <ul className="hidden sm:flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-[12px] text-slate-600 shadow-sm backdrop-blur">
            {legend.map((l, i) => (
              <LegendItem key={i} {...l} />
            ))}
          </ul>
        )}
        {chipNode && <div className="ml-auto flex shrink-0 flex-col items-end gap-1.5">{chipNode}</div>}
      </div>
      {legend.length > 0 && (
        <ul className="flex sm:hidden flex-wrap gap-x-3 gap-y-1 border-t border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          {legend.map((l, i) => (
            <LegendItem key={i} {...l} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Light square grid every `step` world units, drawn through the view (y up). */
export function PaperGrid({ view, W, H, step, color = '#e8edf3', yMin }) {
  const lines = [];
  const x0 = Math.ceil(view.wx(0) / step) * step;
  const y0 = Math.ceil((yMin ?? view.wy(H)) / step) * step;
  const yTop = view.wy(0);
  for (let x = x0; x <= view.wx(W) + 1e-9; x += step) {
    lines.push(<line key={`gx${x.toFixed(5)}`} x1={view.sx(x)} x2={view.sx(x)} y1={0} y2={yMin !== undefined ? view.sy(yMin) : H} stroke={color} strokeWidth={1} />);
  }
  for (let y = y0; y <= yTop + 1e-9; y += step) {
    lines.push(<line key={`gy${y.toFixed(5)}`} x1={0} x2={W} y1={view.sy(y)} y2={view.sy(y)} stroke={color} strokeWidth={1} />);
  }
  return <g aria-hidden="true">{lines}</g>;
}

/**
 * An arrow from (x, y) along the unit direction (ux, uy) of length `len`
 * pixels. Longer than `cap`, it is drawn `cap` long with a break mark (≈)
 * across the shaft — "much longer than shown". A white halo keeps it
 * readable on any ground.
 */
export function CapArrow({ x, y, ux, uy, len, cap = Infinity, color, width = 2.4, head = 9, halo = true, opacity = 1 }) {
  if (!(len > 1.5)) return null;
  const L = Math.min(len, cap);
  const broken = len > cap + 0.5;
  const x2 = x + ux * L;
  const y2 = y + uy * L;
  const nx = -uy;
  const ny = ux;
  const mx = x + ux * L * 0.42;
  const my = y + uy * L * 0.42;
  return (
    <g opacity={opacity} pointerEvents="none">
      {halo && <Arrow x1={x} y1={y} x2={x2} y2={y2} color="#ffffff" width={width + 3} head={head + 3} opacity={0.85} />}
      <Arrow x1={x} y1={y} x2={x2} y2={y2} color={color} width={width} head={head} />
      {broken && (
        <g>
          <line x1={mx - ux * 2.5 + nx * 6} y1={my - uy * 2.5 + ny * 6} x2={mx + ux * 2.5 - nx * 6} y2={my + uy * 2.5 - ny * 6} stroke="#fff" strokeWidth="5" />
          <line x1={mx - ux * 4 + nx * 6} y1={my - uy * 4 + ny * 6} x2={mx + ux * 1 - nx * 6} y2={my + uy * 1 - ny * 6} stroke={color} strokeWidth="1.6" />
          <line x1={mx - ux * 1 + nx * 6} y1={my - uy * 1 + ny * 6} x2={mx + ux * 4 - nx * 6} y2={my + uy * 4 - ny * 6} stroke={color} strokeWidth="1.6" />
        </g>
      )}
    </g>
  );
}

/** An SVG text label with a white halo. */
export function Label({ x, y, children, color = COL.ink, fs = 12, anchor = 'middle', weight = 700, italic, halo = true }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={fs}
      fontWeight={weight}
      fontStyle={italic ? 'italic' : undefined}
      fill={color}
      stroke={halo ? '#fff' : undefined}
      strokeWidth={halo ? 3.2 : 0}
      strokeLinejoin="round"
      paintOrder="stroke"
      pointerEvents="none"
    >
      {children}
    </text>
  );
}

/** A rounded label pill clamped inside `box` = { w, h }; `outline` draws a white pill with a coloured border. */
export function Tag({ x, y, text, color, outline, fs = 12, box, anchor = 'middle' }) {
  if (!text) return null;
  const w = textWidth(text, fs, 700) + 16;
  const h = fs + 10;
  let left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  let top = y - h / 2;
  if (box) {
    left = clamp(left, 4, box.w - w - 4);
    top = clamp(top, 4, box.h - h - 4);
  }
  return (
    <g pointerEvents="none">
      <rect x={left} y={top} width={w} height={h} rx={h / 2} fill={outline ? '#fff' : color} stroke={color} strokeWidth={outline ? 1.5 : 0} />
      <text x={left + w / 2} y={top + h / 2 + fs * 0.35} textAnchor="middle" fontSize={fs} fontWeight={700} fill={outline ? color : '#fff'}>
        {text}
      </text>
    </g>
  );
}
