import { useState } from 'react';
import { BookOpen, Lightbulb, Map as MapIcon, Timer, Truck, Turtle } from 'lucide-react';

import { Arrow, Explain, Pill, RangeField, Readout, Segmented, fmt, niceStep, textWidth, useRafLoop, useSettled, useTween } from '../kit/ui';
import { PALETTE } from '../kit/scene';
import { Chip, FormulaTile, GroupLabel, LabScene, PlayControls, Rich, Ruler, TopCar, TopLorry, lineView, niceMax, num, rulerStep, tickDigits, trim } from './Acceleration.parts';
import XTGraph from './TwoBodies.graph';

/**
 * Overtaking: a car (4 m) passes a lorry (16 m), starting 15 m behind it
 * and pulling back in 15 m ahead — 50 m relative to the lorry, covered at
 * the relative speed v₁ − v₂. The same motion is shown from the road and
 * from the lorry (camera, axis and velocities attached to the chosen body;
 * the camera glides between them). Strings come from T.overtake.
 */

const LORRY = 16; // m
const CAR = 4; // m
const GAP = 15; // m, behind before and ahead after
const REL = GAP + LORRY + CAR + GAP; // 50 m relative to the lorry
const PRESETS = {
  lesson: { vc: 25, vl: 15, icon: BookOpen },
  slow: { vc: 20, vl: 18, icon: Turtle },
};
const IDLE = { t: 0, running: false, done: false };

const smooth = (a, b, x) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};
/** 0 = own (right) lane, 1 = oncoming lane, from the car front's position p relative to the lorry's rear. */
const laneOf = (p) => smooth(-GAP, -GAP + 9, p) * (1 - smooth(REL - GAP - 8, REL - GAP, p));

/** A tick-friendly range lo…hi split into 4 equal steps. */
function niceRange(lo, hi) {
  let step = niceMax(Math.max(hi - lo, 1)) / 4;
  for (let i = 0; i < 6; i += 1) {
    const y0 = Math.floor(lo / step) * step;
    if (y0 + 4 * step >= hi - 1e-9) return { yMin: y0, yMax: y0 + 4 * step, step };
    step = niceMax(step * 4.4) / 4;
  }
  return { yMin: lo, yMax: hi, step: (hi - lo) / 4 };
}

export default function OvertakeSim({ T }) {
  const L = T.overtake;
  const dec = T.decimal;
  const [frame, setFrame] = useState('road');
  const [blend, setBlend] = useTween(0);
  const [vc, setVc] = useState(25);
  const [vl, setVl] = useState(15);
  const [sim, setSim] = useState(IDLE);
  const vrel = vc - vl;
  const possible = vrel > 1e-9;
  const tOv = possible ? REL / vrel : 0;
  const speedUp = tOv > 8 ? Math.ceil(tOv / 7) : 1;
  const preset = Object.keys(PRESETS).find((k) => PRESETS[k].vc === vc && PRESETS[k].vl === vl) ?? null;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(tOv, p.t + dt * speedUp);
      const done = t >= tOv - 1e-9;
      return { t, running: !done, done };
    });
  });

  const toggle = () => {
    if (!possible) return;
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);
  const pickFrame = (f) => {
    setFrame(f);
    setBlend(f === 'lorry' ? 1 : 0, 650);
  };
  const pick = (id) => {
    setVc(PRESETS[id].vc);
    setVl(PRESETS[id].vl);
    setSim(IDLE);
  };
  const change = (setter) => (n) => {
    setter(n);
    setSim(IDLE);
  };

  const t = sim.t;
  const D = (n) => trim(n, dec);
  const onLorry = frame === 'lorry';
  const frameName = L.frames[frame].name;
  const vCarF = onLorry ? vrel : vc;
  const vLorryF = onLorry ? 0 : vl;
  const s1 = vc * tOv;
  const s2 = vl * tOv;

  let key = 'idle';
  if (!possible) key = 'impossible';
  else if (sim.done) key = 'done';
  else if (t > 0) key = frame;
  const settled = useSettled(key, key === 'road' || key === 'lorry' ? 200 : 0);
  const ex = L.explain;
  const text = {
    idle: ex.idle,
    impossible: ex.impossible,
    road: ex.road(D(vc), D(vl)),
    lorry: ex.lorry(D(vrel), D(vl)),
    done: ex.done(D(tOv), D(REL), D(s1)),
  }[settled];
  const tone = { idle: '#22d3ee', impossible: '#f87171', road: '#f59e0b', lorry: '#818cf8', done: '#34d399' }[settled];

  /* x–t graph in the chosen frame: the car's front and the lorry's rear */
  const tEndG = possible ? tOv : 10;
  const carX = (tt) => -GAP + (onLorry ? vrel : vc) * tt;
  const lorryX = (tt) => (onLorry ? 0 : vl * tt);
  const lo = Math.min(-GAP, carX(tEndG), 0);
  const hi = Math.max(carX(tEndG), lorryX(tEndG), REL - GAP);
  const range = niceRange(lo, hi);
  const xMax = niceMax(tEndG);
  const series = [
    { id: 'lorry', label: L.graph.lorry, color: '#fbbf24', plan: [{ x: 0, y: 0 }, { x: tEndG, y: lorryX(tEndG) }], live: [{ x: 0, y: 0 }, { x: t, y: lorryX(t) }] },
    { id: 'car', label: L.graph.car, color: '#60a5fa', plan: [{ x: 0, y: -GAP }, { x: tEndG, y: carX(tEndG) }], live: [{ x: 0, y: -GAP }, { x: t, y: carX(t) }] },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.frameLabel}</GroupLabel>
          <Segmented
            label={L.frameLabel}
            className="grid-cols-2"
            size="lg"
            value={frame}
            onChange={pickFrame}
            accent={onLorry ? '#818cf8' : '#f59e0b'}
            options={[
              { value: 'road', label: L.frames.road.name, sub: L.frames.road.sub, icon: MapIcon },
              { value: 'lorry', label: L.frames.lorry.name, sub: L.frames.lorry.sub, icon: Truck },
            ]}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <OvertakeScene T={T} vc={vc} vl={vl} t={t} tOv={tOv} blend={blend} frame={frame} speedUp={speedUp} possible={possible} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.t} symbol="t" value={fmt(t, 1, dec)} unit={T.s} accent={PALETTE.time} textColor="#a5f3fc" sub={speedUp > 1 ? T.meet.chip(speedUp) : ' '}>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full bg-cyan-400" style={{ width: `${possible ? (t / tOv) * 100 : 0}%` }} />
          </div>
        </Readout>
        <Readout label={L.readouts.car} symbol="v" value={num(vCarF, 1, dec)} unit={T.ms} accent="#2563eb" textColor={PALETTE.dispText} sub={L.inFrame(frameName)} active />
        <Readout label={L.readouts.lorry} symbol="v" value={num(vLorryF, 1, dec)} unit={T.ms} accent="#d97706" textColor="#fcd34d" sub={L.inFrame(frameName)} />
        <Readout label={L.readouts.tOv} symbol="t" value={possible ? D(tOv) : '—'} unit={T.s} accent="#e2e8f0" sub={possible ? L.tOvSub(D(REL), D(vrel)) : ' '} active={sim.done} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <div>
            <p className="mb-1.5 text-sm text-gray-300">{L.presetsLabel}</p>
            <Segmented
              label={L.presetsLabel}
              className="grid-cols-2"
              value={preset}
              onChange={pick}
              options={Object.keys(PRESETS).map((id) => ({ value: id, label: L.presets[id].name, sub: L.presets[id].sub, icon: PRESETS[id].icon }))}
            />
          </div>
          <RangeField id="ov-vc" label={L.vCar} symbol={<Rich>v₁</Rich>} min={10} max={35} step={1} value={vc} onChange={change(setVc)} accent="#3b82f6" display={`${D(vc)} ${T.ms}`} hint={L.kmh(fmt(vc * 3.6, 0, dec))} />
          <RangeField id="ov-vl" label={L.vLorry} symbol={<Rich>v₂</Rich>} min={5} max={30} step={1} value={vl} onChange={change(setVl)} accent="#f59e0b" display={`${D(vl)} ${T.ms}`} hint={L.kmh(fmt(vl * 3.6, 0, dec))} />
          <FormulaTile
            tag={L.formula.tag}
            color="#93c5fd"
            general={L.formula.general}
            filled={L.formula.filled(D(vc), D(vl), D(vrel))}
            result={possible ? L.formula.time(D(REL), D(vrel), D(tOv)) : null}
            ok={sim.done}
          />
          {possible && <p className="text-sm leading-snug text-gray-300">{L.roadDist(D(s1), D(s2))}</p>}
          <p className="text-xs leading-snug text-gray-500">{L.lenNote(D(REL))}</p>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <XTGraph
            title={L.graph.title}
            series={series}
            xMax={xMax}
            yMin={range.yMin}
            yMax={range.yMax}
            t={t}
            xLabel={L.graph.t}
            yLabel={onLorry ? L.axisXp : L.graph.x}
            note={L.graph.note}
            decimal={dec}
            xDigits={tickDigits(xMax)}
            yDigits={tickDigits(range.step, 1)}
            height={240}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

function OvertakeScene({ T, vc, vl, t, tOv, blend, frame, speedUp, possible }) {
  const L = T.overtake;
  const dec = T.decimal;
  const vrel = vc - vl;
  const xl = vl * t; // lorry rear, road frame
  const xc = -GAP + vc * t; // car front, road frame
  const p = xc - xl;
  const lane = laneOf(p);
  const onLorry = frame === 'lorry';
  const marks = [];
  if (possible) {
    for (let n = 0; n <= Math.floor(t + 1e-9); n += 1) {
      const pn = -GAP + vrel * n;
      marks.push({ n, world: -GAP + vc * n, rel: pn, lane: laneOf(pn) });
    }
  }
  return (
    <LabScene
      legend={[
        { color: '#2563eb', label: L.legend.car, kind: 'box' },
        { color: '#d97706', label: L.legend.lorry, kind: 'box' },
        { color: PALETTE.vel, label: L.legend.v, kind: 'arrow' },
        { color: '#2563eb', label: L.legend.marks, kind: 'ring' },
      ]}
      chips={
        <>
          <Chip icon={onLorry ? Truck : MapIcon} color={onLorry ? '#4f46e5' : '#b45309'}>
            {L.chip(L.frames[frame].name)}
          </Chip>
          <Chip icon={Timer}>
            {speedUp > 1 ? `${T.meet.chip(speedUp)} · ` : ''}t = {fmt(t, 1, dec)} {T.s}
          </Chip>
        </>
      }
      height={(W, narrow) => (narrow ? 250 : 270)}
      ariaLabel={L.sceneLabel(L.frames[frame].name, fmt(t, 1, dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 11 : 12;
        const D = (n) => trim(n, dec);
        const laneH = narrow ? 36 : 44;
        const roadTop = narrow ? 92 : 104;
        const roadBot = roadTop + 2 * laneH;
        const yOwn = roadTop + laneH * 1.5;
        const yOpp = roadTop + laneH * 0.5;
        const rulerY = H - 30;
        // camera: fixed on the road, or riding with the lorry
        const a0 = -GAP - CAR - 6;
        const b0 = Math.max(-GAP + vc * tOv, LORRY + vl * tOv) + 8;
        const a = a0 + (xl - 27 - a0) * blend;
        const b = b0 + (xl + LORRY + 30 - b0) * blend;
        const view = lineView(a, b, W, narrow ? 10 : 16, narrow ? 10 : 16);
        const k = view.k;
        const lorryPx = Math.max(LORRY * k, 40);
        const lorryW = Math.max(Math.min(2.5 * k, laneH - 10), 16);
        const carPx = Math.max(CAR * k, 11);
        const carW = Math.max(Math.min(1.8 * k, laneH - 16), 8);
        const box = { w: W, h: H };
        const vk = Math.min(narrow ? 3 : 5, (W * 0.18) / Math.max(vc, 1));
        // road markings attached to the ground
        const dashStep = niceStep(k, 26);
        const dashes = [];
        for (let x = Math.floor(view.wx(0) / dashStep) * dashStep; x <= view.wx(W); x += dashStep) dashes.push(x);
        const postStep = niceStep(k, 70);
        const posts = [];
        for (let x = Math.floor(view.wx(0) / postStep) * postStep; x <= view.wx(W) + postStep; x += postStep) posts.push(x);
        // the chosen frame's axis
        const axisView = onLorry ? { k, sx: (c) => view.sx(c + xl), wx: (px) => view.wx(px) - xl } : view;
        const step = rulerStep(view, narrow ? 46 : 64);
        const markX = (m) => view.sx(m.world + (xl + m.rel - m.world) * blend);
        const carCx = view.sx(xc) - carPx / 2;
        const carCy = yOwn + (yOpp - yOwn) * lane;
        const lorryCx = view.sx(xl) + lorryPx / 2;
        const vCar = onLorry ? vrel : vc;
        const vLorry = onLorry ? 0 : vl;
        const carTag = L.vTag(D(vCar));
        const lorryTag = L.vTag(D(vLorry));
        const carTip = view.sx(xc) + 4 + vCar * vk;
        const lorryTip = view.sx(xl) + lorryPx + 4 + vLorry * vk;
        return (
          <>
            <rect width={W} height={H} fill="#fbfcfe" />
            {/* verges with posts every few metres (they belong to the road) */}
            <rect x={0} y={roadTop - 16} width={W} height={16} fill="#dcfce7" />
            <rect x={0} y={roadBot} width={W} height={16} fill="#dcfce7" />
            {posts.map((x) => (
              <g key={`p${x}`}>
                <rect x={view.sx(x) - 2} y={roadTop - 12} width={4} height={8} rx={1} fill="#94a3b8" />
                <rect x={view.sx(x) - 2} y={roadBot + 4} width={4} height={8} rx={1} fill="#94a3b8" />
              </g>
            ))}
            <rect x={0} y={roadTop} width={W} height={roadBot - roadTop} fill="#64748b" />
            <line x1={0} x2={W} y1={roadTop + 2} y2={roadTop + 2} stroke="#f8fafc" strokeWidth={2} />
            <line x1={0} x2={W} y1={roadBot - 2} y2={roadBot - 2} stroke="#f8fafc" strokeWidth={2} />
            {dashes.map((x) => (
              <rect key={`d${x}`} x={view.sx(x)} y={roadTop + laneH - 1.5} width={Math.max(4, dashStep * k * 0.5)} height={3} fill="#f8fafc" />
            ))}
            {/* car positions every second, in the chosen frame */}
            {marks.map((m) => (
              <circle key={m.n} cx={markX(m) - carPx / 2} cy={yOwn + (yOpp - yOwn) * m.lane} r={narrow ? 3 : 3.8} fill="#fff" stroke="#2563eb" strokeWidth={2} />
            ))}
            {/* vehicles */}
            <TopLorry x={lorryCx} y={yOwn} len={lorryPx} wid={lorryW} color="#d97706" />
            <TopCar x={carCx} y={carCy} len={carPx} wid={carW} color="#2563eb" />
            {/* velocities in the chosen frame */}
            {vCar > 0.05 && <Arrow x1={view.sx(xc) + 4} y1={carCy} x2={carTip} y2={carCy} color={PALETTE.vel} width={3} head={10} />}
            {vLorry > 0.05 && <Arrow x1={view.sx(xl) + lorryPx + 4} y1={yOwn} x2={lorryTip} y2={yOwn} color={PALETTE.vel} width={3} head={10} />}
            <Pill x={carCx} y={carCy - carW / 2 - 11} text={carTag} bg="#2563eb" size={fs - 1} box={box} />
            <Pill x={lorryCx} y={yOwn + lorryW / 2 + 11} text={lorryTag} bg="#d97706" size={fs - 1} box={box} />
            {onLorry && vl > 0.05 && (
              <g>
                <Arrow x1={W * 0.7} y1={roadTop - 8} x2={W * 0.7 - vl * vk} y2={roadTop - 8} color="#475569" width={2.5} head={9} />
                <Pill x={W * 0.7 + textWidth(L.roadTag(D(-vl)), fs - 1, 600) / 2 + 10} y={roadTop - 8} text={L.roadTag(D(-vl))} bg="#fff" color="#475569" border="#cbd5e1" size={fs - 1} box={box} />
              </g>
            )}
            <rect x={0} y={rulerY - 4} width={W} height={H - rulerY + 4} fill="#f8fafc" />
            <Ruler view={axisView} W={W} y={rulerY} step={step} unit={onLorry ? L.axisXp : L.axisX} decimal={dec} fs={fs - 1} color={onLorry ? '#4f46e5' : '#92400e'} />
          </>
        );
      }}
    </LabScene>
  );
}
