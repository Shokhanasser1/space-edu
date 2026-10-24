import { useState } from 'react';
import { Lightbulb } from 'lucide-react';

import { Explain, Pill, RangeField, Readout, textWidth, useRafLoop, useSettled } from '../kit/ui';
import { TimeGraph } from '../kit/scene';
import {
  COL,
  Chip,
  FormulaTile,
  LabScene,
  PlayControls,
  Rich,
  Ruler,
  SvgSym,
  TopCar,
  energyText,
  hash01,
  lineView,
  niceMax,
  num,
  round,
  rulerStep,
  tickDigits,
  trim,
} from './KineticEnergy.parts';

/**
 * Tab 3 — stopping distance. Three identical cars at 30, 60 and 90 km/h
 * brake from the same line with the same braking force F. The force does
 * negative work until all the kinetic energy is gone (turned into heat in
 * the brakes): F·s = mv²/2, so s = mv²/(2F) ∝ v². Preset m = 1000 kg,
 * F = 5 kN (a = 5 m/s²): E_k = 34.7 / 138.9 / 312.5 kJ, s = 6.94 / 27.78 /
 * 62.5 m — ratio 1 : 4 : 9. Strings come from T.brake.
 */

const SPEEDS = [30, 60, 90];
const LOOK = [
  { car: '#2563eb', text: '#93c5fd' },
  { car: '#d97706', text: '#fcd34d' },
  { car: '#9333ea', text: '#d8b4fe' },
];
const IDLE = { t: 0, running: false, done: false };

export default function BrakeSim({ T }) {
  const L = T.brake;
  const dec = T.decimal;
  const [F, setF] = useState(5000);
  const [m, setM] = useState(1000);
  const [sim, setSim] = useState(IDLE);
  const a = F / m;
  const cars = SPEEDS.map((kmh, i) => {
    const v0 = kmh / 3.6;
    return { kmh, v0, tStop: v0 / a, s: (m * v0 * v0) / (2 * F), E0: (m * v0 * v0) / 2, ...LOOK[i] };
  });
  const tMax = cars[2].tStop;
  const speedUp = tMax > 8 ? Math.ceil(tMax / 6) : 1;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(tMax, p.t + dt * speedUp);
      const done = t >= tMax - 1e-9;
      return { t, running: !done, done };
    });
  });

  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);
  const change = (setter) => (val) => {
    setter(val);
    setSim(IDLE);
  };

  const t = sim.t;
  const pos = (c) => (t >= c.tStop ? c.s : c.v0 * t - 0.5 * a * t * t);
  const vel = (c) => Math.max(0, c.v0 - a * t);
  const S = (n) => round(n, n < 100 ? 2 : 1, dec);
  const St = (n) => trim(n, dec, 2);
  const D = (n) => trim(n, dec);
  const E = (n) => energyText(n, T, dec);
  const kN = (n) => trim(n / 1000, dec, 1);

  let key = 'idle';
  if (sim.done) key = 'done';
  else if (t >= cars[1].tStop) key = 'second';
  else if (t >= cars[0].tStop) key = 'first';
  else if (t > 0) key = 'braking';
  const settled = useSettled(key, key === 'braking' ? 200 : 0);
  const ex = L.explain;
  const text = {
    idle: ex.idle(D(m), kN(F)),
    braking: ex.braking(kN(F)),
    first: ex.first(St(cars[0].s), E(cars[0].E0)),
    second: ex.second(St(cars[1].s)),
    done: ex.done(St(cars[0].s), St(cars[1].s), St(cars[2].s)),
  }[settled];
  const tone = { idle: '#22d3ee', braking: '#fb923c', first: '#fbbf24', second: '#fbbf24', done: '#34d399' }[settled];

  const xTop = niceMax(cars[2].s);
  const eTop = niceMax(cars[2].E0 / 1000);
  const ratio = cars.map((c) => trim(c.s / cars[0].s, dec, 1)).join(' : ');

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="grid min-w-0 flex-1 gap-x-5 rounded-2xl border border-white/10 bg-white/[0.035] px-3 pt-2 pb-1 sm:grid-cols-2 sm:px-4">
          <RangeField
            id="ke-b-F"
            label={L.F}
            symbol="F"
            min={2000}
            max={7000}
            step={500}
            value={F}
            onChange={change(setF)}
            accent={COL.force}
            display={`${kN(F)} ${T.kN}`}
            hint={L.FHint(D(a))}
          />
          <RangeField
            id="ke-b-m"
            label={L.m}
            symbol="m"
            min={1000}
            max={2000}
            step={100}
            value={m}
            onChange={change(setM)}
            accent="#94a3b8"
            display={`${D(m)} ${T.kg}`}
            hint={L.mHint}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <BrakeScene T={T} cars={cars} t={t} pos={pos} vel={vel} speedUp={speedUp} S={S} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        <Rich>{text}</Rich>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {cars.map((c) => (
          <Readout
            key={c.kmh}
            label={L.carName(D(c.kmh))}
            symbol="s"
            value={S(pos(c))}
            unit={T.m}
            accent={c.car}
            textColor={c.text}
            active={t > 0 && t >= c.tStop}
            sub={<Rich>{L.carSub(E(c.E0), S(c.s))}</Rich>}
          />
        ))}
        <Readout label={L.readouts.ratio} symbol={<Rich>s₁ : s₂ : s₃</Rich>} value={ratio} accent="#e2e8f0" active={sim.done} sub={L.ratioSub} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <FormulaTile
            tag={L.formula.tag}
            color={COL.heatText}
            general={L.formula.general}
            filled={L.formula.filled(D(m), D(F), St(cars[2].s))}
            result={L.formula.result}
            ok={sim.done}
          />
          <div className="rounded-xl bg-black/25 px-3 py-2.5">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500">
              <span>{L.energy.title}</span>
              <span className="flex items-center gap-1 normal-case tracking-normal">
                <span className="h-2 w-3 rounded-sm" style={{ background: COL.ekFill }} aria-hidden="true" />
                <span>
                  <Rich>{L.energy.ek}</Rich>
                </span>
              </span>
              <span className="flex items-center gap-1 normal-case tracking-normal">
                <span className="h-2 w-3 rounded-sm" style={{ background: COL.heatFill }} aria-hidden="true" />
                {L.energy.q}
              </span>
            </p>
            {cars.map((c) => {
              const q = F * pos(c);
              const left = Math.max(0, c.E0 - q);
              const w = (c.E0 / cars[2].E0) * 100;
              return (
                <div key={c.kmh} className="mt-2">
                  <div className="flex items-baseline justify-between gap-2 text-[12px] tabular-nums">
                    <span className="flex items-center gap-1.5 font-semibold text-gray-200">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.car }} aria-hidden="true" />
                      {L.carName(D(c.kmh))}
                    </span>
                    <span className="text-gray-400">
                      <span style={{ color: COL.ekText }}>{E(left)}</span> · <span style={{ color: COL.heatText }}>Q = {E(q)}</span>
                    </span>
                  </div>
                  <div className="relative mt-1 h-2.5 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true">
                    <span className="absolute inset-y-0 left-0 flex overflow-hidden rounded-full" style={{ width: `${w}%` }}>
                      <span className="h-full" style={{ width: `${(left / c.E0) * 100}%`, background: COL.ekFill }} />
                      <span className="h-full flex-1" style={{ background: COL.heatFill }} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <TimeGraph
            title={<Rich>{L.graph.title}</Rich>}
            ariaLabel={L.graph.label}
            series={cars.map((c) => {
              const x = pos(c);
              return {
                id: String(c.kmh),
                label: L.carName(D(c.kmh)),
                color: c.text,
                points: [
                  { x: 0, y: c.E0 / 1000 },
                  { x, y: (c.E0 - F * x) / 1000 },
                ],
              };
            })}
            xMax={xTop}
            yMax={eTop}
            xLabel={L.graph.x}
            yLabel={L.graph.y}
            note={L.graph.note(kN(F))}
            decimal={dec}
            xDigits={tickDigits(xTop)}
            yDigits={tickDigits(eTop)}
            height={220}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

function BrakeScene({ T, cars, t, pos, vel, speedUp, S }) {
  const L = T.brake;
  const dec = T.decimal;
  const sMax = cars[2].s;
  const lay = (narrow) => {
    const roadTop = narrow ? 56 : 64;
    const laneH = narrow ? 40 : 52;
    const roadBot = roadTop + 3 * (laneH + 1) + 3;
    const rulerY = roadBot + 16;
    return { roadTop, laneH, roadBot, rulerY, H: rulerY + 30 };
  };

  return (
    <LabScene
      legend={[
        { color: '#1f2937', label: L.legend.skid, kind: 'line' },
        { color: COL.force, label: L.legend.line, kind: 'dash' },
        { color: COL.force, label: L.legend.F, kind: 'arrow' },
      ]}
      chips={
        <Chip>
          {speedUp > 1 ? L.chipFast(speedUp) : L.chipReal} · t = {num(t, 1, dec)} {T.s}
        </Chip>
      }
      height={(W, narrow) => lay(narrow).H}
      ariaLabel={L.sceneLabel(cars.map((c) => L.laneAria(trim(c.kmh, dec), S(c.s))).join(', '))}
    >
      {(W, H, narrow) => {
        const { roadTop, laneH, roadBot, rulerY } = lay(narrow);
        const fs = narrow ? 10.5 : 12;
        const labelCol = narrow ? 80 : 150;
        const xEnd = sMax * 1.03;
        const padR = narrow ? 52 : 74;
        const kGuess = (W - labelCol - padR - 60) / xEnd;
        const carPx = Math.min(Math.max(4.4 * kGuess, narrow ? 26 : 40), narrow ? 40 : 70);
        const carW = laneH - (narrow ? 16 : 20);
        const view = lineView(0, xEnd, W, labelCol + carPx + (narrow ? 6 : 12), padR);
        const step = rulerStep(view, narrow ? 44 : 62);
        const ox = view.sx(0);
        const box = { w: W, h: H };
        const span = W - labelCol;
        return (
          <>
            <rect width={W} height={H} fill="#fbfcfe" />
            <rect x={labelCol} y={roadTop - 12} width={span} height={12} fill="#dcfce7" />
            <rect x={labelCol} y={roadBot} width={span} height={8} fill="#dcfce7" />
            {cars.map((c, i) => {
              const y0 = roadTop + 2 + i * (laneH + 1);
              const yc = y0 + laneH / 2;
              const x = pos(c);
              const sp = vel(c);
              const front = view.sx(x);
              const rear = front - carPx * 0.85;
              const stopped = t > 0 && t >= c.tStop;
              const specks = [];
              const count = Math.floor(span / 9);
              for (let k = 0; k < count; k += 1) {
                specks.push(<circle key={k} cx={labelCol + hash01(k * 7 + i * 101) * span} cy={y0 + 3 + hash01(k * 13 + i * 17) * (laneH - 6)} r={0.8 + hash01(k + 3) * 0.7} fill="#9ca3af" />);
              }
              const tag = L.distTag(S(x));
              const tagW = textWidth(tag, fs, 700) + 16;
              const braking = t > 0 && sp > 0.01;
              const fLen = narrow ? 18 : 30;
              return (
                <g key={c.kmh}>
                  <rect x={labelCol} y={y0} width={span} height={laneH} fill="#6b7280" />
                  {specks}
                  {i > 0 && (
                    <line x1={labelCol} x2={W} y1={y0 - 0.5} y2={y0 - 0.5} stroke="#f8fafc" strokeWidth={1.5} strokeDasharray="14 12" opacity={0.75} />
                  )}
                  {/* lane label */}
                  <rect x={0} y={y0} width={labelCol - 6} height={laneH} rx={8} fill="#f1f5f9" stroke="#e2e8f0" />
                  <rect x={0} y={y0} width={4} height={laneH} rx={2} fill={c.car} />
                  <text x={narrow ? 9 : 14} y={yc - (narrow ? 3 : 4)} fontSize={narrow ? 10 : 12.5} fontWeight="700" fill="#0f172a">
                    {L.carName(trim(c.kmh, dec))}
                  </text>
                  <SvgSym
                    x={narrow ? 9 : 14}
                    y={yc + (narrow ? 11 : 14)}
                    main={narrow ? '' : 'E'}
                    sub={narrow ? '' : T.kSub}
                    rest={narrow ? energyText(c.E0, T, dec) : ` = ${energyText(c.E0, T, dec)}`}
                    color={COL.ek}
                    fs={narrow ? 10 : 11.5}
                    weight={700}
                  />
                  {/* skid marks from the brake line */}
                  {rear > ox && (
                    <g opacity={0.55}>
                      <line x1={ox} x2={rear} y1={yc - carW * 0.3} y2={yc - carW * 0.3} stroke="#111827" strokeWidth={2.2} />
                      <line x1={ox} x2={rear} y1={yc + carW * 0.3} y2={yc + carW * 0.3} stroke="#111827" strokeWidth={2.2} />
                    </g>
                  )}
                  <TopCar x={front - carPx / 2} y={yc} len={carPx} wid={carW} color={c.car} braking={braking} />
                  {/* braking force on the car, against the motion */}
                  {braking && (
                    <g>
                      <line x1={front - carPx / 2} y1={yc} x2={front - carPx / 2 - fLen + 7} y2={yc} stroke={COL.force} strokeWidth={2.6} strokeLinecap="round" />
                      <path d={`M${front - carPx / 2 - fLen},${yc} l8,-4.5 l0,9 Z`} fill={COL.force} />
                    </g>
                  )}
                  {x > 0.01 && (
                    <Pill
                      x={front + 6 + tagW / 2}
                      y={yc}
                      text={stopped ? `✓ ${tag}` : tag}
                      bg={stopped ? c.car : '#ffffff'}
                      color={stopped ? '#fff' : '#0f172a'}
                      border={stopped ? undefined : '#cbd5e1'}
                      size={fs}
                      box={box}
                    />
                  )}
                </g>
              );
            })}
            {/* brake line */}
            <line x1={ox} x2={ox} y1={roadTop - 12} y2={roadBot + 6} stroke={COL.force} strokeWidth={2} strokeDasharray="5 4" />
            <text x={ox + 6} y={roadTop - 3} fontSize={fs - 1} fontWeight="700" fill="#b91c1c">
              {L.brakeLine}
            </text>
            <rect x={0} y={rulerY - 2} width={W} height={H - rulerY + 2} fill="#f8fafc" />
            <Ruler view={view} y={rulerY} step={step} unit={L.axisX} decimal={dec} fs={narrow ? 10 : 11} fromX={labelCol} toX={W} unitX={W - 8} />
          </>
        );
      }}
    </LabScene>
  );
}
