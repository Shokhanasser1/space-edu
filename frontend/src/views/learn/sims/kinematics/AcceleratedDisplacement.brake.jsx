import { useState } from 'react';
import { CloudRain, Lightbulb, Snowflake, Sun, TriangleAlert } from 'lucide-react';

import { Explain, Pill, RangeField, Readout, Segmented, fmt, textWidth, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE, TimeGraph } from '../kit/scene';
import { Chip, FormulaTile, GroupLabel, LabScene, PlayControls, Rich, Ruler, TopCar, lineView, niceMax, num, rulerStep, tickDigits } from './Acceleration.parts';

/**
 * Braking distance: with v = 0 the time-free formula s = (v² − v₀²)/(2a)
 * becomes s = v₀²/(2|a|). Two cars brake on the same line, one twice as
 * fast as the other, on the same surface: the faster one needs 2× the time
 * and 4× the road. A pedestrian crossing 25 m ahead makes the point.
 * Decelerations are typical tyre-road values. Strings come from T.brake.
 */

const SURFACES = {
  dry: { d: 7, icon: Sun },
  wet: { d: 4.5, icon: CloudRain },
  snow: { d: 2.5, icon: Snowflake },
  ice: { d: 1, icon: TriangleAlert },
};
const ZEBRA = [25, 29]; // m from the line where both drivers brake
const IDLE = { t: 0, running: false, done: false };

export default function BrakingDistanceSim({ T }) {
  const L = T.brake;
  const dec = T.decimal;
  const [kmh, setKmh] = useState(50);
  const [surf, setSurf] = useState('dry');
  const [sim, setSim] = useState(IDLE);
  const d = SURFACES[surf].d;
  const v1 = kmh / 3.6;
  const v2 = 2 * v1;
  const s1 = (v1 * v1) / (2 * d);
  const s2 = (v2 * v2) / (2 * d);
  const t1 = v1 / d;
  const t2 = v2 / d;
  const speedUp = t2 > 8 ? Math.ceil(t2 / 6) : 1;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(t2, p.t + dt * speedUp);
      const done = t >= t2 - 1e-9;
      return { t, running: !done, done };
    });
  });

  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);

  const t = sim.t;
  const pos = (v0, tt) => (tt >= v0 / d ? (v0 * v0) / (2 * d) : v0 * tt - 0.5 * d * tt * tt);
  const x1 = pos(v1, t);
  const x2 = pos(v2, t);
  const F = (n, k = 1) => num(n, k, dec);

  let key = 'idle';
  if (sim.done) key = 'done';
  else if (t >= t1 - 1e-9) key = 'oneStopped';
  else if (t > 0) key = 'braking';
  const settled = useSettled(key, key === 'braking' ? 200 : 0);
  const ex = L.explain;
  const zebraKey = s1 > ZEBRA[0] ? 'both' : s2 > ZEBRA[0] ? 'second' : 'none';
  const text = {
    idle: ex.idle,
    braking: ex.braking,
    oneStopped: ex.oneStopped(F(s1)),
    done: `${ex.done(F(s1), F(s2))} ${ex.zebra[zebraKey]}`,
  }[settled];
  const tone = settled === 'done' ? (zebraKey === 'none' ? '#34d399' : '#f87171') : settled === 'idle' ? '#22d3ee' : '#fb923c';

  /* s(v₀) curve for the chosen surface, v₀ in km/h */
  const vMaxKmh = 160;
  const curve = [];
  for (let k = 0; k <= vMaxKmh; k += 4) curve.push({ x: k, y: (k / 3.6) ** 2 / (2 * d) });
  const yTop = niceMax(curve[curve.length - 1].y);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.surfaceLabel}</GroupLabel>
          <Segmented
            label={L.surfaceLabel}
            className="grid-cols-2 md:grid-cols-4"
            size="lg"
            value={surf}
            onChange={(id) => {
              setSurf(id);
              setSim(IDLE);
            }}
            options={Object.keys(SURFACES).map((id) => ({ value: id, label: L.surfaces[id].name, sub: L.surfaces[id].sub, icon: SURFACES[id].icon }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <BrakeScene T={T} x1={x1} x2={x2} s2={s2} t={t} speedUp={speedUp} v1={v1} d={d} done={sim.done} ariaLabel={L.sceneLabel(fmt(kmh, 0, dec), F(s1), fmt(2 * kmh, 0, dec), F(s2))} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.s1} symbol={<Rich>s₁</Rich>} value={F(x1)} unit={T.m} accent="#2563eb" textColor={PALETTE.dispText} sub={L.sSub(fmt(kmh, 0, dec), F(t1))} active={t >= t1 - 1e-9 && t > 0} />
        <Readout label={L.readouts.s2} symbol={<Rich>s₂</Rich>} value={F(x2)} unit={T.m} accent={PALETTE.second} textColor={PALETTE.secondText} sub={L.sSub(fmt(2 * kmh, 0, dec), F(t2))} active={sim.done} />
        <Readout label={<Rich>{L.readouts.ratio}</Rich>} value={`${F(s2 / s1)} : 1`} accent="#fbbf24" textColor="#fde68a" sub={L.ratioSub} />
        <Readout label={L.readouts.t} symbol="t" value={fmt(t, 1, dec)} unit={T.s} accent={PALETTE.time} textColor="#a5f3fc" sub={L.tSub(F(t1), F(t2))}>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full bg-cyan-400" style={{ width: `${(t / t2) * 100}%` }} />
          </div>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="bd-v"
            label={L.speed}
            symbol={<Rich>v₀</Rich>}
            min={20}
            max={80}
            step={10}
            value={kmh}
            onChange={(n) => {
              setKmh(n);
              setSim(IDLE);
            }}
            accent="#3b82f6"
            display={`${fmt(kmh, 0, dec)} ${T.kmh}`}
            hint={L.speedHint(F(v1), fmt(2 * kmh, 0, dec))}
          />
          <FormulaTile tag={L.formula.tag} color="#93c5fd" general={L.formula.general} filled={L.formula.filled(F(v1), F(d), F(s1))} result={`× 4  →  ${F(s2)} ${T.m}`} ok={sim.done} />
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <TimeGraph
            title={L.graph.title}
            series={[
              { id: 'curve', label: L.surfaces[surf].name, color: '#fdba74', points: curve, dot: false },
              { id: 'p1', label: L.graph.p1, color: '#60a5fa', points: [{ x: kmh, y: s1 }] },
              { id: 'p2', label: L.graph.p2, color: '#f472b6', points: [{ x: 2 * kmh, y: s2 }] },
            ]}
            xMax={vMaxKmh}
            yMax={yTop}
            xLabel={L.graph.x}
            yLabel={L.graph.y}
            note={L.graph.note}
            decimal={dec}
            yDigits={tickDigits(yTop)}
            height={220}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

function BrakeScene({ T, x1, x2, s2, t, speedUp, v1, d, done, ariaLabel }) {
  const L = T.brake;
  const dec = T.decimal;
  const sp1 = Math.max(0, v1 - d * t);
  const sp2 = Math.max(0, 2 * v1 - d * t);

  return (
    <LabScene
      legend={[
        { color: '#2563eb', label: L.legend.car1, kind: 'box' },
        { color: PALETTE.second, label: L.legend.car2, kind: 'box' },
        { color: '#334155', label: L.legend.skid, kind: 'line' },
        { color: '#94a3b8', label: L.legend.zebra, kind: 'dash' },
      ]}
      chips={
        <Chip>
          {speedUp > 1 ? L.chipFast(speedUp) : L.chipReal} · t = {fmt(t, 1, dec)} {T.s}
        </Chip>
      }
      height={(W, narrow) => (narrow ? 236 : 270)}
      ariaLabel={ariaLabel}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 11 : 12;
        const laneH = narrow ? 34 : 46;
        const xEnd = Math.max(s2, ZEBRA[1] + 6);
        const kGuess = (W - (narrow ? 60 : 110)) / xEnd;
        const carPx = Math.min(Math.max(4.5 * kGuess, narrow ? 34 : 48), narrow ? 60 : 92);
        const carW = Math.min(Math.max(1.8 * kGuess, narrow ? 15 : 21), laneH - 14);
        const padL = carPx + (narrow ? 10 : 20);
        const padR = narrow ? 18 : 30;
        const view = lineView(0, xEnd, W, padL, padR);
        const step = rulerStep(view, narrow ? 44 : 62);
        const roadTop = narrow ? 52 : 70;
        const roadBot = roadTop + 2 * laneH + 8;
        const lane1 = roadTop + 4 + laneH / 2;
        const lane2 = lane1 + laneH;
        const dim1 = roadBot + 18;
        const dim2 = dim1 + 24;
        const rulerY = H - 32;
        const ox = view.sx(0);
        const zx0 = view.sx(ZEBRA[0]);
        const zx1 = view.sx(ZEBRA[1]);
        const box = { w: W, h: H };
        const stripes = [];
        for (let y = roadTop + 6; y + 5 <= roadBot - 4; y += 9) stripes.push(y);
        const carFront = (x) => view.sx(x);
        const carCx = (x) => carFront(x) - carPx / 2;
        const skid = (x, y) => {
          const rear = carFront(x) - carPx * 0.85;
          if (rear <= ox) return null;
          return (
            <g opacity="0.55">
              <line x1={ox} x2={rear} y1={y - carW * 0.32} y2={y - carW * 0.32} stroke="#1e293b" strokeWidth={2.2} />
              <line x1={ox} x2={rear} y1={y + carW * 0.32} y2={y + carW * 0.32} stroke="#1e293b" strokeWidth={2.2} />
            </g>
          );
        };
        const speedLabel = (x, y, sp) => {
          const text = L.speedTag(fmt(sp * 3.6, 0, dec));
          const w = textWidth(text, fs - 1, 700);
          const ahead = carFront(x) + 8 + w < W - 4;
          return (
            <text x={ahead ? carFront(x) + 8 : carFront(x) - carPx - 8} y={y + 4} textAnchor={ahead ? 'start' : 'end'} fontSize={fs - 1} fontWeight="700" fill="#f8fafc" className="tabular-nums">
              {text}
            </text>
          );
        };
        const dim = (x, y, color, label, extra) => {
          const xb = carFront(x);
          if (xb - ox < 4) return null;
          const w = textWidth(label, fs, 700) + 16;
          const mid = (ox + xb) / 2;
          return (
            <g>
              <line x1={ox} x2={xb} y1={y} y2={y} stroke={color} strokeWidth={2} />
              <line x1={ox} x2={ox} y1={y - 6} y2={y + 6} stroke={color} strokeWidth={2} />
              <line x1={xb} x2={xb} y1={y - 6} y2={y + 6} stroke={color} strokeWidth={2} />
              <Pill x={xb - ox > w + 8 ? mid : xb + w / 2 + 6} y={y} text={label} bg={color} size={fs} box={box} />
              {extra}
            </g>
          );
        };
        return (
          <>
            <rect width={W} height={H} fill="#fbfcfe" />
            {/* verges */}
            <rect x={0} y={roadTop - 14} width={W} height={14} fill="#dcfce7" />
            <rect x={0} y={roadBot} width={W} height={10} fill="#dcfce7" />
            {/* asphalt */}
            <rect x={0} y={roadTop} width={W} height={roadBot - roadTop} fill="#64748b" />
            <line x1={0} x2={W} y1={roadTop + 2} y2={roadTop + 2} stroke="#f8fafc" strokeWidth={2} />
            <line x1={0} x2={W} y1={roadBot - 2} y2={roadBot - 2} stroke="#f8fafc" strokeWidth={2} />
            <line x1={0} x2={W} y1={roadTop + 4 + laneH} y2={roadTop + 4 + laneH} stroke="#f8fafc" strokeWidth={2} strokeDasharray="14 12" />
            {/* pedestrian crossing */}
            {stripes.map((y) => (
              <rect key={y} x={zx0} y={y} width={Math.max(3, zx1 - zx0)} height={5} fill="#f8fafc" opacity="0.95" />
            ))}
            {/* brake line */}
            <line x1={ox} x2={ox} y1={roadTop - 12} y2={roadBot + 8} stroke="#dc2626" strokeWidth={2} strokeDasharray="5 4" />
            <text x={ox + 6} y={roadTop - 3} fontSize={fs - 1} fontWeight="700" fill="#b91c1c">
              {L.brakeLine}
            </text>
            {skid(x1, lane1)}
            {skid(x2, lane2)}
            <TopCar x={carCx(x1)} y={lane1} len={carPx} wid={carW} color="#2563eb" braking={sp1 > 0.01 && t > 0} />
            <TopCar x={carCx(x2)} y={lane2} len={carPx} wid={carW} color={PALETTE.second} braking={sp2 > 0.01 && t > 0} />
            {speedLabel(x1, lane1, sp1)}
            {speedLabel(x2, lane2, sp2)}
            {/* distances from the brake line */}
            {dim(x1, dim1, '#2563eb', L.distTag(num(x1, 1, dec)))}
            {dim(
              x2,
              dim2,
              PALETTE.second,
              L.distTag(num(x2, 1, dec)),
              done ? <Pill x={Math.min(carFront(x2) + 36, W - 30)} y={dim2 - 1} text={L.times4} bg="#f59e0b" color="#0f172a" size={fs} box={box} /> : null,
            )}
            <rect x={0} y={rulerY - 2} width={W} height={H - rulerY + 2} fill="#f8fafc" />
            <Ruler view={view} W={W} y={rulerY} step={step} unit={L.axisX} decimal={dec} fs={fs - 1} />
          </>
        );
      }}
    </LabScene>
  );
}
