import { useState } from 'react';
import { Lightbulb, MoveLeft, MoveRight, OctagonMinus, OctagonAlert } from 'lucide-react';

import { Arrow, Explain, Pill, RangeField, Readout, Segmented, fmt, textWidth, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE, TimeGraph } from '../kit/scene';
import { Chip, FormulaTile, GroupLabel, LabScene, PlayControls, Rich, SideCar, SideRoad, StrobeMarks, lineView, niceMax, num, rulerStep, signed, tickDigits } from './Acceleration.parts';

/**
 * Braking: the acceleration points against the velocity, the speed falls by
 * |a| every second and the car stops at t = v₀/|a| (from v = v₀ + a·t = 0).
 * The x axis can point along or against the motion: the signs of v and a
 * swap, the motion does not. Strings come from T.brake (Acceleration.jsx).
 */

const PRESETS = {
  soft: { v0: 20, d: 2.5, icon: OctagonMinus },
  hard: { v0: 20, d: 5, icon: OctagonAlert },
};
const IDLE = { t: 0, running: false, done: false };

export default function BrakeSim({ T }) {
  const L = T.brake;
  const dec = T.decimal;
  const [v0, setV0] = useState(20);
  const [d, setD] = useState(2.5);
  const [axis, setAxis] = useState('right');
  const [sim, setSim] = useState(IDLE);
  const tStop = v0 / d;
  const speedUp = tStop > 10 ? Math.ceil(tStop / 8) : 1;
  const preset = Object.keys(PRESETS).find((k) => PRESETS[k].v0 === v0 && PRESETS[k].d === d) ?? null;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(tStop, p.t + dt * speedUp);
      const done = t >= tStop - 1e-9;
      return { t, running: !done, done };
    });
  });

  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);
  const pick = (id) => {
    setV0(PRESETS[id].v0);
    setD(PRESETS[id].d);
    setSim(IDLE);
  };

  const sgn = axis === 'right' ? 1 : -1;
  const t = sim.t;
  const speed = Math.max(0, v0 - d * t);
  const vAx = sgn * speed;
  const aAx = -sgn * d;
  const F = (n, k = 1) => num(n, k, dec);

  let key = 'idle';
  if (sim.done) key = 'stopped';
  else if (t > 0) key = axis;
  const settled = useSettled(key, key === 'stopped' || key === 'idle' ? 0 : 250);
  const ex = L.explain;
  const text = {
    idle: ex.idle,
    right: ex.right(F(d)),
    left: ex.left(F(d)),
    stopped: ex.stopped(F(tStop), F(v0), F(d)),
  }[settled];
  const tone = { idle: '#22d3ee', right: '#fb923c', left: '#60a5fa', stopped: '#34d399' }[settled];

  /* graph */
  const xMax = niceMax(tStop);
  const vTop = niceMax(v0);
  const planPts = [
    { x: 0, y: sgn * v0 },
    { x: tStop, y: 0 },
  ];
  const livePts = t > 0 ? [{ x: 0, y: sgn * v0 }, { x: t, y: vAx }] : [{ x: 0, y: sgn * v0 }];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.presetsLabel}</GroupLabel>
          <Segmented
            label={L.presetsLabel}
            className="grid-cols-1 sm:grid-cols-2"
            size="lg"
            value={preset}
            onChange={pick}
            accent="#fb923c"
            options={Object.keys(PRESETS).map((id) => ({ value: id, label: L.presets[id].name, sub: L.presets[id].sub, icon: PRESETS[id].icon }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <BrakeScene T={T} v0={v0} d={d} t={t} tStop={tStop} sgn={sgn} speedUp={speedUp} done={sim.done} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.t} symbol="t" value={fmt(t, 1, dec)} unit={T.s} accent={PALETTE.time} textColor="#a5f3fc" sub={speedUp > 1 ? L.chipFast(speedUp) : L.chipReal}>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full bg-cyan-400" style={{ width: `${(t / tStop) * 100}%` }} />
          </div>
        </Readout>
        <Readout label={L.readouts.v} symbol="v" value={F(vAx)} unit={T.ms} accent={PALETTE.vel} textColor={PALETTE.velText} sub={L.vSub(fmt(speed * 3.6, 0, dec))} />
        <Readout label={L.readouts.a} symbol="a" value={sim.done ? num(0, 1, dec) : signed(aAx, 1, dec)} unit={T.ms2} accent={PALETTE.acc} textColor={PALETTE.accText} sub={sim.done ? L.aStopped : L.aSub} />
        <Readout label={L.readouts.stop} symbol={<Rich>t₀</Rich>} value={F(tStop)} unit={T.s} accent="#e2e8f0" sub={L.stopSub(F(v0), F(d))} active={sim.done} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="brk-v0"
            label={L.v0}
            symbol={<Rich>v₀</Rich>}
            min={5}
            max={30}
            step={1}
            value={v0}
            onChange={(n) => {
              setV0(n);
              setSim(IDLE);
            }}
            accent={PALETTE.vel}
            display={`${F(v0, 0)} ${T.ms}`}
            hint={L.kmh(fmt(v0 * 3.6, 0, dec))}
          />
          <RangeField
            id="brk-a"
            label={L.dec}
            min={1}
            max={8}
            step={0.5}
            value={d}
            onChange={(n) => {
              setD(n);
              setSim(IDLE);
            }}
            accent={PALETTE.acc}
            display={`${F(d)} ${T.ms2}`}
            hint={L.decHint}
          />
          <div>
            <p className="mb-1.5 text-sm text-gray-300">{L.axisLabel}</p>
            <Segmented
              label={L.axisLabel}
              className="grid-cols-1 sm:grid-cols-2"
              value={axis}
              onChange={setAxis}
              accent="#60a5fa"
              options={[
                { value: 'right', label: L.axes.right.name, sub: L.axes.right.sub, icon: MoveRight },
                { value: 'left', label: L.axes.left.name, sub: L.axes.left.sub, icon: MoveLeft },
              ]}
            />
          </div>
          <FormulaTile
            tag={L.formula.tag}
            color="#fdba74"
            general={L.formula.general}
            filled={L.formula.filled(F(sgn * v0), signed(aAx, 1, dec), F(tStop))}
            ok={sim.done}
          />
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <TimeGraph
            title={L.graph.title}
            series={[
              { id: 'plan', label: L.graph.plan, color: '#6ee7b7', points: planPts, dash: '4 5', dot: false },
              { id: 'live', label: L.graph.live, color: '#34d399', points: livePts },
              { id: 'stop', label: L.graph.stop, color: '#fb923c', points: [{ x: tStop, y: 0 }] },
            ]}
            xMax={xMax}
            yMax={sgn > 0 ? vTop : 0}
            yMin={sgn > 0 ? 0 : -vTop}
            xLabel={L.graph.t}
            yLabel={L.graph.v}
            marker={t}
            note={L.graph.note}
            decimal={dec}
            xDigits={tickDigits(xMax)}
            yDigits={tickDigits(vTop)}
            height={224}
          />
        </div>
      </div>
    </div>
  );
}

function BrakeScene({ T, v0, d, t, tStop, sgn, speedUp, done }) {
  const L = T.brake;
  const dec = T.decimal;
  const xStop = (v0 * v0) / (2 * d);
  const x = v0 * t - 0.5 * d * t * t;
  const speed = Math.max(0, v0 - d * t);
  const marks = [];
  for (let n = 0; n <= Math.floor(t + 1e-9); n += 1) marks.push({ n, x: v0 * n - 0.5 * d * n * n, v: Math.max(0, v0 - d * n) });

  return (
    <LabScene
      legend={[
        { color: PALETTE.vel, label: L.legend.v, kind: 'arrow' },
        { color: PALETTE.acc, label: L.legend.a, kind: 'arrow' },
        { color: PALETTE.disp, label: L.legend.axis, kind: 'arrow' },
        { color: PALETTE.vel, label: L.legend.marks, kind: 'ring' },
      ]}
      chips={
        <Chip>
          {speedUp > 1 ? L.chipFast(speedUp) : L.chipReal} · t = {fmt(t, 1, dec)} {T.s}
        </Chip>
      }
      height={(W, narrow) => (narrow ? 240 : 268)}
      ariaLabel={L.sceneLabel(fmt(t, 1, dec), num(sgn * speed, 1, dec), signed(-sgn * d, 1, dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 11 : 12;
        const carLen = narrow ? 58 : 88;
        const vMaxPx = narrow ? 66 : 130;
        const padL = carLen + (narrow ? 34 : 50);
        const padR = Math.max(vMaxPx - carLen / 2 + (narrow ? 14 : 30), 40);
        const view = lineView(0, Math.max(xStop, 5), W, padL, padR);
        const step = rulerStep(view, narrow ? 44 : 62);
        const roadY = H - (narrow ? 64 : 70);
        const carY = roadY + 4;
        const vk = vMaxPx / v0;
        const ak = narrow ? 11 : 17;
        const front = view.sx(x);
        const cx = front - carLen / 2;
        const carTop = carY - carLen * 0.48;
        const yv = carTop - 16;
        const ya = yv - 27;
        const box = { w: W, h: H };
        const vText = L.vTag(num(sgn * speed, 1, dec));
        const aText = L.aTag(signed(-sgn * d, 1, dec));
        const vW = textWidth(vText, fs, 600) + 16;
        const aW = textWidth(aText, fs, 600) + 16;
        const rulerY = roadY + 16;
        const ox = view.sx(0);
        const stopX = view.sx(xStop);
        return (
          <>
            <SideRoad view={view} W={W} H={H} roadY={roadY} step={step} decimal={dec} fs={fs - 1} scale={sgn} reserveL={sgn < 0 ? 56 : 0} reserveR={sgn > 0 ? 56 : 0} />
            {/* chosen axis */}
            {sgn > 0 ? (
              <Arrow x1={W - 52} y1={rulerY} x2={W - 6} y2={rulerY} color={PALETTE.disp} width={3} head={11} />
            ) : (
              <Arrow x1={52} y1={rulerY} x2={6} y2={rulerY} color={PALETTE.disp} width={3} head={11} />
            )}
            <text x={sgn > 0 ? W - 10 : 10} y={rulerY + 22} textAnchor={sgn > 0 ? 'end' : 'start'} fontSize={fs} fontWeight="800" fill={PALETTE.disp}>
              {L.axisX}
            </text>
            <line x1={ox} x2={ox} y1={roadY - 10} y2={roadY + 10} stroke={PALETTE.ink} strokeWidth={2} strokeDasharray="3 3" />
            <line x1={stopX} x2={stopX} y1={roadY - 38} y2={roadY + 10} stroke="#dc2626" strokeWidth={1.5} strokeDasharray="4 4" opacity={done ? 0.9 : 0.35} />
            <StrobeMarks marks={marks.map((m) => ({ n: m.n, px: view.sx(m.x), v: m.v }))} roadY={roadY} rowY={roadY - 24} vk={vk} label={L.secTag} fs={fs - 2} />
            <SideCar front={front} y={carY} len={carLen} color="#2563eb" dist={x} braking={t > 0 && !done} />
            {speed > 0.05 && <Arrow x1={cx} y1={yv} x2={cx + speed * vk} y2={yv} color={PALETTE.vel} width={narrow ? 3 : 3.5} head={narrow ? 10 : 12} />}
            {!done && <Arrow x1={cx} y1={ya} x2={cx - d * ak} y2={ya} color={PALETTE.acc} width={narrow ? 3 : 3.5} head={narrow ? 10 : 12} />}
            <circle cx={cx} cy={yv} r={3} fill={PALETTE.vel} />
            {!done && <circle cx={cx} cy={ya} r={3} fill={PALETTE.acc} />}
            <Pill x={cx - vW / 2 - 8} y={yv} text={vText} bg={PALETTE.vel} size={fs} box={box} />
            {!done && <Pill x={cx + aW / 2 + 8} y={ya} text={aText} bg={PALETTE.acc} size={fs} box={box} />}
            {done && <Pill x={stopX} y={roadY - 50 - carLen * 0.3} text={L.stopTag(num(tStop, 1, dec))} bg="#dc2626" size={fs} box={box} />}
          </>
        );
      }}
    </LabScene>
  );
}
