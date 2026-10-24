import { Fragment, useState } from 'react';
import { Car, Crosshair, Footprints, Lightbulb, Truck, Volleyball } from 'lucide-react';

import { Explain, Pill, RangeField, Readout, Segmented, useRafLoop, useSettled } from '../kit/ui';
import {
  COL,
  Cart,
  CartDefs,
  Chip,
  FormulaTile,
  GroupLabel,
  LabScene,
  PlayControls,
  Rail,
  Rich,
  Ruler,
  SvgSym,
  VecArrow,
  cartGeom,
  energyParts,
  energyText,
  lineView,
  rulerStep,
  trim,
} from './KineticEnergy.parts';

/**
 * Tab 1 — E_k = mv²/2. Two lab carts roll side by side on a smooth track;
 * cart 2 differs from cart 1 by one thing (2v, 3v, 2m or v/2) and the green
 * bars show their kinetic energies, the bigger one cut into pieces the size
 * of the smaller: 2v → 4 pieces, 3v → 9, 2m → 2. Preset m = 2 kg, v = 3 m/s:
 * E₁ = 2·3²/2 = 9 J, E₂ = 2·6²/2 = 36 J. Under the scene a log bar chart
 * puts the carts among everyday objects (ball 90 J, bullet 720 J, runner
 * 750 J, car at 60 km/h 138.9 kJ, truck 1.39 MJ). Strings come from T.explore.
 */

const MODES = [
  { id: 'v2', km: 1, kv: 2 },
  { id: 'v3', km: 1, kv: 3 },
  { id: 'm2', km: 2, kv: 1 },
  { id: 'vh', km: 1, kv: 0.5 },
];
const TONE = { idle: '#22d3ee', v2: '#34d399', v3: '#34d399', m2: '#a78bfa', vh: '#fbbf24' };
const TRACK = 10; // metres of rail on screen
const X0 = 0.8; // where both carts start
const LOOK = [
  { body: '#334155', dot: '#0891b2', text: '#67e8f9' },
  { body: '#be185d', dot: '#db2777', text: '#f9a8d4' },
];
const OBJECTS = [
  { id: 'ball', icon: Volleyball, m: 0.45, v: 20 },
  { id: 'bullet', icon: Crosshair, m: 0.009, v: 400 },
  { id: 'runner', icon: Footprints, m: 60, v: 5 },
  { id: 'car', icon: Car, m: 1000, v: 60 / 3.6 },
  { id: 'truck', icon: Truck, m: 10000, v: 60 / 3.6 },
];
const IDLE = { t: 0, x1: X0, x2: X0, running: false };
const PERIOD = TRACK + 2;
const wrap = (x) => ((((x + 1) % PERIOD) + PERIOD) % PERIOD) - 1;

export default function ExploreSim({ T }) {
  const L = T.explore;
  const dec = T.decimal;
  const [mode, setMode] = useState('v2');
  const [m, setM] = useState(2);
  const [v, setV] = useState(3);
  const [sim, setSim] = useState(IDLE);

  const md = MODES.find((x) => x.id === mode);
  const m2 = m * md.km;
  const v2 = v * md.kv;
  const e1 = (m * v * v) / 2;
  const e2 = (m2 * v2 * v2) / 2;
  const ratio = e2 / e1;
  const vMax = Math.max(v, v2);
  // the faster cart should take at least 2.5 s to cross the rail on screen
  const slow = TRACK / vMax < 2.5 ? Math.ceil((2.5 * vMax) / TRACK) : 1;

  useRafLoop(sim.running, (dt) => {
    const d = dt / slow;
    setSim((p) => (p.running ? { ...p, t: p.t + d, x1: wrap(p.x1 + v * d), x2: wrap(p.x2 + v2 * d) } : p));
  });

  const toggle = () => setSim((p) => ({ ...p, running: !p.running }));
  const reset = () => setSim(IDLE);
  const pickMode = (id) => {
    setMode(id);
    setSim((p) => ({ ...IDLE, t: p.t > 0 ? 1e-6 : 0, running: p.running }));
  };

  const E = (e) => energyText(e, T, dec);
  const D = (n) => trim(n, dec);
  const ratioText = ratio >= 1 ? D(ratio) : `1/${D(1 / ratio)}`;

  const key = !sim.running && sim.t === 0 ? 'idle' : mode;
  const settled = useSettled(key, key === 'idle' ? 0 : 200);
  const text = settled === 'idle' ? L.explain.idle : L.explain[settled](E(e1), E(e2));

  const p1 = energyParts(e1, T, dec);
  const p2 = energyParts(e2, T, dec);
  const ladderRows = [
    { id: 'c1', name: L.cart1, sub: L.cartSub(D(m), D(v)), e: e1, color: LOOK[0].dot, cart: true },
    { id: 'c2', name: L.cart2, sub: L.cartSub(D(m2), D(v2)), e: e2, color: LOOK[1].dot, cart: true },
    ...OBJECTS.map((o, i) => ({ id: o.id, icon: o.icon, name: L.ladder.objects[o.id].name, sub: L.ladder.objects[o.id].sub, e: (o.m * o.v * o.v) / 2, color: COL.ekFill, divider: i === 0 })),
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.compareLabel}</GroupLabel>
          <Segmented
            label={L.compareLabel}
            className="grid-cols-2 md:grid-cols-4"
            size="lg"
            value={mode}
            onChange={pickMode}
            accent={LOOK[1].dot}
            options={MODES.map((o) => ({ value: o.id, label: L.modes[o.id].name, sub: L.modes[o.id].sub }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={false} started={sim.t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <ExploreScene
        T={T}
        carts={[
          { m, v, e: e1, x: sim.x1, look: LOOK[0], name: L.cart1, short: '1' },
          { m: m2, v: v2, e: e2, x: sim.x2, look: LOOK[1], name: L.cart2, short: '2' },
        ]}
        ratio={ratio}
        ratioText={ratioText}
        slow={slow}
      />

      <Explain icon={Lightbulb} id={settled} tone={TONE[settled]}>
        <Rich>{text}</Rich>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.cart1} symbol={<Rich>{`E_{${T.kSub}1}`}</Rich>} value={p1.v} unit={p1.u} accent={LOOK[0].dot} textColor={COL.ekText} sub={<Rich>{L.eSub(D(m), D(v))}</Rich>} />
        <Readout label={L.cart2} symbol={<Rich>{`E_{${T.kSub}2}`}</Rich>} value={p2.v} unit={p2.u} accent={LOOK[1].dot} textColor={COL.ekText} sub={<Rich>{L.eSub(D(m2), D(v2))}</Rich>} />
        <Readout label={L.readouts.ratio} symbol={<Rich>{`E_{${T.kSub}2} : E_{${T.kSub}1}`}</Rich>} value={ratioText} accent="#e2e8f0" active={sim.t > 0} sub={L.ratioSub[mode]} />
        <Readout label={L.readouts.law} accent={COL.ekFill}>
          <ul className="mt-2 space-y-1 text-[13px] tabular-nums">
            {MODES.map((o) => (
              <li
                key={o.id}
                className={`flex items-center justify-between gap-2 rounded-md px-1.5 py-0.5 ${o.id === mode ? 'bg-white/[0.09] text-white' : 'text-gray-400'}`}
              >
                <span>{L.law[o.id][0]}</span>
                <span className="font-semibold" style={{ color: o.id === mode ? COL.ekText : undefined }}>
                  <Rich>{L.law[o.id][1]}</Rich>
                </span>
              </li>
            ))}
          </ul>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="ke-ex-m"
            label={L.m}
            symbol="m"
            min={1}
            max={5}
            step={0.5}
            value={m}
            onChange={setM}
            accent="#94a3b8"
            display={`${D(m)} ${T.kg}`}
            hint={L.mHint}
          />
          <RangeField
            id="ke-ex-v"
            label={L.v}
            symbol="v"
            min={1}
            max={4}
            step={0.5}
            value={v}
            onChange={setV}
            accent={COL.vel}
            display={`${D(v)} ${T.ms}`}
            hint={L.vHint(D(v * 3.6))}
          />
          <FormulaTile tag={L.formula.tag} color={COL.ekText} general={L.formula.general} filled={L.formula.filled(D(m), D(v), E(e1))} result={L.formula.result(E(e1))} />
          <p className="text-xs text-gray-500">
            <Rich>{L.formula.unit}</Rich>
          </p>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <EnergyLadder T={T} rows={ladderRows} />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

function ExploreScene({ T, carts, ratio, ratioText, slow }) {
  const L = T.explore;
  const dec = T.decimal;
  const lay = (narrow) =>
    narrow
      ? { top: 44, laneH: 96, railOff: 22, barsGap: 46, barRow: 30 }
      : { top: 52, laneH: 128, railOff: 26, barsGap: 0, barRow: 0 };

  return (
    <LabScene
      legend={[
        { color: COL.vel, label: L.legend.v, kind: 'arrow' },
        { color: COL.ekFill, label: L.legend.ek, kind: 'box' },
      ]}
      chips={<Chip>{slow > 1 ? L.chipSlow(slow) : L.chipReal}</Chip>}
      height={(W, narrow) => {
        const g = lay(narrow);
        const rail2 = g.top + 2 * g.laneH - g.railOff;
        return narrow ? rail2 + 62 + 2 * g.barRow + 14 : rail2 + 52;
      }}
      ariaLabel={L.sceneLabel(
        trim(carts[0].m, dec),
        trim(carts[0].v, dec),
        energyText(carts[0].e, T, dec),
        trim(carts[1].m, dec),
        trim(carts[1].v, dec),
        energyText(carts[1].e, T, dec),
      )}
    >
      {(W, H, narrow) => {
        const g = lay(narrow);
        const fs = narrow ? 10.5 : 12;
        const barsW = narrow ? 0 : Math.round(Math.min(260, Math.max(200, W * 0.22)));
        const labelCol = narrow ? 72 : 112;
        const trackL = labelCol + 6;
        const trackR = W - barsW - (narrow ? 0 : 10);
        const view = lineView(0, TRACK, W, trackL + (narrow ? 10 : 16), W - trackR + (narrow ? 10 : 16));
        const len = Math.max(narrow ? 46 : 72, Math.min(narrow ? 58 : 108, view.k * 1.25));
        const vMax = Math.max(carts[0].v, carts[1].v);
        const kv = Math.min(narrow ? 7 : 16, ((trackR - trackL) * 0.32) / vMax);
        const rails = [0, 1].map((i) => g.top + (i + 1) * g.laneH - g.railOff);
        const step = rulerStep(view, narrow ? 34 : 56);
        return (
          <>
            <CartDefs />
            <defs>
              <clipPath id="ke-ex-clip">
                <rect x={trackL} y={0} width={trackR - trackL} height={H} />
              </clipPath>
            </defs>
            <rect width={W} height={H} fill="#fbfcfe" />
            {/* faint paper grid under the rails */}
            <g aria-hidden="true">
              {Array.from({ length: Math.floor(TRACK / step) + 1 }, (_, i) => i * step).map((x) => (
                <line key={x} x1={view.sx(x)} x2={view.sx(x)} y1={g.top - 6} y2={rails[1] + 16} stroke={COL.grid} strokeWidth={1} />
              ))}
            </g>

            {carts.map((c, i) => {
              const y = rails[i];
              const cg = cartGeom(len, c.m);
              const cx = view.sx(c.x);
              const ay = y + cg.top - (narrow ? 10 : 14);
              const tagY = y - g.laneH + g.railOff + 10;
              return (
                <g key={c.name}>
                  {/* lane label */}
                  <rect x={0} y={tagY} width={labelCol - 4} height={g.laneH - 22} rx={10} fill="#f1f5f9" stroke="#e2e8f0" />
                  <rect x={0} y={tagY} width={4} height={g.laneH - 22} rx={2} fill={c.look.dot} />
                  <text x={narrow ? 9 : 14} y={tagY + (narrow ? 20 : 26)} fontSize={narrow ? 10.5 : 13} fontWeight="700" fill="#0f172a">
                    {c.name}
                  </text>
                  <text x={narrow ? 9 : 14} y={tagY + (narrow ? 37 : 48)} fontSize={narrow ? 10.5 : 12} fontWeight="600" fill="#475569" className="tabular-nums">
                    {narrow ? `${trim(c.m, dec)} ${T.kg}` : `m = ${trim(c.m, dec)} ${T.kg}`}
                  </text>
                  <text x={narrow ? 9 : 14} y={tagY + (narrow ? 53 : 68)} fontSize={narrow ? 10.5 : 12} fontWeight="600" fill={COL.vel} className="tabular-nums">
                    {narrow ? `${trim(c.v, dec)} ${T.ms}` : `v = ${trim(c.v, dec)} ${T.ms}`}
                  </text>
                  <Rail a={trackL} b={trackR} y={y} feet={!narrow} />
                  <g clipPath="url(#ke-ex-clip)">
                    <Cart cx={cx} y={y} len={len} mass={c.m} label={`${trim(c.m, dec)} ${T.kg}`} rot={(c.x * view.k) / (len * 0.1)} fs={narrow ? 10 : 12} body={c.look.body} />
                    <VecArrow x={cx - (c.v * kv) / 2} y={ay} dx={c.v * kv} dy={0} color={COL.vel} main="v" fs={fs + 1} width={narrow ? 2.6 : 3} />
                  </g>
                </g>
              );
            })}
            <Ruler view={view} y={rails[1] + 16} step={step} unit={L.axisX} decimal={dec} fs={narrow ? 10 : 11} fromX={trackL} toX={trackR} unitX={trackR} />

            {narrow ? (
              <BarsRows carts={carts} ratio={ratio} ratioText={ratioText} x0={trackL} x1={W - 70} y0={rails[1] + 66} row={g.barRow} T={T} />
            ) : (
              <BarsColumns carts={carts} ratio={ratio} ratioText={ratioText} x0={W - barsW} x1={W - 12} y0={70} y1={H - 30} T={T} />
            )}
          </>
        );
      }}
    </LabScene>
  );
}

/** How the bigger bar is cut into pieces of the smaller one (only for whole ratios). */
function pieces(ratio) {
  const r = ratio >= 1 ? ratio : 1 / ratio;
  const n = Math.round(r);
  return Math.abs(r - n) < 1e-6 && n >= 2 && n <= 12 ? n : 0;
}

/** Wide scenes: two vertical energy bars on the right of the rails. */
function BarsColumns({ carts, ratio, ratioText, x0, x1, y0, y1, T }) {
  const L = T.explore;
  const dec = T.decimal;
  const eMax = Math.max(carts[0].e, carts[1].e);
  const top = y0 + 34;
  const base = y1 - 20;
  const hMax = base - top;
  const bw = Math.min(56, (x1 - x0) * 0.24);
  const cxs = [x0 + (x1 - x0) * 0.3, x0 + (x1 - x0) * 0.72];
  const n = pieces(ratio);
  const bigI = ratio >= 1 ? 1 : 0;
  const small = Math.min(carts[0].e, carts[1].e);
  const hSmall = (small / eMax) * hMax;
  return (
    <g>
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0 + 8} rx={12} fill="#f8fafc" stroke="#e2e8f0" />
      <SvgSym x={x0 + 12} y={y0 + 20} main="E" sub={T.kSub} rest={`, ${T.J}`} color="#334155" fs={12.5} />
      <line x1={x0 + 10} x2={x1 - 10} y1={base} y2={base} stroke="#94a3b8" strokeWidth={1.3} />
      {/* level of the smaller bar, carried across */}
      <line x1={x0 + 12} x2={x1 - 12} y1={base - hSmall} y2={base - hSmall} stroke={COL.ek} strokeOpacity={0.55} strokeDasharray="4 4" />
      {carts.map((c, i) => {
        const h = Math.max(1.5, (c.e / eMax) * hMax);
        const x = cxs[i] - bw / 2;
        const segs = [];
        if (n && i === bigI) for (let k = 1; k < n; k += 1) segs.push(base - k * hSmall);
        const p = energyParts(c.e, T, dec);
        return (
          <g key={c.name}>
            <rect x={x} y={base - h} width={bw} height={h} rx={4} fill={COL.ekFill} stroke={COL.ek} strokeWidth={1.2} />
            {segs.map((sy) => (
              <line key={sy} x1={x + 1} x2={x + bw - 1} y1={sy} y2={sy} stroke="#ffffff" strokeWidth={1.6} />
            ))}
            <text x={cxs[i]} y={base - h - 7} textAnchor="middle" fontSize={12.5} fontWeight="700" fill={COL.ek} className="tabular-nums">
              {`${p.v} ${p.u}`}
            </text>
            <circle cx={cxs[i] - 16} cy={base + 13} r={4} fill={c.look.dot} />
            <text x={cxs[i] - 8} y={base + 17} fontSize={11.5} fontWeight="700" fill="#334155">
              {c.short}
            </text>
          </g>
        );
      })}
      <Pill x={(cxs[0] + cxs[1]) / 2} y={base - Math.max(hSmall, hMax * 0.5)} text={`× ${ratioText}`} bg="#0f172a" size={12} />
    </g>
  );
}

/** Narrow scenes: the same two bars laid horizontally under the rails. */
function BarsRows({ carts, ratio, ratioText, x0, x1, y0, row, T }) {
  const dec = T.decimal;
  const eMax = Math.max(carts[0].e, carts[1].e);
  const wMax = x1 - x0;
  const n = pieces(ratio);
  const bigI = ratio >= 1 ? 1 : 0;
  const small = Math.min(carts[0].e, carts[1].e);
  const wSmall = (small / eMax) * wMax;
  return (
    <g>
      <SvgSym x={8} y={y0 - 8} main="E" sub={T.kSub} color="#334155" fs={11.5} />
      <text x={x1 + 64} y={y0 - 8} textAnchor="end" fontSize={11} fontWeight="700" fill="#0f172a">
        {`× ${ratioText}`}
      </text>
      {carts.map((c, i) => {
        const y = y0 + i * row;
        const w = Math.max(1.5, (c.e / eMax) * wMax);
        const segs = [];
        if (n && i === bigI) for (let k = 1; k < n; k += 1) segs.push(x0 + k * wSmall);
        return (
          <g key={c.name}>
            <circle cx={14} cy={y + 9} r={4} fill={c.look.dot} />
            <text x={22} y={y + 13} fontSize={11} fontWeight="700" fill="#334155">
              {c.short}
            </text>
            <rect x={x0} y={y} width={w} height={18} rx={4} fill={COL.ekFill} stroke={COL.ek} strokeWidth={1.1} />
            {segs.map((sx) => (
              <line key={sx} x1={sx} x2={sx} y1={y + 1} y2={y + 17} stroke="#fff" strokeWidth={1.5} />
            ))}
            <text x={x1 + 64} y={y + 13} textAnchor="end" fontSize={11} fontWeight="700" fill={COL.ek} className="tabular-nums">
              {energyText(c.e, T, dec)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/* ------------------------------------------------------------ log chart */

const LOG_MIN = -1; // 0.1 J
const LOG_MAX = 7; // 10 MJ
const pct = (e) => ((Math.log10(Math.max(e, 10 ** LOG_MIN)) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100;

/** Everyday kinetic energies on a logarithmic bar chart, with the two carts on top. */
function EnergyLadder({ T, rows }) {
  const L = T.explore.ladder;
  const dec = T.decimal;
  const ticks = [];
  for (let k = LOG_MIN; k <= LOG_MAX; k += 1) ticks.push(k);
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-semibold text-gray-200">{L.title}</p>
        <p className="text-xs text-gray-500">{L.scale}</p>
      </div>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-x-3 gap-y-1 sm:grid-cols-[176px_minmax(0,1fr)]" role="img" aria-label={L.label}>
        {rows.map((r) => {
          const p = pct(r.e);
          const inside = p > 76;
          const Icon = r.icon;
          return (
            <Fragment key={r.id}>
              <div className={`flex min-w-0 items-center gap-2 ${r.divider ? 'sm:mt-2 mt-2 border-t border-white/10 pt-2 sm:border-0 sm:pt-0' : ''}`}>
                {Icon ? (
                  <Icon size={16} className="shrink-0 text-gray-400" aria-hidden="true" />
                ) : (
                  <span className="mx-[3px] h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden="true" />
                )}
                <span className="min-w-0 leading-tight">
                  <span className={`block truncate text-[13px] font-semibold ${r.cart ? 'text-white' : 'text-gray-200'}`}>{r.name}</span>
                  <span className="block truncate text-[11px] tabular-nums text-gray-500">{r.sub}</span>
                </span>
              </div>
              <div className={`relative h-7 self-center ${r.divider ? 'sm:mt-2' : ''}`}>
                {ticks.map((k) => (
                  <span key={k} className="absolute inset-y-0 w-px bg-white/[0.07]" style={{ left: `${pct(10 ** k)}%` }} aria-hidden="true" />
                ))}
                <span
                  className="absolute inset-y-1 left-0 rounded-md transition-[width] duration-300"
                  style={{ width: `${Math.max(p, 0.8)}%`, background: r.color, opacity: r.cart ? 1 : 0.8 }}
                  aria-hidden="true"
                />
                <span
                  className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-xs font-semibold tabular-nums ${inside ? 'text-slate-950' : 'text-gray-100'}`}
                  style={inside ? { right: `calc(${100 - p}% + 6px)` } : { left: `calc(${Math.max(p, 0.8)}% + 6px)` }}
                >
                  {energyText(r.e, T, dec)}
                </span>
              </div>
            </Fragment>
          );
        })}
        <div className="hidden sm:block" />
        <div className="relative mt-1 h-5" aria-hidden="true">
          {ticks.map((k, i) => (
            <span
              key={k}
              className={`absolute top-0 whitespace-nowrap text-[10.5px] tabular-nums text-gray-500 ${i === 0 ? '' : i === ticks.length - 1 ? '-translate-x-full' : '-translate-x-1/2'} ${i % 2 ? 'hidden sm:block' : ''}`}
              style={{ left: `${pct(10 ** k)}%` }}
            >
              {energyText(10 ** k, T, dec)}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-gray-500">{L.note}</p>
    </div>
  );
}
