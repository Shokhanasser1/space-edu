import { useState } from 'react';
import { CircleCheck, CircleStop, Hourglass, Lightbulb } from 'lucide-react';

import { Explain, Pill, Readout, Segmented, fmt, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE, TimeGraph } from '../kit/scene';
import { BusStopSign, Chip, GroupLabel, LabScene, PlayControls, SideBus, SideRoad, Speedometer, StrobeMarks, TrafficLight, lineView, num, rulerStep } from './Acceleration.parts';

/**
 * Instantaneous vs average speed: a city bus drives from stop A to stop B
 * (432 m) — speeds up at 1.5 m/s² to 12 m/s (43.2 km/h), cruises, brakes at
 * 2 m/s² for a red light (or passes a green one), waits, and goes on. The
 * speedometer shows the instantaneous speed; the running average s/t is
 * shown next to it and on the v–t graph. Strings come from T.city.
 */

const SPEED = 12; // m/s, cruising
const ACC = 1.5; // m/s², pulling away
const DEC = 2; // m/s², braking
const LIGHT_X = 228; // m, stop line at the traffic light
const STOP_B = 432; // m
const SPEED_UP = 3;
const T_AXIS = 80; // s, the same time axis for all scenarios

const SCENARIOS = {
  green: { wait: null, icon: CircleCheck },
  red10: { wait: 10, icon: CircleStop },
  red25: { wait: 25, icon: Hourglass },
};

function buildProfile(wait) {
  const segs = [];
  const add = (dur, v0, a, kind) => {
    const prev = segs[segs.length - 1];
    const t0 = prev ? prev.t1 : 0;
    const x0 = prev ? prev.x1 : 0;
    segs.push({ t0, t1: t0 + dur, x0, x1: x0 + v0 * dur + 0.5 * a * dur * dur, v0, a, kind });
  };
  const tAcc = SPEED / ACC; // 8 s, 48 m
  const tDec = SPEED / DEC; // 6 s, 36 m
  const sAcc = (SPEED * tAcc) / 2;
  const sDec = (SPEED * tDec) / 2;
  add(tAcc, 0, ACC, 'acc');
  if (wait === null) {
    add((STOP_B - sAcc - sDec) / SPEED, SPEED, 0, 'cruise');
    add(tDec, SPEED, -DEC, 'brakeStop');
  } else {
    add((LIGHT_X - sAcc - sDec) / SPEED, SPEED, 0, 'cruise');
    add(tDec, SPEED, -DEC, 'brakeLight');
    add(wait, 0, 0, 'wait');
    add(tAcc, 0, ACC, 'acc');
    add((STOP_B - LIGHT_X - sAcc - sDec) / SPEED, SPEED, 0, 'cruise');
    add(tDec, SPEED, -DEC, 'brakeStop');
  }
  return segs;
}

function stateAt(segs, t) {
  const seg = segs.find((s) => t <= s.t1 + 1e-9) ?? segs[segs.length - 1];
  const tau = Math.min(Math.max(t - seg.t0, 0), seg.t1 - seg.t0);
  return { seg, v: seg.v0 + seg.a * tau, x: seg.x0 + seg.v0 * tau + 0.5 * seg.a * tau * tau };
}

const IDLE = { t: 0, running: false, done: false, scrub: false };

export default function CitySim({ T }) {
  const L = T.city;
  const dec = T.decimal;
  const [sc, setSc] = useState('red10');
  const [sim, setSim] = useState(IDLE);
  const segs = buildProfile(SCENARIOS[sc].wait);
  const tEnd = segs[segs.length - 1].t1;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(tEnd, p.t + dt * SPEED_UP);
      const done = t >= tEnd - 1e-9;
      return { t, running: !done, done, scrub: false };
    });
  });

  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running, scrub: false }));
  };
  const reset = () => setSim(IDLE);
  const pick = (id) => {
    setSc(id);
    setSim(IDLE);
  };
  const scrub = (x) => {
    const t = Math.min(x, tEnd);
    setSim({ t, running: false, done: t >= tEnd - 1e-9, scrub: true });
  };

  const t = sim.t;
  const { seg, v, x } = stateAt(segs, t);
  const kmh = v * 3.6;
  const avg = t > 0 ? x / t : 0;
  const F = (n, k = 1) => num(n, k, dec);
  const waitSeg = segs.find((s) => s.kind === 'wait');
  const light = waitSeg ? (t < waitSeg.t1 - 0.6 ? 'red' : t < waitSeg.t1 ? 'yellow' : 'green') : 'green';

  let key = 'idle';
  if (sim.scrub && !sim.done) key = 'scrub';
  else if (sim.done) key = 'done';
  else if (t > 0) {
    key = seg.kind;
    if (key === 'cruise' && !waitSeg && x > LIGHT_X - 60 && x < LIGHT_X + 40) key = 'greenPass';
  }
  const settled = useSettled(key, key === 'scrub' ? 0 : 150);
  const ex = L.explain;
  const text = {
    idle: ex.idle,
    acc: ex.acc,
    cruise: ex.cruise,
    greenPass: ex.greenPass,
    brakeLight: ex.brakeLight,
    wait: ex.wait,
    brakeStop: ex.brakeStop,
    scrub: ex.scrub(fmt(t, 1, dec), fmt(kmh, 1, dec)),
    done: ex.done(fmt(STOP_B, 0, dec), fmt(tEnd, 0, dec), F(STOP_B / tEnd), F((STOP_B / tEnd) * 3.6), F(SPEED * 3.6)),
  }[settled];
  const tone = { idle: '#22d3ee', acc: '#fb923c', cruise: '#34d399', greenPass: '#34d399', brakeLight: '#f87171', wait: '#f87171', brakeStop: '#fb923c', scrub: '#a78bfa', done: '#34d399' }[settled];

  /* graph */
  const plan = [];
  segs.forEach((s) => {
    const n = s.a === 0 ? 1 : 8;
    for (let i = 0; i <= n; i += 1) {
      const tt = s.t0 + ((s.t1 - s.t0) * i) / n;
      plan.push({ x: tt, y: (s.v0 + s.a * (tt - s.t0)) * 3.6 });
    }
  });
  const live = plan.filter((p) => p.x <= t + 1e-9);
  if (t > 0) live.push({ x: t, y: kmh });

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.scenariosLabel}</GroupLabel>
          <Segmented
            label={L.scenariosLabel}
            className="grid-cols-1 sm:grid-cols-3"
            size="lg"
            value={sc}
            onChange={pick}
            accent={sc === 'green' ? '#22c55e' : '#f87171'}
            options={Object.keys(SCENARIOS).map((id) => ({ value: id, label: L.scenarios[id].name, sub: L.scenarios[id].sub, icon: SCENARIOS[id].icon }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <CityScene T={T} segs={segs} t={t} x={x} v={v} light={light} hasLight={Boolean(waitSeg)} running={sim.running} done={sim.done} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        <Readout label={L.readouts.speedo} accent={PALETTE.vel} className="col-span-2 lg:col-span-1 lg:row-span-2" sub={L.speedoSub}>
          <Speedometer value={kmh} max={60} minor={5} major={10} unit={T.kmh} mark={t > 0 ? avg * 3.6 : undefined} size={190} decimal={dec} ariaLabel={L.speedoLabel(fmt(kmh, 0, dec))} />
        </Readout>
        <Readout label={L.readouts.s} symbol="s" value={F(x)} unit={T.m} accent={PALETTE.path} textColor={PALETTE.pathText} sub={L.sSub} />
        <Readout label={L.readouts.t} symbol="t" value={fmt(t, 1, dec)} unit={T.s} accent={PALETTE.time} textColor="#a5f3fc" sub={L.tSub}>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full bg-cyan-400" style={{ width: `${(t / tEnd) * 100}%` }} />
          </div>
        </Readout>
        <Readout
          label={L.readouts.avg}
          symbol="s/t"
          value={t > 0 ? F(avg * 3.6) : '—'}
          unit={T.kmh}
          accent="#a78bfa"
          textColor="#c4b5fd"
          sub={t > 0 ? `${L.avgSub(F(x), fmt(t, 1, dec))} = ${F(avg)} ${T.ms}` : ' '}
          active={sim.done}
          className="col-span-2"
        />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
        <TimeGraph
          title={L.graph.title}
          series={[
            { id: 'plan', label: L.graph.plan, color: '#475569', points: plan, dash: '3 5', dot: false },
            { id: 'avg', label: L.graph.avg, color: '#a78bfa', points: t > 0 ? [{ x: 0, y: avg * 3.6 }, { x: t, y: avg * 3.6 }] : [], dash: '6 4' },
            { id: 'live', label: L.graph.live, color: '#34d399', points: live },
          ]}
          fill={{ id: 'live', color: '#34d399', opacity: 0.1 }}
          xMax={T_AXIS}
          yMax={60}
          xLabel={L.graph.t}
          yLabel={L.graph.v}
          marker={t}
          note={L.graph.note}
          decimal={dec}
          height={230}
          onScrub={scrub}
        />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

function CityScene({ T, segs, t, x, v, light, hasLight, running, done }) {
  const L = T.city;
  const dec = T.decimal;
  const marks = [];
  for (let i = 0; i * 4 <= t + 1e-9; i += 1) {
    const st = stateAt(segs, i * 4);
    marks.push({ n: i, x: st.x });
  }
  const atStop = t === 0 || done;

  return (
    <LabScene
      legend={[
        { color: PALETTE.vel, label: L.legend.v, kind: 'box' },
        { color: PALETTE.path, label: L.legend.marks, kind: 'ring' },
      ]}
      chips={
        <Chip>
          {L.chip} · t = {fmt(t, 1, dec)} {T.s}
        </Chip>
      }
      height={(W, narrow) => (narrow ? 250 : 286)}
      ariaLabel={L.sceneLabel(fmt(t, 1, dec), fmt(v * 3.6, 0, dec), fmt(x, 0, dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 11 : 12;
        const busLen = narrow ? 64 : 100;
        const padL = busLen + (narrow ? 10 : 18);
        const padR = narrow ? 20 : 34;
        const view = lineView(0, STOP_B, W, padL, padR);
        const step = rulerStep(view, narrow ? 46 : 64);
        const roadY = H - (narrow ? 62 : 68);
        const busY = roadY + 4;
        const front = view.sx(x);
        const box = { w: W, h: H };
        const lightX = view.sx(LIGHT_X) + 10;
        return (
          <>
            <SideRoad view={view} W={W} H={H} roadY={roadY} step={step} unit={L.axisX} decimal={dec} fs={fs - 1} />
            <BusStopSign x={view.sx(0) + 6} y={roadY - 10} h={narrow ? 40 : 54} label={L.stopA} />
            <BusStopSign x={view.sx(STOP_B) + 6} y={roadY - 10} h={narrow ? 40 : 54} label={L.stopB} />
            {hasLight && <line x1={view.sx(LIGHT_X)} x2={view.sx(LIGHT_X)} y1={roadY - 9} y2={roadY + 9} stroke="#fff" strokeWidth={4} />}
            <TrafficLight x={lightX} y={roadY - 10} h={narrow ? 56 : 76} state={light} />
            <StrobeMarks marks={marks.map((m) => ({ n: m.n, px: view.sx(m.x), v: 0 }))} roadY={roadY} rowY={roadY - 20} vk={0} label={(n) => L.secTag(n * 4)} fs={fs - 2} color={PALETTE.path} labelColor="#6d28d9" arrows={false} />
            <SideBus front={front} y={busY} len={busLen} dist={x} braking={running && v > 0.05 && segs.some((s) => s.a < 0 && t > s.t0 && t < s.t1)} doorsOpen={atStop} />
            <Pill x={front - busLen / 2} y={busY - busLen * 0.3 - 18} text={L.speedTag(fmt(v * 3.6, 0, dec))} bg={PALETTE.vel} size={fs} box={box} />
          </>
        );
      }}
    </LabScene>
  );
}
