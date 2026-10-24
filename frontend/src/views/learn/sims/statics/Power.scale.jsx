import { useState } from 'react';
import { ChartNoAxesColumn } from 'lucide-react';

import { clamp } from '../kit/ui';
import { HP, PC, power, smart, whole } from './Power.parts';

/**
 * Typical powers on a logarithmic bar chart, from an LED lamp (≈ 9 W) to an
 * electric locomotive (≈ 5 MW), with the car of the simulator placed among
 * them. Clicking a row makes it the reference the car is compared with.
 */

const ITEMS = [
  { id: 'led', w: 9 },
  { id: 'person', w: 75 },
  { id: 'bulb', w: 100 },
  { id: 'horse', w: HP },
  { id: 'sprinter', w: 1500 },
  { id: 'kettle', w: 2000 },
  { id: 'moto', w: 15000 },
  { id: 'car', w: 100000 },
  { id: 'truck', w: 300000 },
  { id: 'loco', w: 5e6 },
];
const LOG0 = 0; // 1 W
const LOG1 = 7; // 10 MW
const TICKS = [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7];

const pct = (w) => clamp((Math.log10(w) - LOG0) / (LOG1 - LOG0), 0, 1) * 100;

export default function PowerScale({ T, carW }) {
  const P = T.scale;
  const dec = T.decimal;
  const [refId, setRefId] = useState('person');
  const rows = [...ITEMS, { id: 'this', w: carW }].sort((a, b) => a.w - b.w);
  const ref = ITEMS.find((x) => x.id === refId);
  const ratio = carW / ref.w;
  const times = (r) => (r >= 100 ? whole(r, dec) : smart(r, dec, r >= 10 ? 0 : 1));
  const sentence =
    ratio >= 1
      ? P.more(power(carW, T), P.items[ref.id], power(ref.w, T), times(ratio))
      : P.less(P.items[ref.id], power(ref.w, T), power(carW, T), times(1 / ratio));

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4" aria-labelledby="pw-scale-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id="pw-scale-title" className="flex items-center gap-2 text-sm font-semibold text-gray-200">
          <ChartNoAxesColumn size={16} className="text-amber-300" aria-hidden="true" />
          {P.title}
        </h3>
        <p className="text-xs text-gray-500">{P.hint}</p>
      </div>

      {/* tick labels */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[14rem_1fr]">
        <span className="hidden sm:block" />
        <div className="relative h-4" aria-hidden="true">
          {TICKS.map((w, i) => (
            <span
              key={w}
              className={`absolute top-0 -translate-x-1/2 whitespace-nowrap text-[10px] sm:text-[11px] tabular-nums text-gray-500 ${i % 2 ? 'hidden sm:inline' : ''}`}
              style={{ left: `${pct(w)}%` }}
            >
              {power(w, T, 0)}
            </span>
          ))}
        </div>
      </div>

      <ul className="mt-1 space-y-1">
        {rows.map((r) => {
          const isThis = r.id === 'this';
          const isRef = r.id === refId;
          const col = isThis ? PC.N : isRef ? '#22d3ee' : 'rgba(148,163,184,0.5)';
          const p = pct(r.w);
          const label = isThis ? P.thisCar : P.items[r.id];
          const inner = (
            <>
              <span className={`min-w-0 text-left text-[13px] leading-tight sm:truncate ${isThis ? 'font-semibold text-amber-200' : isRef ? 'font-semibold text-cyan-200' : 'text-gray-300'}`}>
                {label}
              </span>
              <span className="relative block h-7 rounded-lg bg-white/[0.04]">
                {TICKS.map((w) => (
                  <span key={w} className="absolute inset-y-0 w-px bg-white/[0.07]" style={{ left: `${pct(w)}%` }} aria-hidden="true" />
                ))}
                <span className="absolute inset-y-1 left-0 rounded-md transition-[width] duration-300" style={{ width: `${Math.max(p, 1)}%`, background: col }} />
                <span
                  className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[12px] font-semibold tabular-nums ${p > 72 && (isThis || isRef) ? 'text-slate-950' : 'text-gray-100'}`}
                  style={p > 72 ? { right: `${100 - p + 1.5}%` } : { left: `calc(${p}% + 8px)` }}
                >
                  {power(r.w, T)}
                </span>
              </span>
            </>
          );
          const cls = 'grid w-full grid-cols-1 items-center gap-1 rounded-xl px-1.5 py-1 sm:grid-cols-[14rem_1fr] sm:gap-3 sm:py-0.5';
          return (
            <li key={r.id}>
              {isThis ? (
                <div className={`${cls} bg-amber-400/10 ring-1 ring-amber-400/40`}>{inner}</div>
              ) : (
                <button
                  type="button"
                  aria-pressed={isRef}
                  onClick={() => setRefId(r.id)}
                  className={`${cls} min-h-10 transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 ${isRef ? 'bg-cyan-400/10' : ''}`}
                >
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-3 rounded-xl bg-black/25 px-3 py-2.5 text-[14px] leading-snug text-gray-200">
        {sentence} <span className="text-gray-400">{P.hp(smart(carW / HP, dec, 0))}</span>
      </p>
      <p className="mt-1.5 text-xs text-gray-500">{P.note}</p>
    </section>
  );
}
