import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

/**
 * Shared building blocks for the "Klassik laboratoriya" simulator variant.
 * Nothing in here carries user-facing text: every string arrives through
 * props from the `UZ` object in VariantClassicLab.jsx.
 */

/* ------------------------------------------------------------------ hooks */

/** Tracks an element's rendered size with a ResizeObserver. */
export function useElementSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => {
      const r = el.getBoundingClientRect();
      setSize((s) =>
        Math.abs(s.width - r.width) < 0.5 && Math.abs(s.height - r.height) < 0.5 ? s : { width: r.width, height: r.height },
      );
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

/** Runs `onFrame(dtSeconds)` every animation frame while `active` is true. */
export function useRafLoop(active, onFrame) {
  const cb = useRef(onFrame);
  useEffect(() => {
    cb.current = onFrame;
  });
  useEffect(() => {
    if (!active) return undefined;
    let raf = 0;
    let last = performance.now();
    const loop = (now) => {
      // generous cap: slow devices still run in real time, but a long pause
      // (background tab) does not make the simulation jump
      const dt = Math.min(0.25, Math.max(0, (now - last) / 1000));
      last = now;
      cb.current(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}

/** Returns `value` only after it has stayed unchanged for `delay` ms (stops message flicker). */
export function useSettled(value, delay) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (value === settled) return undefined;
    const id = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(id);
  }, [value, settled, delay]);
  return settled;
}

/** Tween a number towards a target with requestAnimationFrame (cancelled on unmount). */
export function useTween(initial) {
  const [value, setValue] = useState(initial);
  const raf = useRef(0);
  const current = useRef(initial);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const set = (target, ms = 0) => {
    cancelAnimationFrame(raf.current);
    if (!ms) {
      current.current = target;
      setValue(target);
      return;
    }
    const from = current.current;
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      const e = p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
      current.current = from + (target - from) * e;
      setValue(current.current);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };
  return [value, set];
}

/* ---------------------------------------------------------------- numbers */

/** Fixed-point formatting without "-0.0", with a configurable decimal mark. */
export function fmt(n, digits = 1, decimal = '.') {
  if (!Number.isFinite(n)) return '—';
  const eps = 0.5 * 10 ** -digits;
  const v = Math.abs(n) < eps ? 0 : n;
  const s = v.toFixed(digits);
  return decimal === '.' ? s : s.replace('.', decimal);
}

/** Groups thousands with a thin space: 37500 -> "37 500". */
export function groupThousands(n) {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export { clamp };

let measureCtx = null;
/** Pixel width of a string in the page font (falls back to an estimate). */
export function textWidth(text, size = 12, weight = 600) {
  try {
    if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
    measureCtx.font = `${weight} ${size}px "Space Grotesk", ui-sans-serif, system-ui, sans-serif`;
    return measureCtx.measureText(text).width;
  } catch {
    return text.length * size * 0.58;
  }
}

/* ----------------------------------------------------------------- styles */

export const LAB_CSS = `
.cl-range{-webkit-appearance:none;appearance:none;width:100%;height:40px;background:transparent;cursor:pointer;margin:0;display:block}
.cl-range:focus{outline:none}
.cl-range::-webkit-slider-runnable-track{height:6px;border-radius:999px;background:linear-gradient(to right,var(--accent) 0 var(--pct),rgba(255,255,255,.13) var(--pct) 100%)}
.cl-range::-moz-range-track{height:6px;border-radius:999px;background:rgba(255,255,255,.13)}
.cl-range::-moz-range-progress{height:6px;border-radius:999px;background:var(--accent)}
.cl-range::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;margin-top:-8px;border-radius:50%;background:#fff;border:4px solid var(--accent);box-shadow:0 2px 10px rgba(0,0,0,.45);transition:transform .15s}
.cl-range::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#fff;border:4px solid var(--accent);box-shadow:0 2px 10px rgba(0,0,0,.45)}
.cl-range:active::-webkit-slider-thumb{transform:scale(1.12)}
.cl-range:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 5px color-mix(in srgb,var(--accent) 40%,transparent)}
.cl-range:focus-visible::-moz-range-thumb{box-shadow:0 0 0 5px color-mix(in srgb,var(--accent) 40%,transparent)}
.cl-range:disabled{opacity:.45;cursor:not-allowed}
@keyframes cl-pulse{0%{transform:scale(.6);opacity:.55}100%{transform:scale(1.9);opacity:0}}
.cl-pulse{transform-box:fill-box;transform-origin:center;animation:cl-pulse 1.3s ease-out infinite}
@media (prefers-reduced-motion:reduce){.cl-pulse{animation:none;opacity:.25}}
.cl-scene text{font-family:"Space Grotesk",ui-sans-serif,system-ui,sans-serif}
`;

/* -------------------------------------------------------------- controls */

const BTN_BASE =
  'inline-flex items-center justify-center gap-2 min-h-10 px-4 rounded-xl text-sm font-semibold transition-colors select-none ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-0 disabled:opacity-40 disabled:cursor-not-allowed';
const BTN_VARIANTS = {
  primary: 'bg-cyan-400 text-slate-950 hover:bg-cyan-300 shadow-[0_6px_24px_-6px_rgba(34,211,238,0.55)]',
  secondary: 'bg-white/[0.06] text-gray-100 border border-white/10 hover:bg-white/[0.11]',
};

export function Btn({ icon: Icon, children, variant = 'secondary', className = '', ...rest }) {
  return (
    <button type="button" className={`${BTN_BASE} ${BTN_VARIANTS[variant]} ${className}`} {...rest}>
      {Icon && <Icon size={17} strokeWidth={2.25} aria-hidden="true" />}
      <span>{children}</span>
    </button>
  );
}

/**
 * A row (or grid) of toggle buttons. `options`: [{ value, label, sub?, icon? }].
 * Uses aria-pressed buttons inside a labelled group.
 */
export function Segmented({ label, options, value, onChange, className = '', size = 'md', accent = '#22d3ee', disabled }) {
  return (
    <div role="group" aria-label={label} className={`grid gap-1.5 ${className}`}>
      {options.map((o) => {
        const on = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            style={on ? { borderColor: `${accent}99`, background: `${accent}1f` } : undefined}
            className={`min-h-10 rounded-xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 disabled:opacity-40 disabled:cursor-not-allowed ${
              size === 'lg' ? 'px-3 py-2' : 'px-3 py-1.5'
            } ${on ? 'text-white' : 'border-white/10 bg-white/[0.035] text-gray-300 hover:bg-white/[0.08]'}`}
          >
            <span className="flex items-center gap-2">
              {Icon && (
                <Icon
                  size={size === 'lg' ? 18 : 16}
                  strokeWidth={2.2}
                  aria-hidden="true"
                  style={{ color: on ? accent : undefined }}
                  className={on ? '' : 'text-gray-400'}
                />
              )}
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-tight">{o.label}</span>
                {o.sub && <span className="block text-[11px] leading-tight text-gray-400 mt-0.5 tabular-nums">{o.sub}</span>}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Labelled range slider with a live value and an optional hint line. */
export function RangeField({ id, label, symbol, value, min, max, step, display, valueText, onChange, accent = '#22d3ee', hint, disabled }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm text-gray-300">
          {label}
          {symbol && <span className="ml-1.5 font-serif italic text-gray-100">{symbol}</span>}
        </label>
        <output htmlFor={id} className="text-base font-semibold tabular-nums text-white">
          {display}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className="cl-range"
        style={{ '--pct': `${pct}%`, '--accent': accent }}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={valueText ?? String(display)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <p className="-mt-1 text-xs text-gray-500 leading-snug">{hint}</p>}
    </div>
  );
}

/** Big live number tile. */
export function Readout({ label, symbol, value, unit, sub, accent = '#94a3b8', textColor, active, children, className = '' }) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-3 sm:p-4 transition-colors ${active ? 'bg-white/[0.07]' : 'bg-white/[0.035] border-white/10'} ${className}`}
      style={active ? { borderColor: `${accent}88` } : undefined}
    >
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: accent }} aria-hidden="true" />
        <span className="leading-tight">{label}</span>
        {symbol && <span className="ml-auto font-serif normal-case italic tracking-normal text-sm text-gray-300">{symbol}</span>}
      </div>
      {value !== undefined && (
        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span className="text-[26px] sm:text-[32px] leading-none font-bold tabular-nums tracking-tight" style={{ color: textColor ?? '#fff' }}>
            {value}
          </span>
          {unit && <span className="text-sm text-gray-400">{unit}</span>}
        </div>
      )}
      {children}
      {sub && <div className="mt-auto pt-1.5 text-xs text-gray-400 tabular-nums leading-snug">{sub}</div>}
    </div>
  );
}

const MotionP = motion.p;

/** The one-line live explanation under the scene. */
export function Explain({ icon: Icon, id, children, tone = '#22d3ee' }) {
  return (
    <div
      className="relative flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 min-h-[60px] overflow-hidden"
      aria-live="polite"
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: tone }} aria-hidden="true" />
      {Icon && (
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `${tone}22`, color: tone }}>
          <Icon size={16} strokeWidth={2.4} aria-hidden="true" />
        </span>
      )}
      <AnimatePresence mode="wait" initial={false}>
        <MotionP
          key={id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }}
          className="text-[15px] leading-relaxed text-gray-100"
        >
          {children}
        </MotionP>
      </AnimatePresence>
    </div>
  );
}

/* ----------------------------------------------------------- SVG helpers */

/** A straight arrow from (x1,y1) to (x2,y2) with a filled head at the end. */
export function Arrow({ x1, y1, x2, y2, color, width = 3, head = 12, opacity = 1, dash }) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 2) return null;
  const ux = dx / len;
  const uy = dy / len;
  const h = Math.min(head, len * 0.7);
  const bx = x2 - ux * h;
  const by = y2 - uy * h;
  const nx = -uy;
  const ny = ux;
  const hw = h * 0.5;
  return (
    <g opacity={opacity}>
      <line x1={x1} y1={y1} x2={bx + ux * 0.5} y2={by + uy * 0.5} stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={dash} />
      <path d={`M${x2},${y2} L${bx + nx * hw},${by + ny * hw} L${bx - nx * hw},${by - ny * hw} Z`} fill={color} strokeLinejoin="round" stroke={color} strokeWidth={1} />
    </g>
  );
}

/** A rounded label pill, clamped inside `box` = { w, h } when given. Returns null if text is empty. */
export function Pill({ x, y, text, bg, color = '#fff', size = 12, weight = 600, box, border, padX = 8 }) {
  if (!text) return null;
  const w = textWidth(text, size, weight) + padX * 2;
  const h = size + 10;
  let left = x - w / 2;
  let top = y - h / 2;
  if (box) {
    left = clamp(left, 4, box.w - w - 4);
    top = clamp(top, 4, box.h - h - 4);
  }
  return (
    <g pointerEvents="none">
      <rect x={left} y={top} width={w} height={h} rx={h / 2} fill={bg} stroke={border} strokeWidth={border ? 1 : 0} />
      <text x={left + w / 2} y={top + h / 2 + size * 0.35} textAnchor="middle" fontSize={size} fontWeight={weight} fill={color}>
        {text}
      </text>
    </g>
  );
}

/** Picks a "nice" grid step (1, 2, 5 × 10^n metres) so lines are at least `minPx` apart. */
export function niceStep(pxPerUnit, minPx) {
  const raw = minPx / Math.max(pxPerUnit, 1e-9);
  const p = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p;
  return 10 * p;
}
