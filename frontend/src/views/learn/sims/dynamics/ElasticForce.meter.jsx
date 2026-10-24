import { useState } from 'react';
import { Apple, BookOpen, Check, Lightbulb, PenLine, RotateCcw, Smartphone } from 'lucide-react';
import { Arrow, Btn, Explain, Readout, Segmented, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { COL, Calc, Defs, G, Panel, RichPill, SimScene, Stand, Tag, TimeChip, XYGraph, integrate, rich } from './ElasticForce.parts';

/**
 * Build a dynamometer (spring balance). Its spring (k = 40 N/m, as in a
 * school "4 N" dynamometer: 4 N stretch it by 10 cm) obeys Hooke's law, so
 * equal weights give equal steps of the pointer. Calibration: with no load
 * and with 1…4 weights of 102 g (each weighs 102 g · 9.8 m/s² ≈ 1.00 N)
 * the pupil marks the pointer's place - the marks come out 2.50 cm apart.
 * Once the scale is complete (0.1 N divisions are added between the
 * marks) unknown bodies can be weighed: P is read from the scale and the
 * mass follows from m = P/g.
 *
 * The pointer's swing on the way to rest is a damped oscillation shown
 * slowed down 2×.
 */

const K = 40; // N/m
const W1 = 0.102; // kg, one "1 N" weight
const STEP = (W1 * G) / K; // m between neighbouring marks (0.0250 m)
const SLOW = 2;
const ZETA = 0.35;
const M_BARE = 0.03; // kg, inertia of the bare hook (motion only)
const ITEMS = [
  { id: 'apple', m: 0.15, icon: Apple },
  { id: 'phone', m: 0.2, icon: Smartphone },
  { id: 'book', m: 0.35, icon: BookOpen },
];
const ITEM = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
const CAL = [0, 1, 2, 3, 4];

const massOf = (load) => (load.startsWith('c') ? Number(load.slice(1)) * W1 : ITEM[load].m);

function hang(p, load) {
  const m = massOf(load);
  return { ...p, load, m, c: 2 * ZETA * Math.sqrt(K * Math.max(m, M_BARE)), running: true };
}

const START = { load: 'c0', m: 0, x: 0, v: 0, c: 0, running: false, marks: [], measured: [] };

export default function MeterSim({ T }) {
  const tx = T.meter;
  const u = T.u;
  const dec = T.decimal;
  const [sim, setSim] = useState(START);

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const mDyn = Math.max(p.m, M_BARE);
      const r = integrate(p.x, p.v, dt / SLOW, (x, v) => (p.m * G - K * x - p.c * v) / mDyn, 0);
      const rest = (p.m * G) / K;
      if (Math.abs(r.x - rest) < 1e-4 && Math.abs(r.v) < 3e-3) {
        const measured = p.load.startsWith('c') || p.measured.includes(p.load) ? p.measured : [...p.measured, p.load];
        return { ...p, x: rest, v: 0, running: false, measured };
      }
      return { ...p, x: r.x, v: r.v };
    });
  });

  const isCal = sim.load.startsWith('c');
  const n = isCal ? Number(sim.load.slice(1)) : null;
  const ready = sim.marks.length === CAL.length;
  const canMark = isCal && !sim.running && !sim.marks.includes(n);
  const mark = () => setSim((p) => (canMark ? { ...p, marks: [...p.marks, n].sort((a, b) => a - b) } : p));
  const reset = () => setSim(START);
  const pick = (load) => setSim((p) => hang(p, load));

  /* ---- physics and the reading */
  const xcm = sim.x * 100;
  const F = K * sim.x;
  const P = sim.m * G;
  const scaleN = sim.x / STEP; // what the scale says, in its own newtons
  const reading = Math.round(scaleN * 10) / 10;
  const mEst = reading / G;
  const f2 = (v) => fmt(v, 2, dec);
  const f1 = (v) => fmt(v, 1, dec);

  /* ---- explanation */
  let key;
  if (sim.running) key = 'moving';
  else if (!isCal) key = 'item';
  else if (!sim.marks.includes(n)) key = sim.marks.length === 0 && n === 0 ? 'start' : 'canMark';
  else if (ready) key = 'ready';
  else key = 'next';
  const settled = useSettled(`${key}-${sim.load}-${sim.marks.length}`, key === 'moving' ? 120 : 0);
  const sKey = settled.split('-')[0];
  const ex = tx.explain;
  const nextN = CAL.find((c) => !sim.marks.includes(c));
  const itemName = !isCal ? tx.items[sim.load].name : '';
  let text;
  if (sKey === 'moving') text = ex.moving;
  else if (sKey === 'start') text = ex.start;
  else if (sKey === 'canMark') text = ex.canMark(n, f2(n * W1 * G));
  else if (sKey === 'ready') text = ex.ready;
  else if (sKey === 'next') text = `${sim.marks.length >= 2 ? `${ex.equal(f2(STEP * 100))} ` : ''}${nextN === 0 ? ex.nextZero : ex.next(nextN)}`;
  else if (sKey === 'item') text = ex.item(itemName, f1(reading), f2(mEst));
  else text = ex.start;
  const tone = { moving: '#fbbf24', canMark: '#a3e635', ready: '#34d399', item: '#f472b6' }[sKey] ?? '#22d3ee';

  const legend = [
    { label: tx.legend.fel, color: COL.fel, kind: 'arrow' },
    { label: tx.legend.P, color: COL.mg, kind: 'arrow' },
    { label: tx.legend.pointer, color: COL.pointer, kind: 'dot' },
    { label: tx.legend.mark, color: '#0f172a', kind: 'line' },
  ];

  /* ---- calculation */
  const rows = isCal
    ? [
        { sym: 'P', color: COL.mgText, formula: 'mg', subst: `${fmt(sim.m, 3, dec)} ${u.kg} · 9.8 ${T.ms2}`, result: `${f2(P)} ${u.N}` },
        { sym: 'x', color: COL.xText, formula: 'P / k', subst: `${f2(P)} ${u.N} / ${K} ${u.Nm}`, result: `${fmt(P / K, 4, dec)} ${T.m}` },
      ]
    : [
        { sym: 'P', color: COL.mgText, formula: `${T.fel} = kx`, subst: `${K} ${u.Nm} · ${fmt(sim.x, 4, dec)} ${T.m}`, result: `${f2(F)} ${u.N}` },
        { sym: 'm', color: '#f9a8d4', formula: 'P / g', subst: `${f2(F)} ${u.N} / 9.8 ${T.ms2}`, result: `${fmt(F / G, 2, dec)} ${u.kg}` },
      ];

  const graphPoints = [
    ...sim.marks.map((c) => ({ x: c * STEP * 100, y: c, color: COL.felText })),
    ...(ready ? sim.measured : []).map((id) => ({ x: ((ITEM[id].m * G) / K) * 100, y: Math.round(((ITEM[id].m * G) / K / STEP) * 10) / 10, color: '#f472b6' })),
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-[5]">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{tx.calLabel}</p>
          <Segmented
            label={tx.calLabel}
            className="grid-cols-3 sm:grid-cols-5"
            size="lg"
            value={sim.load}
            onChange={pick}
            accent="#fbbf24"
            options={CAL.map((c) => ({ value: `c${c}`, label: c === 0 ? tx.none : tx.weights(c), sub: tx.weightsSub(c) }))}
          />
        </div>
        <div className="min-w-0 flex-[3]">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{tx.unkLabel}</p>
          <Segmented
            label={tx.unkLabel}
            className="grid-cols-3"
            size="lg"
            value={sim.load}
            onChange={pick}
            accent="#f472b6"
            disabled={!ready}
            options={ITEMS.map((i) => ({ value: i.id, label: tx.items[i.id].name, sub: ready ? tx.unknown : tx.locked, icon: i.icon }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 xl:flex">
          <Btn variant="primary" icon={PenLine} onClick={mark} disabled={!canMark} className="min-h-[52px] text-[15px] xl:min-w-[150px]">
            {isCal && sim.marks.includes(n) ? tx.marked : tx.mark}
          </Btn>
          <Btn icon={RotateCcw} onClick={reset} disabled={sim.marks.length === 0 && sim.load === 'c0'} className="min-h-[52px] text-[15px]">
            {T.common.reset}
          </Btn>
        </div>
      </div>

      <SimScene
        legend={legend}
        chip={<TimeChip text={T.common.slower(SLOW)} extra={`k = ${K} ${u.Nm}`} />}
        ariaLabel={tx.sceneLabel(isCal ? tx.weights(n) : itemName, f2(xcm), f2(F), sim.marks.length)}
        height={(W, narrow) => (narrow ? clamp(W * 1.6, 520, 620) : clamp(W * 0.5, 480, 560))}
      >
        {(W, H, narrow) => <MeterDrawing W={W} H={H} narrow={narrow} sim={sim} F={F} P={P} ready={ready} tx={tx} T={T} />}
      </SimScene>

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {rich(text)}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={tx.readouts.load}
          symbol="m"
          value={isCal ? String(Math.round(sim.m * 1000)) : '?'}
          unit={u.g}
          accent="#eab308"
          textColor="#fde68a"
          sub={isCal ? (n === 0 ? tx.none : rich(tx.readouts.loadSub(tx.weights(n), f2(P)))) : tx.readouts.unknownSub(itemName)}
        />
        <Readout label={tx.readouts.x} symbol="x" value={f2(xcm)} unit={u.cm} accent={COL.x} textColor={COL.xText} sub={tx.readouts.xSub(fmt(sim.x, 4, dec))} />
        <Readout label={tx.readouts.fel} symbol={rich(T.fel)} value={f2(F)} unit={u.N} accent={COL.fel} textColor={COL.felText} sub={rich(tx.readouts.felSub)} />
        {isCal ? (
          <Readout
            label={tx.readouts.marks}
            value={`${sim.marks.length} / ${CAL.length}`}
            accent={ready ? '#34d399' : '#a3e635'}
            textColor={ready ? '#6ee7b7' : '#d9f99d'}
            sub={ready ? tx.readouts.ready : tx.readouts.step(f2(STEP * 100))}
          />
        ) : (
          <Readout
            label={tx.readouts.reading}
            symbol="P"
            value={sim.running ? '…' : `≈ ${f1(reading)}`}
            unit={u.N}
            accent="#f472b6"
            textColor="#f9a8d4"
            active={!sim.running}
            sub={sim.running ? tx.readouts.wait : rich(tx.readouts.massEst(f2(mEst), Math.round(ITEM[sim.load].m * 1000)))}
          />
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <div>
            <p className="text-sm font-semibold text-gray-200">{tx.steps.title}</p>
            <ul className="mt-2 grid grid-cols-5 gap-1.5">
              {CAL.map((c) => {
                const on = sim.marks.includes(c);
                return (
                  <li
                    key={c}
                    className={`flex flex-col items-center rounded-xl border px-1 py-2 text-center text-sm tabular-nums ${on ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-200' : 'border-white/10 bg-black/25 text-gray-400'}`}
                  >
                    {on ? <Check size={16} aria-hidden="true" /> : <span className="h-4 w-4 rounded-full border border-current opacity-60" aria-hidden="true" />}
                    <span className="mt-1 font-semibold">{`${c} ${u.N}`}</span>
                    <span className="sr-only">{on ? tx.steps.done : tx.steps.todo}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs leading-snug text-gray-500">{tx.steps.note}</p>
          </div>
          <Calc title={tx.calc} rows={rows} />
        </Panel>
        <Panel className="lg:col-span-3">
          <XYGraph
            title={tx.graph.title}
            legend={[
              { label: tx.graph.marks, color: COL.felText, kind: 'dot' },
              { label: tx.graph.items, color: '#f472b6', kind: 'dot' },
            ]}
            xMin={0}
            xMax={11}
            yMin={0}
            yMax={4.5}
            xStep={1}
            yStep={1}
            xLabel={tx.graph.x}
            yLabel={tx.graph.y}
            lines={sim.marks.length >= 2 ? [{ id: 'cal', pts: [{ x: 0, y: 0 }, { x: 11, y: 11 / (STEP * 100) }], color: COL.felText, width: 2, dash: '6 5' }] : []}
            points={graphPoints}
            marker={{ x: xcm, y: scaleN, color: '#fff' }}
            height={240}
            decimal={dec}
            ariaLabel={tx.graph.label}
            note={tx.graph.note}
          />
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ the scene */

function Apple2({ x, y, opacity = 1 }) {
  return (
    <g opacity={opacity}>
      <path d={`M${x},${y} l0,6`} stroke="#334155" strokeWidth="1.5" />
      <path d={`M${x},${y + 6} q -1 6 0 9`} stroke="#713f12" strokeWidth="2" fill="none" />
      <path d={`M${x + 1},${y + 9} q 9 -6 13 0 q -7 5 -13 0`} fill="#16a34a" />
      <path d={`M${x},${y + 17} c -12 -6 -24 4 -20 18 c 3 11 12 14 20 10 c 8 4 17 1 20 -10 c 4 -14 -8 -24 -20 -18 Z`} fill="#dc2626" stroke="#991b1b" strokeWidth="1" />
      <ellipse cx={x - 9} cy={y + 26} rx={4} ry={6} fill="#fff" opacity="0.35" />
    </g>
  );
}

function Phone({ x, y, strings = true, opacity = 1 }) {
  return (
    <g opacity={opacity}>
      {strings && <path d={`M${x},${y} L${x - 10},${y + 12} M${x},${y} L${x + 10},${y + 12}`} stroke="#334155" strokeWidth="1.5" />}
      <rect x={x - 17} y={y + 12} width={34} height={62} rx={7} fill="#1e293b" stroke="#0f172a" />
      <rect x={x - 14} y={y + 17} width={28} height={50} rx={3} fill="#38bdf8" opacity="0.8" />
      <circle cx={x} cy={y + 70} r={1.8} fill="#64748b" />
    </g>
  );
}

function Book({ x, y, strings = true, opacity = 1 }) {
  return (
    <g opacity={opacity}>
      {strings && <path d={`M${x},${y} L${x - 22},${y + 14} M${x},${y} L${x + 22},${y + 14}`} stroke="#334155" strokeWidth="1.5" />}
      <rect x={x - 30} y={y + 14} width={60} height={40} rx={3} fill="#2563eb" stroke="#1e3a8a" />
      <rect x={x - 30} y={y + 14} width={8} height={40} rx={2} fill="#1e40af" />
      <rect x={x - 14} y={y + 24} width={34} height={6} rx={1} fill="#bfdbfe" opacity="0.85" />
      {strings && <line x1={x - 22} x2={x + 22} y1={y + 14} y2={y + 14} stroke="#334155" strokeWidth="1.5" />}
    </g>
  );
}

/** The lab bench: the 1 N weights not in use and the bodies to weigh (faded while on the hook or before calibration). */
function Shelf({ x0, x1, y, n, load, ready, tx }) {
  const w = x1 - x0;
  const spot = (f) => x0 + w * f;
  const free = 4 - n;
  const label = (x, text) => (
    <text x={x} y={y + 24} textAnchor="middle" fontSize="11" fontWeight="600" fill="#475569">
      {text}
    </text>
  );
  return (
    <g pointerEvents="none">
      <rect x={x0} y={y} width={w} height={8} rx={2} fill="#d6b88a" stroke="#a16207" strokeWidth="1" />
      {Array.from({ length: 4 }, (_, i) => (
        <rect key={i} x={spot(0.12) - 20} y={y - 11 - i * 11} width={40} height={10} rx={2.5} fill="url(#ef-brass)" stroke="#78350f" strokeWidth="0.8" opacity={i < free ? 1 : 0.15} />
      ))}
      {label(spot(0.12), tx.shelf.weights(free))}
      <Apple2 x={spot(0.38)} y={y - 46} opacity={load === 'apple' ? 0.15 : ready ? 1 : 0.45} />
      {label(spot(0.38), tx.items.apple.name)}
      <Phone x={spot(0.6)} y={y - 75} strings={false} opacity={load === 'phone' ? 0.15 : ready ? 1 : 0.45} />
      {label(spot(0.6), tx.items.phone.name)}
      <Book x={spot(0.84)} y={y - 55} strings={false} opacity={load === 'book' ? 0.15 : ready ? 1 : 0.45} />
      {label(spot(0.84), tx.items.book.name)}
      <text x={spot(0.5)} y={y + 44} textAnchor="middle" fontSize="11" fill="#94a3b8">
        {ready ? tx.shelf.ready : tx.shelf.locked}
      </text>
    </g>
  );
}

function loadHeight(load) {
  if (load === 'apple') return 50;
  if (load === 'phone') return 76;
  if (load === 'book') return 56;
  return 14 + Number(load.slice(1)) * 11;
}

function MeterDrawing({ W, H, narrow, sim, F, P, ready, tx, T }) {
  const dec = T.decimal;
  const u = T.u;
  const fs = narrow ? 11 : 12;
  const box = { w: W, h: H };
  const f2 = (v) => fmt(v, 2, dec);

  const armY = narrow ? 40 : 66;
  const fpx = narrow ? 13 : 15; // px per newton
  const loadRoom = 36 + 4.1 * fpx + 18; // tallest load's centre, the longest mg arrow and its label
  const s = clamp((H - armY - 58 - loadRoom) / 22.2, 8, 18); // px per cm
  const dx = Math.round(narrow ? W * 0.42 : W * 0.22);
  const hw = narrow ? 30 : 36;
  const hTop = armY + 22;
  const sTop = hTop + 12;
  const p0 = sTop + 1.6 * s; // pointer at 0 N
  const hBot = p0 + 10.6 * s + 10;
  const xcm = sim.x * 100;
  const py = p0 + xcm * s;
  const hookY = py + (hBot - p0) + 14;
  const slotL = dx - hw + 9;
  const slotR = dx + 2;
  const stripL = dx + 6;
  const stripR = dx + hw - 6;
  const stepPx = STEP * 100 * s;

  /* marks on the instrument */
  const marks = sim.marks.map((c) => (
    <g key={c}>
      <line x1={stripL} x2={stripR} y1={p0 + c * stepPx} y2={p0 + c * stepPx} stroke="#0f172a" strokeWidth="1.6" />
      <text x={stripR - 2} y={p0 + c * stepPx - 2.5} textAnchor="end" fontSize="9.5" fontWeight="700" fill="#0f172a">
        {c}
      </text>
    </g>
  ));
  const minor = [];
  if (ready)
    for (let i = 1; i < 40; i += 1)
      if (i % 10)
        minor.push(<line key={i} x1={stripL} x2={stripL + (i % 5 ? 6 : 10)} y1={p0 + (i / 10) * stepPx} y2={p0 + (i / 10) * stepPx} stroke="#334155" strokeWidth="0.8" />);

  /* magnified strip (wide screens) */
  const s2 = (H - armY - 74) / 11; // px per cm on the strip
  const zx = W * 0.4;
  const zy0 = armY + 10 + 0.4 * s2;
  const zStep = STEP * 100 * s2;
  const zW = 96;
  const zoom = [];
  if (!narrow) {
    sim.marks.forEach((c) => {
      const y = zy0 + c * zStep;
      zoom.push(
        <g key={`z${c}`}>
          <line x1={zx} x2={zx + zW} y1={y} y2={y} stroke="#0f172a" strokeWidth="2.2" />
          <text x={zx + zW - 6} y={y - 5} textAnchor="end" fontSize="14" fontWeight="700" fill="#0f172a">
            {`${c} ${u.N}`}
          </text>
        </g>,
      );
      if (sim.marks.includes(c + 1)) {
        const yb = zy0 + (c + 1) * zStep;
        zoom.push(
          <g key={`d${c}`}>
            <Arrow x1={zx + zW + 22} y1={(y + yb) / 2} x2={zx + zW + 22} y2={y + 2} color={COL.x} width={1.8} head={7} />
            <Arrow x1={zx + zW + 22} y1={(y + yb) / 2} x2={zx + zW + 22} y2={yb - 2} color={COL.x} width={1.8} head={7} />
            <text x={zx + zW + 30} y={(y + yb) / 2 + 4} fontSize="12" fontWeight="600" fill={COL.x}>
              {tx.spacing(f2(STEP * 100))}
            </text>
          </g>,
        );
      }
    });
    if (ready)
      for (let i = 1; i < 40; i += 1)
        if (i % 10) zoom.push(<line key={`zm${i}`} x1={zx} x2={zx + (i % 5 ? 12 : 22)} y1={zy0 + (i / 10) * zStep} y2={zy0 + (i / 10) * zStep} stroke="#334155" strokeWidth="1" />);
  }
  const zPy = zy0 + xcm * s2;

  /* load and forces */
  const lh = loadHeight(sim.load);
  const n = sim.load.startsWith('c') ? Number(sim.load.slice(1)) : 0;
  const discs = [];
  for (let i = 0; i < n; i += 1) {
    const y = hookY + 14 + i * 11;
    discs.push(
      <g key={i}>
        <rect x={dx - 20} y={y} width={40} height={10} rx={2.5} fill="url(#ef-brass)" stroke="#78350f" strokeWidth="0.8" />
        <text x={dx} y={y + 8} textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#451a03">
          {`1 ${u.N}`}
        </text>
      </g>,
    );
  }
  const ax = dx + hw + (narrow ? 14 : 22);
  const loadMid = hookY + lh / 2 + 6;

  return (
    <g>
      <Defs />
      <rect width={W} height={H} fill="#fbfcfe" />
      <Stand rodX={dx - (narrow ? 70 : 110)} armY={armY} hookX={dx} baseY={H - 16} baseL={narrow ? 14 : 30} baseR={narrow ? 50 : 70} />

      {/* ring and housing */}
      <circle cx={dx} cy={armY + 14} r={6} fill="none" stroke="#334155" strokeWidth="2.4" />
      <rect x={dx - hw} y={hTop} width={hw * 2} height={hBot - hTop} rx={10} fill="#e2e8f0" stroke="#475569" strokeWidth="1.6" />
      <rect x={dx - hw + 3} y={hTop + 3} width={hw * 2 - 6} height={6} rx={3} fill="#fff" opacity="0.6" />
      <rect x={slotL} y={sTop - 4} width={slotR - slotL} height={hBot - sTop - 4} rx={4} fill="#334155" />
      <rect x={stripL} y={sTop - 4} width={stripR - stripL} height={hBot - sTop - 4} rx={2} fill="#fff" stroke="#94a3b8" />
      <text x={(stripL + stripR) / 2} y={sTop + 6} textAnchor="middle" fontSize="9" fontWeight="700" fill="#475569">
        {u.N}
      </text>
      {minor}
      {marks}

      {/* spring, pointer, rod */}
      <CoilV x={(slotL + slotR) / 2} y1={sTop} y2={py - 3} r={(slotR - slotL) / 2 - 2.5} />
      <rect x={slotL + 1} y={py - 3} width={slotR - slotL - 2} height={6} rx={2} fill="#94a3b8" stroke="#475569" />
      <path d={`M${slotR - 1},${py} L${stripL + 9},${py - 5} L${stripL + 9},${py + 5} Z`} fill={COL.pointer} stroke="#9f1239" strokeWidth="0.8" />
      <line x1={(slotL + slotR) / 2} x2={(slotL + slotR) / 2} y1={py + 3} y2={hookY} stroke="#64748b" strokeWidth="3" />
      <path d={`M${(slotL + slotR) / 2},${hookY} q 0 7 6 7 q 6 0 6 -6`} fill="none" stroke="#334155" strokeWidth="2.4" strokeLinecap="round" />

      {/* load on the hook */}
      <g transform={`translate(${(slotL + slotR) / 2 + 6 - dx},0)`}>
        {sim.load.startsWith('c') && n > 0 && (
          <g>
            <line x1={dx} x2={dx} y1={hookY + 6} y2={hookY + 14 + n * 11} stroke="#334155" strokeWidth="1.8" />
            {discs}
          </g>
        )}
        {sim.load === 'apple' && <Apple2 x={dx} y={hookY + 6} />}
        {sim.load === 'phone' && <Phone x={dx} y={hookY + 6} />}
        {sim.load === 'book' && <Book x={dx} y={hookY + 6} />}
      </g>

      {/* forces: elastic force on the body (at the hook), weight of the body */}
      {sim.m > 0 && (
        <g>
          <line x1={dx + 4} x2={ax} y1={hookY + 6} y2={hookY + 6} stroke={COL.fel} strokeDasharray="2 2" />
          <Arrow x1={ax} y1={hookY + 6} x2={ax} y2={hookY + 6 - F * fpx} color={COL.fel} width={3.5} head={11} />
          <Tag x={ax + 7} y={hookY + 6 - F * fpx + 10} text={T.fel} color={COL.fel} anchor="start" size={narrow ? 12 : 14} />
          <line x1={dx + 4} x2={ax + 14} y1={loadMid} y2={loadMid} stroke={COL.mg} strokeDasharray="2 2" />
          <Arrow x1={ax + 14} y1={loadMid} x2={ax + 14} y2={loadMid + P * fpx} color={COL.mg} width={3.5} head={11} />
          <Tag x={ax + 21} y={loadMid + P * fpx - 2} text="mg" color={COL.mg} anchor="start" size={narrow ? 12 : 14} />
        </g>
      )}
      {sim.load !== 'c0' && !sim.load.startsWith('c') && (
        <RichPill x={dx - hw - 10} y={hookY + lh / 2 + 6} anchor="end" text={tx.items[sim.load].name} bg="#fff" color="#9d174d" border="#f9a8d4" size={fs} box={box} />
      )}

      {/* magnified scale */}
      {!narrow && (
        <g>
          <text x={zx + zW / 2} y={armY - 2} textAnchor="middle" fontSize="12" fontWeight="600" fill="#475569">
            {tx.zoom(fmt(s2 / s, 1, dec))}
          </text>
          <line x1={stripR} y1={sTop} x2={zx} y2={zy0 - 0.4 * s2} stroke="#cbd5e1" />
          <line x1={stripR} y1={hBot - 8} x2={zx} y2={zy0 + 10.6 * s2} stroke="#cbd5e1" />
          <rect x={zx} y={zy0 - 0.4 * s2} width={zW} height={11 * s2} rx={4} fill="#fff" stroke="#94a3b8" strokeWidth="1.5" />
          {zoom}
          <line x1={zx - 26} x2={zx + 4} y1={zPy} y2={zPy} stroke={COL.pointer} strokeWidth="2.5" />
          <path d={`M${zx + 12},${zPy} l-12,-7 l0,14 Z`} fill={COL.pointer} />
          {sim.marks.length === 0 && (
            <text x={zx + zW / 2} y={zy0 + 5.2 * s2} textAnchor="middle" fontSize="12" fill="#94a3b8">
              {tx.blank}
            </text>
          )}
          {!sim.load.startsWith('c') && !sim.running && ready && (
            <RichPill x={zx - 30} y={zPy} anchor="end" text={tx.readTag(fmt(Math.round((sim.x / STEP) * 10) / 10, 1, dec))} bg="#db2777" size={12} box={box} />
          )}
        </g>
      )}

      {!narrow && <Shelf x0={W * 0.62} x1={W - 24} y={H - 64} n={n} load={sim.load} ready={ready} tx={tx} />}

      {/* force scale */}
      <g>
        <line x1={W - 22 - fpx} x2={W - 22} y1={H - 16} y2={H - 16} stroke="#334155" strokeWidth="2" />
        <line x1={W - 22 - fpx} x2={W - 22 - fpx} y1={H - 20} y2={H - 12} stroke="#334155" strokeWidth="1.5" />
        <line x1={W - 22} x2={W - 22} y1={H - 20} y2={H - 12} stroke="#334155" strokeWidth="1.5" />
        <text x={W - 28 - fpx} y={H - 12} textAnchor="end" fontSize="11" fill="#475569">
          {tx.scale}
        </text>
      </g>
    </g>
  );
}

/** A narrow spring in the dynamometer's slot (a zigzag seen from the front). */
function CoilV({ x, y1, y2, r }) {
  const turns = 10;
  const pts = [];
  const L = y2 - y1;
  for (let i = 0; i <= turns * 2; i += 1) {
    const y = y1 + 4 + ((L - 8) * i) / (turns * 2);
    pts.push(`${(x + (i === 0 || i === turns * 2 ? 0 : i % 2 ? r : -r)).toFixed(1)},${y.toFixed(1)}`);
  }
  return (
    <g pointerEvents="none">
      <line x1={x} x2={x} y1={y1} y2={y1 + 4} stroke="#e2e8f0" strokeWidth="2" />
      <polyline points={pts.join(' ')} fill="none" stroke="#e2e8f0" strokeWidth="2" strokeLinejoin="round" />
      <line x1={x} x2={x} y1={y2 - 4} y2={y2} stroke="#e2e8f0" strokeWidth="2" />
    </g>
  );
}
