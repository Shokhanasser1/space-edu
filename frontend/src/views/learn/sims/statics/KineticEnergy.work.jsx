import { useState } from 'react';
import { ChevronsRight, OctagonMinus, Lightbulb } from 'lucide-react';

import { Explain, RangeField, Readout, Segmented, textWidth, useRafLoop, useSettled } from '../kit/ui';
import { TimeGraph } from '../kit/scene';
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
  ScaleChip,
  SvgSym,
  VecArrow,
  cartGeom,
  lineView,
  niceMax,
  num,
  round,
  rulerStep,
  tickDigits,
  trim,
} from './KineticEnergy.parts';

/**
 * Tab 2 — the work–energy theorem A = E_k2 − E_k1. A constant force F acts on
 * a cart on a smooth track along the shaded stretch s, then stops acting.
 *  - Speeding up (F along the motion, A = F·s > 0), preset m = 2 kg,
 *    F = 10 N, s = 5 m from rest: A = 50 J = E_k2, v = √(2·50/2) = 7.07 m/s.
 *  - Braking (F against the motion, A = −F·s < 0), preset m = 2 kg,
 *    v₀ = 6 m/s (E_k1 = 36 J), F = 4 N, s = 5 m: A = −20 J, E_k2 = 16 J,
 *    v = 4 m/s. If F·s ≥ E_k1 the cart stops after E_k1/F metres and the
 *    brake does no more work (A = −E_k1).
 * Energy bars E_k1 + A = E_k2 fill live; the graph shows E_k(x) with slope F.
 * Strings come from T.work.
 */

const PRESETS = {
  push: { m: 2, F: 10, s: 5, v0: 0, sign: 1 },
  brake: { m: 2, F: 4, s: 5, v0: 6, sign: -1 },
};
const TRACK = 12; // metres of rail
const X_END = TRACK - 0.75; // where the run ends (cart at the end stop)
const COAST_MAX = 2; // seconds of coasting shown after the force stops
const IDLE = { t: 0, running: false, done: false, samples: [] };

/** The whole run worked out in advance (constant force → closed-form motion). */
function makePlan(m, F, s, v0, sign) {
  const a = (sign * F) / m;
  const e1 = (m * v0 * v0) / 2;
  if (sign > 0) {
    const v1 = Math.sqrt(v0 * v0 + 2 * a * s);
    const t1 = (v1 - v0) / a;
    return { a, v0, e1, v1, t1, sF: s, A: F * s, e2: e1 + F * s, stop: false, tEnd: t1 + Math.min((X_END - s) / v1, COAST_MAX) };
  }
  const disc = v0 * v0 + 2 * a * s;
  if (disc <= 1e-9) {
    const t1 = v0 / -a;
    return { a, v0, e1, v1: 0, t1, sF: (v0 * v0) / (2 * -a), A: -e1, e2: 0, stop: true, tEnd: t1 };
  }
  const v1 = Math.sqrt(disc);
  const t1 = (v0 - v1) / -a;
  return { a, v0, e1, v1, t1, sF: s, A: -F * s, e2: e1 - F * s, stop: false, tEnd: t1 + Math.min((X_END - s) / v1, COAST_MAX) };
}

function stateAt(p, t) {
  if (t <= p.t1) return { x: p.v0 * t + 0.5 * p.a * t * t, v: Math.max(0, p.v0 + p.a * t), inZone: true };
  return { x: p.sF + p.v1 * (t - p.t1), v: p.v1, inZone: false };
}

export default function WorkSim({ T }) {
  const L = T.work;
  const dec = T.decimal;
  const [mode, setMode] = useState('push');
  const [m, setM] = useState(PRESETS.push.m);
  const [F, setF] = useState(PRESETS.push.F);
  const [s, setS] = useState(PRESETS.push.s);
  const [v0, setV0] = useState(PRESETS.push.v0);
  const [sim, setSim] = useState(IDLE);
  const sign = PRESETS[mode].sign;
  const p = makePlan(m, F, s, v0, sign);

  // the run should last about 4 s on screen: slow motion for quick runs, fast-forward for long ones
  const slow = p.tEnd < 3 ? Math.ceil(4 / Math.max(p.tEnd, 0.05)) : 1;
  const fast = p.tEnd > 8 ? Math.ceil(p.tEnd / 6) : 1;
  const rate = fast / slow;

  useRafLoop(sim.running, (dt) => {
    setSim((q) => {
      if (!q.running) return q;
      const t = Math.min(p.tEnd, q.t + dt * rate);
      const done = t >= p.tEnd - 1e-9;
      const st = stateAt(p, t);
      const e = (m * st.v * st.v) / 2;
      const last = q.samples[q.samples.length - 1];
      const samples = !last || done || st.x - last.x > TRACK / 300 ? [...q.samples, { x: st.x, y: e }] : q.samples;
      return { t, running: !done, done, samples };
    });
  });

  const resetSim = () => setSim(IDLE);
  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true, samples: [{ x: 0, y: p.e1 }] });
    else setSim((q) => ({ ...q, running: !q.running, samples: q.samples.length ? q.samples : [{ x: 0, y: p.e1 }] }));
  };
  const pickMode = (id) => {
    const pr = PRESETS[id];
    setMode(id);
    setM(pr.m);
    setF(pr.F);
    setS(pr.s);
    setV0(pr.v0);
    resetSim();
  };
  const change = (setter) => (val) => {
    setter(val);
    resetSim();
  };

  const st = stateAt(p, sim.t);
  const xz = Math.min(st.x, p.sF); // distance covered under the force so far
  const A = sign * F * xz;
  const e = Math.max(0, p.e1 + A);
  const v = st.v;
  const started = sim.t > 0;

  const J = (n) => trim(n, dec, 1);
  const D = (n) => trim(n, dec);
  const V = (n) => round(n, 2, dec);
  const Vt = (n) => trim(n, dec, 2);
  const paren = (n) => (n < 0 ? `(${J(n)})` : J(n));

  let key = 'idle';
  if (sim.done) key = p.stop ? 'stopped' : 'done';
  else if (started && st.inZone) key = sign > 0 ? 'push' : 'brake';
  else if (started) key = 'coast';
  const settled = useSettled(key, key === 'push' || key === 'brake' ? 250 : 0);
  const ex = L.explain;
  const text = {
    idle: sign > 0 ? ex.idlePush(D(m), D(F), D(s), D(v0)) : ex.idleBrake(D(m), D(F), D(s), D(v0)),
    push: ex.push(J(A), J(e)),
    brake: ex.brake(J(A), J(e)),
    coast: ex.coast(Vt(v), J(e)),
    done: (sign > 0 ? ex.donePush : ex.doneBrake)(J(p.A), J(p.e2), J(p.e1), Vt(p.v1)),
    stopped: ex.stopped(Vt(p.sF), J(p.e1)),
  }[settled];
  const tone = { idle: '#22d3ee', push: '#fbbf24', brake: '#fb923c', coast: '#34d399', done: '#34d399', stopped: '#f87171' }[settled];

  const eTop = niceMax(Math.max(p.e1, p.e2, 1));
  const planPts = p.stop
    ? [
        { x: 0, y: p.e1 },
        { x: p.sF, y: 0 },
      ]
    : [
        { x: 0, y: p.e1 },
        { x: p.sF, y: p.e2 },
        { x: Math.min(X_END, p.sF + p.v1 * (p.tEnd - p.t1)), y: p.e2 },
      ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.modeLabel}</GroupLabel>
          <Segmented
            label={L.modeLabel}
            className="grid-cols-1 sm:grid-cols-2"
            size="lg"
            value={mode}
            onChange={pickMode}
            accent={COL.workFill}
            options={[
              { value: 'push', label: L.modes.push.name, sub: L.modes.push.sub, icon: ChevronsRight },
              { value: 'brake', label: L.modes.brake.name, sub: L.modes.brake.sub, icon: OctagonMinus },
            ]}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={started} onToggle={toggle} onReset={resetSim} />
      </div>

      <WorkScene T={T} p={p} zoneS={s} st={st} sign={sign} F={F} m={m} A={A} e={e} xz={xz} started={started} slow={slow} fast={fast} t={sim.t} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        <Rich>{text}</Rich>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={L.readouts.A}
          symbol={T.Asym}
          value={J(A)}
          unit={T.J}
          accent={COL.workFill}
          textColor={COL.workText}
          active={started && st.inZone && !sim.done}
          sub={<Rich>{sign > 0 ? L.ASubPush(D(F), V(xz)) : L.ASubBrake(D(F), V(xz))}</Rich>}
        />
        <Readout label={L.readouts.ek1} symbol={<Rich>{`E_{${T.kSub}1}`}</Rich>} value={J(p.e1)} unit={T.J} accent={COL.ekFill} textColor={COL.ekText} sub={<Rich>{L.ek1Sub(D(m), D(v0))}</Rich>} />
        <Readout
          label={L.readouts.ek}
          symbol={<Rich>{`E_{${T.kSub}}`}</Rich>}
          value={J(e)}
          unit={T.J}
          accent={COL.ekFill}
          textColor={COL.ekText}
          active={sim.done}
          sub={<Rich>{L.ekSub(J(p.e1), paren(A))}</Rich>}
        />
        <Readout label={L.readouts.v} symbol="v" value={V(v)} unit={T.ms} accent={COL.vel} textColor={COL.velText} sub={<Rich>{L.vSub(J(e), D(m))}</Rich>} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <FormulaTile
            tag={L.formula.tag}
            color={COL.workText}
            general={L.formula.general}
            filled={L.formula.filled(J(p.A), J(p.e2), J(p.e1))}
            result={L.formula.result(J(p.e2), D(m), Vt(p.v1))}
            ok={sim.done}
          />
          <div className="grid gap-x-5 gap-y-1 sm:grid-cols-2 lg:grid-cols-1">
            <RangeField id="ke-w-m" label={L.m} symbol="m" min={1} max={5} step={0.5} value={m} onChange={change(setM)} accent="#94a3b8" display={`${D(m)} ${T.kg}`} />
            <RangeField id="ke-w-F" label={L.F} symbol="F" min={1} max={20} step={1} value={F} onChange={change(setF)} accent={COL.force} display={`${D(F)} ${T.N}`} />
            <RangeField id="ke-w-s" label={L.s} symbol="s" min={1} max={8} step={0.5} value={s} onChange={change(setS)} accent={COL.workFill} display={`${D(s)} ${T.m}`} />
            <RangeField
              id="ke-w-v0"
              label={L.v0}
              symbol={<Rich>v₀</Rich>}
              min={sign > 0 ? 0 : 1}
              max={8}
              step={0.5}
              value={v0}
              onChange={change(setV0)}
              accent={COL.vel}
              display={`${D(v0)} ${T.ms}`}
            />
          </div>
          <p className="text-xs leading-snug text-gray-500">{L.hint}</p>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <TimeGraph
            title={<Rich>{L.graph.title}</Rich>}
            ariaLabel={L.graph.label}
            series={[
              { id: 'plan', label: L.graph.plan, color: 'rgba(110,231,183,0.45)', points: planPts, dash: '5 5', dot: false },
              { id: 'live', label: <span><Rich>{L.graph.live}</Rich></span>, color: COL.ekText, points: sim.samples },
            ]}
            xMax={TRACK}
            yMax={eTop}
            xLabel={L.graph.x}
            yLabel={L.graph.y}
            marker={started ? st.x : undefined}
            note={L.graph.note(D(F))}
            decimal={dec}
            xDigits={0}
            yDigits={tickDigits(eTop)}
            height={300}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

function WorkScene({ T, p, zoneS, st, sign, F, m, A, e, xz, started, slow, fast, t }) {
  const L = T.work;
  const dec = T.decimal;
  const lay = (narrow) => (narrow ? { dimY: 70, railY: 182, H: 410 } : { dimY: 112, railY: 256, H: 336 });
  const inZone = st.inZone && !(p.stop && t >= p.t1 - 1e-9);
  return (
    <LabScene
      legend={[
        { color: COL.force, label: L.legend.F, kind: 'arrow' },
        { color: COL.vel, label: L.legend.v, kind: 'arrow' },
        { color: COL.workFill, label: L.legend.zone, kind: 'zone' },
      ]}
      chips={(W, narrow) => {
        const trackW = narrow ? W - 28 : W - Math.min(300, Math.max(230, W * 0.24)) - 30;
        const kF = Math.min(narrow ? 4 : 8, (trackW * 0.2) / 20);
        return (
          <>
            <Chip>
              {slow > 1 ? L.chipSlow(slow) : fast > 1 ? L.chipFast(fast) : L.chipReal} · t = {num(t, 2, dec)} {T.s}
            </Chip>
            <ScaleChip px={10 * kF} text={L.scaleLabel(10)} />
          </>
        );
      }}
      height={(W, narrow) => lay(narrow).H}
      ariaLabel={L.sceneLabel(trim(st.x, dec, 1), round(st.v, 2, dec), trim(A, dec, 1), trim(e, dec, 1))}
    >
      {(W, H, narrow) => {
        const { dimY, railY } = lay(narrow);
        const fs = narrow ? 11 : 12.5;
        const barsW = narrow ? 0 : Math.round(Math.min(300, Math.max(230, W * 0.24)));
        const trackR = W - barsW - (narrow ? 12 : 22);
        const view = lineView(-1, TRACK, W, narrow ? 14 : 22, W - trackR);
        const trackW = trackR - (narrow ? 14 : 22);
        const kF = Math.min(narrow ? 4 : 8, (trackW * 0.2) / 20);
        const vPlanMax = Math.max(p.v0, p.v1, 1);
        const kv = Math.min(narrow ? 6 : 10, (trackW * 0.22) / vPlanMax);
        const len = Math.max(narrow ? 46 : 74, Math.min(narrow ? 56 : 104, view.k * 1.2));
        const cg = cartGeom(len, m);
        const cx = view.sx(st.x);
        const midY = railY + cg.midY;
        const zx0 = view.sx(0);
        const zx1 = view.sx(zoneS);
        const zStop = view.sx(p.sF);
        const step = rulerStep(view, narrow ? 34 : 56);
        const fLen = F * kF;
        const vLen = st.v * kv;
        const forceOn = inZone && !(started && st.v <= 1e-9 && sign < 0);
        return (
          <>
            <CartDefs />
            <rect width={W} height={H} fill="#fbfcfe" />
            {/* paper grid */}
            <g aria-hidden="true">
              {Array.from({ length: Math.floor((TRACK + 1) / step) + 1 }, (_, i) => -1 + i * step)
                .filter((x) => x >= -1 && x <= TRACK)
                .map((x) => (
                  <line key={x} x1={view.sx(x)} x2={view.sx(x)} y1={dimY - 26} y2={railY + 16} stroke={COL.grid} strokeWidth={1} />
                ))}
            </g>
            {/* the stretch where the force acts */}
            <rect x={zx0} y={dimY + 8} width={Math.max(0, zx1 - zx0)} height={railY - dimY - 4} fill={COL.workFill} opacity={0.1} />
            <line x1={zx0} x2={zx0} y1={dimY - 8} y2={railY + 4} stroke={COL.work} strokeWidth={1.4} strokeDasharray="4 3" />
            <line x1={zx1} x2={zx1} y1={dimY - 8} y2={railY + 4} stroke={COL.work} strokeWidth={1.4} strokeDasharray="4 3" />
            {p.stop && (
              <g>
                <line x1={zStop} x2={zStop} y1={dimY + 14} y2={railY + 4} stroke={COL.force} strokeWidth={2} />
                <SvgSym x={zStop} y={dimY + 28} main="" rest={`${trim(p.sF, dec, 2)} ${T.m}`} color={COL.force} fs={fs - 1} anchor="middle" />
              </g>
            )}
            <DimLine x1={zx0} x2={zx1} y={dimY} color={COL.work} />
            <rect x={(zx0 + zx1) / 2 - 44} y={dimY - 11} width={88} height={22} rx={11} fill="#fff" opacity={0.92} />
            <SvgSym x={(zx0 + zx1) / 2} y={dimY + 4.5} main="s" rest={` = ${trim(zoneS, dec, 2)} ${T.m}`} color={COL.work} fs={fs} anchor="middle" />
            {/* covered part of the stretch */}
            {started && xz > 0 && <rect x={zx0} y={railY - 3} width={Math.max(0, view.sx(xz) - zx0)} height={3} fill={COL.work} />}

            <Rail a={view.sx(-1) - 8} b={view.sx(TRACK) + 6} y={railY} feet={!narrow} />
            <g>
              <rect x={view.sx(TRACK)} y={railY - 30} width={9} height={30} rx={2} fill="#334155" />
            </g>
            <Ruler view={view} y={railY + 16} step={step} unit={L.axisX} decimal={dec} fs={narrow ? 10 : 11} fromX={view.sx(-1) - 8} toX={view.sx(TRACK) + 6} unitX={trackR + 6} />

            <Cart cx={cx} y={railY} len={len} mass={m} label={`${trim(m, dec)} ${T.kg}`} rot={(st.x * view.k) / (len * 0.1)} fs={narrow ? 10 : 12} />
            {forceOn && (
              <VecArrow
                x={sign > 0 ? cx + len / 2 + 3 : cx - len / 2 - 3}
                y={midY}
                dx={sign * fLen}
                dy={0}
                color={COL.force}
                main="F"
                rest={narrow ? '' : ` = ${trim(F, dec)} ${T.N}`}
                fs={fs}
                place="above"
              />
            )}
            {st.v > 0.01 && (() => {
              const ax = cx - Math.min(vLen, len) / 2;
              const ay = railY + cg.top - 14;
              const tag = ` = ${round(st.v, 2, dec)} ${T.ms}`;
              const flip = ax + vLen + 14 + textWidth(`v${tag}`, fs, 700) > trackR;
              return (
                <g>
                  <VecArrow x={ax} y={ay} dx={vLen} dy={0} color={COL.vel} main={flip ? undefined : 'v'} rest={tag} fs={fs} />
                  {flip && <SvgSym x={ax - 8} y={ay + fs * 0.35} main="v" rest={tag} color={COL.vel} fs={fs} anchor="end" />}
                </g>
              );
            })()}
            {narrow ? (
              <WorkBars T={T} p={p} A={A} e={e} sign={sign} x0={12} x1={W - 12} y0={railY + 52} y1={H - 12} narrow />
            ) : (
              <WorkBars T={T} p={p} A={A} e={e} sign={sign} x0={W - barsW} x1={W - 12} y0={90} y1={H - 14} />
            )}
          </>
        );
      }}
    </LabScene>
  );
}

/** A dimension line with arrow heads at both ends. */
function DimLine({ x1, x2, y, color }) {
  if (x2 - x1 < 8) return null;
  return (
    <g aria-hidden="true">
      <line x1={x1 + 6} x2={x2 - 6} y1={y} y2={y} stroke={color} strokeWidth={1.5} />
      <path d={`M${x1},${y} l7,-4 l0,8 Z`} fill={color} />
      <path d={`M${x2},${y} l-7,-4 l0,8 Z`} fill={color} />
    </g>
  );
}

/**
 * Energy bars that add up: E_k1 (green), the work A (amber; hatched and
 * hanging down when negative) and the kinetic energy now (green). Dashed
 * outlines show where the bars will end.
 */
function WorkBars({ T, p, A, e, sign, x0, x1, y0, y1, narrow }) {
  const L = T.work;
  const dec = T.decimal;
  const J = (n) => trim(n, dec, 1);
  const top = y0 + (narrow ? 26 : 34);
  const base = y1 - (narrow ? 40 : 46);
  const hMax = base - top - 14;
  const eMax = Math.max(p.e1, p.e1 + Math.max(0, p.A), 1e-6);
  const h = (val) => (Math.max(0, val) / eMax) * hMax;
  const span = x1 - x0;
  const bw = Math.min(narrow ? 46 : 50, span * 0.17);
  const cxs = [x0 + span * 0.2, x0 + span * 0.5, x0 + span * 0.8];
  const yE1 = base - h(p.e1);
  const yNow = base - h(p.e1 + A);
  const yPlan = base - h(p.e1 + p.A);
  const label = (cx, y, txt, color) => (
    <text x={cx} y={y} textAnchor="middle" fontSize={12} fontWeight="700" fill={color} className="tabular-nums">
      {txt}
    </text>
  );
  const aTop = Math.min(yE1, yNow);
  const aH = Math.abs(yE1 - yNow);
  const aPlanTop = Math.min(yE1, yPlan);
  const aPlanH = Math.abs(yE1 - yPlan);
  const sym = { fs: narrow ? 12 : 13, color: '#334155', anchor: 'middle' };
  return (
    <g>
      <rect x={x0} y={y0} width={span} height={y1 - y0} rx={12} fill="#f8fafc" stroke="#e2e8f0" />
      <text x={x0 + 12} y={y0 + 19} fontSize={12} fontWeight="700" fill="#334155">
        {L.bars.title}
      </text>
      <line x1={x0 + 10} x2={x1 - 10} y1={base} y2={base} stroke="#94a3b8" strokeWidth={1.3} />
      {/* connectors */}
      <line x1={cxs[0] + bw / 2} x2={cxs[1] - bw / 2} y1={yE1} y2={yE1} stroke="#64748b" strokeDasharray="3 3" />
      <line x1={cxs[1] + bw / 2} x2={cxs[2] - bw / 2} y1={yNow} y2={yNow} stroke="#64748b" strokeDasharray="3 3" />
      {/* E_k1 */}
      {p.e1 > 1e-9 && <rect x={cxs[0] - bw / 2} y={yE1} width={bw} height={base - yE1} rx={4} fill={COL.ekFill} stroke={COL.ek} strokeWidth={1.2} />}
      {label(cxs[0], yE1 - 7, `${J(p.e1)} ${T.J}`, COL.ek)}
      {/* A: planned outline, then the part done so far */}
      {aPlanH > 0.5 && <rect x={cxs[1] - bw / 2} y={aPlanTop} width={bw} height={aPlanH} rx={4} fill="none" stroke={COL.work} strokeWidth={1.2} strokeDasharray="4 3" />}
      {aH > 0.5 && (
        <rect x={cxs[1] - bw / 2} y={aTop} width={bw} height={aH} rx={4} fill={sign > 0 ? COL.workFill : 'url(#ke-hatch)'} stroke={COL.work} strokeWidth={1.2} />
      )}
      {label(cxs[1], Math.min(aPlanTop, aTop) - 7, `${A > 0 ? '+' : ''}${J(A)} ${T.J}`, COL.work)}
      {/* E_k now */}
      {!p.stop && Math.abs(yPlan - base) > 0.5 && <rect x={cxs[2] - bw / 2} y={yPlan} width={bw} height={base - yPlan} rx={4} fill="none" stroke={COL.ek} strokeWidth={1.2} strokeDasharray="4 3" />}
      {e > 1e-9 && <rect x={cxs[2] - bw / 2} y={yNow} width={bw} height={base - yNow} rx={4} fill={COL.ekFill} stroke={COL.ek} strokeWidth={1.2} />}
      {label(cxs[2], Math.min(yNow, p.stop ? yNow : yPlan) - 7, `${J(e)} ${T.J}`, COL.ek)}
      {/* names */}
      <SvgSym x={cxs[0]} y={base + 17} main="E" sub={`${T.kSub}1`} {...sym} />
      <SvgSym x={cxs[1]} y={base + 17} main={T.Asym} {...sym} />
      <SvgSym x={cxs[2]} y={base + 17} main="E" sub={T.kSub} {...sym} />
      <text x={(cxs[0] + cxs[1]) / 2} y={base + 17} textAnchor="middle" fontSize={14} fontWeight="700" fill="#64748b">
        +
      </text>
      <text x={(cxs[1] + cxs[2]) / 2} y={base + 17} textAnchor="middle" fontSize={14} fontWeight="700" fill="#64748b">
        =
      </text>
      <text x={(x0 + x1) / 2} y={y1 - 10} textAnchor="middle" fontSize={narrow ? 11.5 : 12} fontWeight="600" fill="#475569" className="tabular-nums">
        {`${J(p.e1)} + ${A < 0 ? `(${J(A)})` : J(A)} = ${J(e)} ${T.J}`}
      </text>
    </g>
  );
}
