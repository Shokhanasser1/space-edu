import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpLeft, Feather, Lightbulb, Lock, TriangleRight } from 'lucide-react';

import { Explain, RangeField, Readout, Segmented, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { Grid, PALETTE, TimeGraph, makeView } from '../kit/scene';
import {
  AngleArc,
  Chip,
  Eq,
  FC,
  FbdAxis,
  FbdPaper,
  ForceArrow,
  ForceChips,
  ForceScale,
  G,
  Ground,
  GroupLabel,
  LabScene,
  MethodPanel,
  Panel,
  PlayControls,
  SceneRow,
  Step,
  Sym,
  SvgSym,
  ceil4,
  deg,
  num,
  rad,
  sideLabel,
} from './MultipleForces.parts';

/**
 * Tab 1 — a body on an inclined plane with friction. Three forces (mg, N,
 * F_ishq), mg split into mg·sinα along the slope and mg·cosα across it,
 * Newton's second law projected on x (along the slope) and y (across it):
 *   sliding down:  a = g(sinα − μcosα), N = mg·cosα;
 *   pushed up:     a = −g(sinα + μcosα) (x up the slope), then it slides
 *                  back with a = −g(sinα − μcosα) unless tanα ≤ μ;
 *   at rest when tanα ≤ μ (static friction = mg·sinα).
 * Preset α = 30°, μ = 0.2 → a = 9.8·(0.5 − 0.2·0.866) = 3.20 m/s².
 */

const SLOPE = 5; // m, length of the incline
const U_BOT = 0.5; // m, lowest position of the box centre along the slope
const U_TOP = 4.5; // m, highest position
const TRAVEL = U_TOP - U_BOT; // 4 m
const ALPHA_MIN = 5;
const ALPHA_MAX = 60;
const IDLE = { t: 0, running: false, done: false };

const PRESETS = {
  lesson: { mode: 'down', alpha: 30, mu: 0.2, m: 2, v0: 6, icon: TriangleRight },
  smooth: { mode: 'down', alpha: 30, mu: 0, m: 2, v0: 6, icon: Feather },
  rest: { mode: 'down', alpha: 10, mu: 0.3, m: 2, v0: 6, icon: Lock },
  push: { mode: 'up', alpha: 30, mu: 0.2, m: 2, v0: 6, icon: ArrowUpLeft },
};

/**
 * The whole motion as phases of constant acceleration along u (metres from
 * the bottom of the slope, up the slope positive).
 */
function planIncline(mode, alpha, mu, v0) {
  const sa = Math.sin(rad(alpha));
  const ca = Math.cos(rad(alpha));
  const aDown = G * (sa - mu * ca); // |a| sliding down (≤ 0 means it cannot slide)
  const aUp = G * (sa + mu * ca); // |a| while moving up
  const slides = aDown > 1e-9;
  const phases = [];
  let end = 'static';
  let sUp = 0;
  if (mode === 'down') {
    if (slides) {
      phases.push({ kind: 'down', t0: 0, t1: Math.sqrt((2 * TRAVEL) / aDown), u0: U_TOP, v0: 0, a: -aDown });
      end = 'bottom';
    }
  } else {
    const tStop = v0 / aUp;
    sUp = (v0 * v0) / (2 * aUp);
    if (U_BOT + sUp >= U_TOP - 1e-9) {
      const tEdge = (v0 - Math.sqrt(Math.max(0, v0 * v0 - 2 * aUp * TRAVEL))) / aUp;
      phases.push({ kind: 'up', t0: 0, t1: tEdge, u0: U_BOT, v0, a: -aUp });
      end = 'edge';
    } else {
      phases.push({ kind: 'up', t0: 0, t1: tStop, u0: U_BOT, v0, a: -aUp });
      if (slides) {
        phases.push({ kind: 'back', t0: tStop, t1: tStop + Math.sqrt((2 * sUp) / aDown), u0: U_BOT + sUp, v0: 0, a: -aDown });
        end = 'back';
      } else end = 'stuck';
    }
  }
  return { sa, ca, aDown, aUp, slides, phases, end, sUp, tEnd: phases.length ? phases[phases.length - 1].t1 : 0 };
}

/** Position u, velocity v and acceleration a (along u), phase kind and path s at time t. */
function stateAt(plan, mode, t) {
  const { phases } = plan;
  if (!phases.length) return { u: mode === 'down' ? U_TOP : U_BOT, v: 0, a: 0, kind: 'rest', s: 0 };
  let s = 0;
  for (let i = 0; i < phases.length; i += 1) {
    const p = phases[i];
    const last = i === phases.length - 1;
    if (t <= p.t1 || last) {
      const tau = clamp(t - p.t0, 0, p.t1 - p.t0);
      const du = p.v0 * tau + 0.5 * p.a * tau * tau;
      if (last && plan.end === 'stuck' && t >= p.t1 - 1e-9) return { u: p.u0 + du, v: 0, a: 0, kind: 'rest', s: s + Math.abs(du) };
      return { u: p.u0 + du, v: p.v0 + p.a * tau, a: p.a, kind: p.kind, s: s + Math.abs(du) };
    }
    const d = p.t1 - p.t0;
    s += Math.abs(p.v0 * d + 0.5 * p.a * d * d);
  }
  return { u: U_BOT, v: 0, a: 0, kind: 'rest', s };
}

/** The forces on the box: N, friction along u (+ = up the slope), static or sliding. */
function forcesOf(m, mu, plan, st) {
  const mg = m * G;
  const N = mg * plan.ca;
  if (st.kind === 'down' || st.kind === 'back') return { mg, N, fr: mu * N, frStatic: false };
  if (st.kind === 'up') return { mg, N, fr: -mu * N, frStatic: false };
  return { mg, N, fr: mg * plan.sa, frStatic: true };
}

/* ==================================================================== sim */

export default function InclineSim({ T }) {
  const L = T.incline;
  const dec = T.decimal;
  const [mode, setMode] = useState('down');
  const [alpha, setAlpha] = useState(30);
  const [mu, setMu] = useState(0.2);
  const [m, setM] = useState(2);
  const [v0, setV0] = useState(6);
  const [sim, setSim] = useState(IDLE);
  const [touched, setTouched] = useState(false);

  const plan = useMemo(() => planIncline(mode, alpha, mu, v0), [mode, alpha, mu, v0]);
  const preset =
    Object.keys(PRESETS).find((k) => {
      const p = PRESETS[k];
      return p.mode === mode && p.alpha === alpha && p.mu === mu && p.m === m && (mode === 'down' || p.v0 === v0);
    }) ?? null;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(plan.tEnd, p.t + dt);
      const done = t >= plan.tEnd - 1e-9;
      return { t, running: !done, done };
    });
  });

  const change = (fn) => (v) => {
    fn(v);
    setSim(IDLE);
    setTouched(true);
  };
  const pick = (id) => {
    const p = PRESETS[id];
    setMode(p.mode);
    setAlpha(p.alpha);
    setMu(p.mu);
    setM(p.m);
    setV0(p.v0);
    setSim(IDLE);
    setTouched(true);
  };
  const canRun = plan.tEnd > 0.01;
  const toggle = () => {
    if (!canRun) return;
    setTouched(true);
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);

  const st = stateAt(plan, mode, sim.t);
  const f = forcesOf(m, mu, plan, st);
  const sgn = mode === 'down' ? -1 : 1; // the x axis: down the slope, or up the slope
  const ax = sgn * st.a;
  const vx = sgn * st.v;
  const F2 = (n) => num(n, 2, dec);

  /* ---- explanation */
  let key;
  if (plan.end === 'static') key = 'stays';
  else if (sim.done) key = { bottom: 'doneDown', back: 'doneBack', edge: 'edge', stuck: 'stuck' }[plan.end];
  else if (sim.t === 0 && !sim.running && !touched) key = 'intro';
  else if (st.kind === 'down') key = mu === 0 ? 'smooth' : 'slide';
  else if (st.kind === 'up') key = 'up';
  else if (st.kind === 'back') key = 'back';
  else key = 'stuck';
  const settled = useSettled(key, sim.running ? 250 : 0);
  const ex = L.explain;
  const text = {
    intro: ex.intro,
    stays: ex.stays(fmt(Math.tan(rad(alpha)), 2, dec), fmt(mu, 2, dec), F2(f.mg * plan.sa), F2(mu * f.N)),
    slide: ex.slide(F2(plan.aDown)),
    smooth: ex.smooth(F2(plan.aDown)),
    up: ex.up(F2(-plan.aUp)),
    back: ex.back(F2(-plan.aDown)),
    stuck: ex.stuck(F2(plan.sUp)),
    doneDown: ex.doneDown(fmt(TRAVEL, 0, dec), F2(plan.tEnd), F2(Math.abs(st.v))),
    doneBack: ex.doneBack(F2(Math.abs(st.v)), fmt(v0, 1, dec)),
    edge: ex.edge(F2(Math.abs(st.v))),
  }[settled];
  const tone = {
    intro: '#22d3ee',
    stays: '#a78bfa',
    slide: '#fb923c',
    smooth: '#fb923c',
    up: '#fb923c',
    back: '#a78bfa',
    stuck: '#a78bfa',
    doneDown: '#34d399',
    doneBack: '#34d399',
    edge: '#f87171',
  }[settled];

  const a0 = deg(Math.atan(mu));
  const sUpHint = (v0 * v0) / (2 * plan.aUp);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.presetsLabel}</GroupLabel>
          <Segmented
            label={L.presetsLabel}
            className="grid-cols-2 md:grid-cols-4"
            size="lg"
            value={preset}
            onChange={pick}
            options={Object.keys(PRESETS).map((id) => ({ value: id, label: L.presets[id].name, sub: L.presets[id].sub, icon: PRESETS[id].icon }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={sim.t > 0} onToggle={toggle} onReset={reset} disabled={!canRun} />
      </div>

      <SceneRow
        renderScene={(fitH) => <InclineScene T={T} alpha={alpha} mu={mu} m={m} st={st} f={f} t={sim.t} running={sim.running} ax={ax} vx={vx} fitH={fitH} />}
        method={<InclineMethod T={T} alpha={alpha} mu={mu} m={m} mode={mode} st={st} f={f} plan={plan} />}
      />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        <Sym>{text}</Sym>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={L.readouts.a}
          symbol="a"
          value={F2(ax)}
          unit={T.ms2}
          accent={PALETTE.acc}
          textColor={PALETTE.accText}
          sub={st.kind === 'rest' ? L.aSub.rest : L.aSub[st.kind]}
          active={sim.running}
        />
        <Readout label={L.readouts.v} symbol="v" value={F2(vx)} unit={T.ms} accent={PALETTE.vel} textColor={PALETTE.velText} sub={L.vSub[mode]} />
        <Readout label={L.readouts.s} symbol="s" value={F2(st.s)} unit={T.m} accent={PALETTE.path} textColor={PALETTE.pathText} sub={L.sSub(fmt(TRAVEL, 0, dec))}>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full bg-violet-400" style={{ width: `${clamp(st.s / TRAVEL, 0, 1) * 100}%` }} />
          </div>
        </Readout>
        <Readout label={L.readouts.t} symbol="t" value={F2(sim.t)} unit={T.s} accent={PALETTE.time} textColor="#a5f3fc" sub={L.tSub} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <div>
            <GroupLabel>{L.modeLabel}</GroupLabel>
            <Segmented
              label={L.modeLabel}
              className="grid-cols-2"
              value={mode}
              onChange={change(setMode)}
              options={[
                { value: 'down', label: L.modes.down.name, sub: L.modes.down.sub, icon: ArrowDownRight },
                { value: 'up', label: L.modes.up.name, sub: L.modes.up.sub, icon: ArrowUpLeft },
              ]}
            />
          </div>
          <RangeField
            id="mf-alpha"
            label={L.alpha}
            symbol="α"
            min={ALPHA_MIN}
            max={ALPHA_MAX}
            step={1}
            value={alpha}
            onChange={change(setAlpha)}
            accent="#22d3ee"
            display={`${alpha}°`}
            hint={L.alphaHint(fmt(Math.tan(rad(alpha)), 3, dec))}
          />
          <RangeField
            id="mf-mu"
            label={L.mu}
            symbol="μ"
            min={0}
            max={0.8}
            step={0.05}
            value={mu}
            onChange={change(setMu)}
            accent={FC.fric}
            display={fmt(mu, 2, dec)}
            hint={mu > 0 ? L.muHint(fmt(a0, 1, dec)) : L.muHintZero}
          />
          <RangeField
            id="mf-m"
            label={L.m}
            symbol="m"
            min={1}
            max={10}
            step={0.5}
            value={m}
            onChange={change(setM)}
            accent={FC.weight}
            display={`${fmt(m, 1, dec)} ${T.kg}`}
            hint={L.mHint}
          />
          {mode === 'up' && (
            <RangeField
              id="mf-v0"
              label={L.v0}
              symbol={<Sym>v_{0}</Sym>}
              min={1}
              max={10}
              step={0.5}
              value={v0}
              onChange={change(setV0)}
              accent={PALETTE.vel}
              display={`${fmt(v0, 1, dec)} ${T.ms}`}
              hint={U_BOT + sUpHint >= U_TOP ? L.v0HintEdge(F2(sUpHint)) : L.v0Hint(F2(sUpHint))}
            />
          )}
        </Panel>
        <Panel className="lg:col-span-3">
          <InclineGraph T={T} alpha={alpha} mu={mu} aNow={Math.abs(st.a)} onPick={change(setAlpha)} />
        </Panel>
      </div>
    </div>
  );
}

/* ================================================================= scene */

function InclineScene({ T, alpha, mu, m, st, f, t, running, ax, vx, fitH }) {
  const L = T.incline;
  const dec = T.decimal;
  const S = T.sym;
  const sa = Math.sin(rad(alpha));
  const ca = Math.cos(rad(alpha));
  const b = SLOPE * ca;
  const h = SLOPE * sa;
  const lmg = (narrow, H) => (narrow ? 58 : clamp(H * 0.19, 84, 124));

  return (
    <LabScene
      legend={[
        { color: FC.weight, label: L.legend.mg, kind: 'arrow' },
        { color: FC.normal, label: L.legend.N, kind: 'arrow' },
        { color: FC.fric, label: L.legend.fr, kind: 'arrow' },
        { color: FC.weight, label: L.legend.comp, kind: 'dash' },
        { color: FC.vel, label: L.legend.v, kind: 'arrow' },
        { color: FC.acc, label: L.legend.a, kind: 'arrow' },
      ]}
      chips={(W, narrow, H) => (
        <>
          <Chip>
            {L.chipReal} · t = {fmt(t, 2, dec)} {T.s}
          </Chip>
          <ForceScale kF={lmg(narrow, H) / f.mg} label={T.scale} unit={T.N} decimal={dec} />
        </>
      )}
      height={(W, narrow) => fitH ?? (narrow ? 360 : 452)}
      ariaLabel={L.sceneLabel(alpha, fmt(mu, 2, dec), num(ax, 2, dec), num(vx, 2, dec))}
    >
      {(W, H, narrow) => {
        const Lmg = lmg(narrow, H);
        const pad = narrow ? { l: 24, r: 24, t: 82, b: 30 } : { l: 64, r: 64, t: 96 + Lmg * 0.45, b: 34 };
        const view = makeView({ x0: -0.15, x1: b + 0.15, y0: -0.2, y1: h + 0.05 }, W, H, pad);
        const k = view.k;
        const fs = narrow ? 11 : 12.5;
        const box = { w: W, h: H };
        const P = (u) => ({ x: view.sx(b - u * ca), y: view.sy(u * sa) });
        const dS = { x: ca, y: sa }; // screen, down the slope
        const nS = { x: sa, y: -ca }; // screen, out of the slope
        const up = { x: -ca, y: -sa };
        const bs = clamp(Math.cbrt(m / 2), 0.8, 1.5);
        const bl = 0.62 * bs * k;
        const bh = 0.42 * bs * k;
        const base = P(st.u);
        const c = { x: base.x + (nS.x * bh) / 2, y: base.y + (nS.y * bh) / 2 };

        /* forces, to scale */
        const kF = Lmg / f.mg;
        const mgTip = { x: c.x, y: c.y + Lmg };
        const yc = f.mg * ca * kF; // |mg·cosα| in px
        const yTip = { x: c.x - nS.x * yc, y: c.y - nS.y * yc };
        const xc = f.mg * sa * kF;
        const nLen = f.N * kF;
        const frLen = f.fr * kF;
        const yLab = sideLabel(c, yTip, mgTip, narrow ? 10 : 12);
        const xLab = sideLabel(yTip, mgTip, c, narrow ? 10 : 12);

        /* kinematic arrows above the box, starting at its leading edges */
        const kv = narrow ? 9 : 12;
        const ka = narrow ? 6 : 8;
        const vu = st.v;
        const au = st.a;
        const edge = (sign, off) => {
          const along = sign > 0 ? up : dS;
          return { x: c.x + nS.x * (bh / 2 + off) + (along.x * bl) / 2, y: c.y + nS.y * (bh / 2 + off) + (along.y * bl) / 2, d: along };
        };
        const vStart = edge(vu, 14);
        const aStart = edge(au, 32);

        /* slope ruler: a tick every metre */
        const ticks = [];
        for (let u = 1; u <= 4; u += 1) {
          const p = P(u);
          ticks.push(
            <g key={u}>
              <line x1={p.x} y1={p.y} x2={p.x - nS.x * 7} y2={p.y - nS.y * 7} stroke="#64748b" strokeWidth="1.2" />
              <text x={p.x - nS.x * 18} y={p.y - nS.y * 18 + 4} textAnchor="middle" fontSize={fs - 2} fill="#94a3b8">
                {u === 4 ? `${u} ${T.m}` : u}
              </text>
            </g>,
          );
        }

        const A = { x: view.sx(0), y: view.sy(h) };
        const B = { x: view.sx(b), y: view.sy(0) };
        const C = { x: view.sx(0), y: view.sy(0) };
        const arcR = narrow ? 26 : 34;

        return (
          <>
            <Grid view={view} W={W} H={H} />
            <Ground W={W} y={C.y} depth={H - C.y} />
            <polygon points={`${A.x},${A.y} ${B.x},${B.y} ${C.x},${C.y}`} fill="#e2e8f0" stroke="#475569" strokeWidth="2" strokeLinejoin="round" />
            <path d={`M${C.x + 10},${C.y} L${C.x + 10},${C.y - 10} L${C.x},${C.y - 10}`} fill="none" stroke="#64748b" strokeWidth="1.2" />
            {ticks}
            <AngleArc cx={B.x} cy={B.y} r={arcR} from={Math.PI} to={Math.atan2(A.y - B.y, A.x - B.x)} color="#0f172a" fs={fs} />
            <text x={B.x + 6} y={B.y + fs + 6} textAnchor="end" fontSize={fs} fontWeight="700" fill="#0f172a" stroke="#f1f5f9" strokeWidth="3.5" paintOrder="stroke">
              {L.angleTag(alpha)}
            </text>

            {/* the box */}
            <g transform={`translate(${c.x.toFixed(1)} ${c.y.toFixed(1)}) rotate(${alpha})`}>
              {running && <rect x={-bl / 2 - 5} y={-bh / 2 - 5} width={bl + 10} height={bh + 10} rx={8} fill="#f59e0b" className="cl-pulse" opacity="0.25" />}
              <rect x={-bl / 2} y={-bh / 2} width={bl} height={bh} rx={4} fill="#fcd9a8" stroke="#b7791f" strokeWidth="2" />
              <line x1={-bl / 2 + 4} x2={bl / 2 - 4} y1={-bh / 6} y2={-bh / 6} stroke="#e0b07a" strokeWidth="1.2" />
              <line x1={-bl / 2 + 4} x2={bl / 2 - 4} y1={bh / 6} y2={bh / 6} stroke="#e0b07a" strokeWidth="1.2" />
              <text x={-bl / 2 + 5} y={-bh / 2 + fs} fontSize={fs - 2} fontWeight="700" fill="#92400e">
                {fmt(m, m % 1 ? 1 : 0, dec)} {T.kg}
              </text>
            </g>

            {/* mg split into its two parts (head to tail), then the real forces */}
            <ForceArrow x={c.x} y={c.y} dx={yTip.x - c.x} dy={yTip.y - c.y} color={FC.weight} width={2} head={9} dash="5 4" opacity={0.8} />
            <ForceArrow x={yTip.x} y={yTip.y} dx={mgTip.x - yTip.x} dy={mgTip.y - yTip.y} color={FC.weight} width={2} head={9} dash="5 4" opacity={0.8} />
            {yc > 26 && <SvgSym x={yLab.x} y={yLab.y} text={S.mgy} color={FC.weight} fs={fs - 1.5} anchor={yLab.anchor} weight={600} />}
            {xc > 26 && <SvgSym x={xLab.x} y={xLab.y} text={S.mgx} color={FC.weight} fs={fs - 1.5} anchor={xLab.anchor} weight={600} />}
            <ForceArrow x={c.x} y={c.y} dx={0} dy={Lmg} color={FC.weight} label={S.mg} fs={fs} box={box} labelAt={{ x: mgTip.x + 9, y: mgTip.y + 2, anchor: 'start' }} />
            <ForceArrow x={c.x} y={c.y} dx={nS.x * nLen} dy={nS.y * nLen} color={FC.normal} label={S.N} fs={fs} box={box} />
            <circle cx={c.x} cy={c.y} r={3.5} fill="#0f172a" stroke="#fff" strokeWidth="1.5" />
            {/* friction acts along the contact surface, drawn just under the box */}
            <ForceArrow
              x={base.x - nS.x * 6}
              y={base.y - nS.y * 6}
              dx={up.x * frLen}
              dy={up.y * frLen}
              color={FC.fric}
              label={S.fr}
              fs={fs}
              box={box}
            />

            {/* velocity and acceleration */}
            {Math.abs(vu) > 0.02 && (
              <ForceArrow x={vStart.x} y={vStart.y} dx={vStart.d.x * Math.abs(vu) * kv} dy={vStart.d.y * Math.abs(vu) * kv} color={FC.vel} width={2.75} head={10} label={S.v} fs={fs} box={box} />
            )}
            {Math.abs(au) > 0.02 && (
              <ForceArrow x={aStart.x} y={aStart.y} dx={aStart.d.x * Math.abs(au) * ka} dy={aStart.d.y * Math.abs(au) * ka} color={FC.acc} width={2.75} head={10} label={S.a} fs={fs} box={box} />
            )}
          </>
        );
      }}
    </LabScene>
  );
}

/* ======================================================= free-body diagram */

function InclineFbd({ T, alpha, mode, f }) {
  const L = T.incline;
  const dec = T.decimal;
  const S = T.sym;
  const sa = Math.sin(rad(alpha));
  const ca = Math.cos(rad(alpha));
  const F2 = (n) => `${num(n, 2, dec)} ${T.N}`;
  return (
    <FbdPaper title={L.fbd.title} height={250} ariaLabel={L.fbd.label(alpha)}>
      {(W, H) => {
        const c = { x: W * 0.47, y: H * 0.44 };
        const Lmg = Math.min(W * 0.27, H * 0.36);
        const kF = Lmg / f.mg;
        const box = { w: W, h: H };
        const dS = { x: ca, y: sa };
        const nS = { x: sa, y: -ca };
        const up = { x: -ca, y: -sa };
        const xDir = mode === 'down' ? dS : up;
        const mgTip = { x: c.x, y: c.y + Lmg };
        const yc = f.mg * ca * kF;
        const yTip = { x: c.x - nS.x * yc, y: c.y - nS.y * yc };
        const nLen = f.N * kF;
        const frLen = f.fr * kF;
        const xLab = sideLabel(yTip, mgTip, c, 11);
        const yLab = sideLabel(c, yTip, mgTip, 11);
        const half = 15;
        return (
          <>
            {/* the slope under the body, faint */}
            <line
              x1={c.x - dS.x * 130 - nS.x * half}
              y1={c.y - dS.y * 130 - nS.y * half}
              x2={c.x + dS.x * 130 - nS.x * half}
              y2={c.y + dS.y * 130 - nS.y * half}
              stroke="#cbd5e1"
              strokeWidth="2"
            />
            <g transform={`translate(${c.x} ${c.y}) rotate(${alpha})`}>
              <rect x={-half} y={-half} width={half * 2} height={half * 2} rx={3} fill="#fdecd2" stroke="#e0b07a" strokeWidth="1.2" />
            </g>
            <FbdAxis x={c.x} y={c.y} ux={xDir.x} uy={xDir.y} len={Lmg * 1.28} label="x" />
            <FbdAxis x={c.x} y={c.y} ux={nS.x} uy={nS.y} len={Lmg * 1.22} back={0.25} label="y" />
            <AngleArc cx={c.x} cy={c.y} r={24} from={Math.PI / 2} to={Math.atan2(yTip.y - c.y, yTip.x - c.x)} label="α" color="#b91c1c" fs={12} labelR={36} />
            <ForceArrow x={c.x} y={c.y} dx={yTip.x - c.x} dy={yTip.y - c.y} color={FC.weight} width={1.8} head={8} dash="4 3" opacity={0.8} />
            <ForceArrow x={yTip.x} y={yTip.y} dx={mgTip.x - yTip.x} dy={mgTip.y - yTip.y} color={FC.weight} width={1.8} head={8} dash="4 3" opacity={0.8} />
            {yc > 22 && <SvgSym x={yLab.x} y={yLab.y} text={S.mgy} color={FC.weight} fs={11} anchor={yLab.anchor} weight={600} />}
            {f.mg * sa * kF > 22 && <SvgSym x={xLab.x} y={xLab.y} text={S.mgx} color={FC.weight} fs={11} anchor={xLab.anchor} weight={600} />}
            <ForceArrow x={c.x} y={c.y} dx={0} dy={Lmg} color={FC.weight} label={S.mg} value={F2(f.mg)} fs={12} box={box} labelAt={{ x: mgTip.x + 8, y: mgTip.y + 4, anchor: 'start' }} />
            <ForceArrow x={c.x} y={c.y} dx={nS.x * nLen} dy={nS.y * nLen} color={FC.normal} label={S.N} value={F2(f.N)} fs={12} box={box} />
            <ForceArrow x={c.x} y={c.y} dx={up.x * frLen} dy={up.y * frLen} color={FC.fric} label={S.fr} value={F2(Math.abs(f.fr))} fs={12} box={box} />
            <circle cx={c.x} cy={c.y} r={3.5} fill="#0f172a" stroke="#fff" strokeWidth="1.5" />
          </>
        );
      }}
    </FbdPaper>
  );
}

/* =========================================================== the method */

function InclineMethod({ T, alpha, mu, m, mode, st, f, plan }) {
  const L = T.incline;
  const M = L.method;
  const S = T.sym;
  const dec = T.decimal;
  const F2 = (n) => num(n, 2, dec);
  const sinS = fmt(plan.sa, 3, dec);
  const cosS = fmt(plan.ca, 3, dec);
  const gS = fmt(G, 1, dec);
  const muS = fmt(mu, 2, dec);
  const mS = fmt(m, 1, dec);
  const mgS = F2(f.mg);
  const mgx = F2(f.mg * plan.sa);
  const frS = F2(Math.abs(f.fr));
  const fr = S.fr;
  const N = T.N;
  const kind = st.kind;

  let ox;
  let oxNum;
  let res;
  let resNum;
  let resVal;
  if (kind === 'rest') {
    ox = mode === 'down' ? `mg·sinα − ${fr} = 0` : `−mg·sinα + ${fr} = 0`;
    oxNum = `${fr} = ${mgS}·${sinS} = ${mgx} ${N}`;
    res = 'a = 0';
    resNum = M.restCheck(mgx, F2(mu * f.N));
  } else if (kind === 'down') {
    ox = `mg·sinα − ${fr} = m·a`;
    oxNum = `${mgx} − ${frS} = ${mS}·a`;
    res = 'a = g(sinα − μcosα)';
    resNum = `= ${gS}·(${sinS} − ${muS}·${cosS}) =`;
    resVal = `${F2(plan.aDown)} ${T.ms2}`;
  } else if (kind === 'up') {
    ox = `−mg·sinα − ${fr} = m·a`;
    oxNum = `−${mgx} − ${frS} = ${mS}·a`;
    res = 'a = −g(sinα + μcosα)';
    resNum = `= −${gS}·(${sinS} + ${muS}·${cosS}) =`;
    resVal = `${F2(-plan.aUp)} ${T.ms2}`;
  } else {
    ox = `−mg·sinα + ${fr} = m·a`;
    oxNum = `−${mgx} + ${frS} = ${mS}·a`;
    res = 'a = −g(sinα − μcosα)';
    resNum = `= −${gS}·(${sinS} − ${muS}·${cosS}) =`;
    resVal = `${F2(-plan.aDown)} ${T.ms2}`;
  }

  return (
    <MethodPanel title={M.title} fbd={<InclineFbd T={T} alpha={alpha} mode={mode} f={f} />}>
      <Step n={1} title={M.s1}>
        <ForceChips
          items={[
            { sym: S.mg, color: FC.weight, text: FC.weightText },
            { sym: S.N, color: FC.normal, text: FC.normalText },
            { sym: fr, color: FC.fric, text: FC.fricText },
          ]}
        />
      </Step>
      <Step n={2} title={M.s2}>
        <p className="mt-0.5">{mode === 'down' ? M.axesDown : M.axesUp}</p>
      </Step>
      <Step n={3} title={M.s3}>
        <Eq tag="Ox" sym={ox} nums={oxNum} />
        <Eq tag="Oy" sym="N − mg·cosα = 0" nums={`N = ${mgS}·${cosS} = ${F2(f.N)} ${N}`} />
        {kind !== 'rest' && <Eq tag="" sym={`${fr} = μN`} nums={`= ${muS}·${F2(f.N)} = ${frS} ${N}`} />}
      </Step>
      <Step n={4} title={M.s4}>
        <Eq sym={res} nums={resNum} result={resVal} />
      </Step>
    </MethodPanel>
  );
}

/* ================================================================ graph */

function InclineGraph({ T, alpha, mu, aNow, onPick }) {
  const L = T.incline;
  const dec = T.decimal;
  const { down, up, yMax } = useMemo(() => {
    const d = [];
    const u = [];
    let top = 0;
    for (let x = 0; x <= ALPHA_MAX; x += 1) {
      const s = Math.sin(rad(x));
      const c = Math.cos(rad(x));
      d.push({ x, y: Math.max(0, G * (s - mu * c)) });
      u.push({ x, y: G * (s + mu * c) });
      top = Math.max(top, G * (s + mu * c));
    }
    return { down: d, up: u, yMax: ceil4(top) };
  }, [mu]);
  const a0 = deg(Math.atan(mu));
  return (
    <TimeGraph
      title={L.graph.title}
      series={[
        { id: 'down', label: L.graph.down, color: '#fb923c', points: down, dot: false },
        { id: 'up', label: L.graph.up, color: '#fdba74', points: up, dash: '6 5', dot: false },
        { id: 'now', label: L.graph.now, color: '#ffffff', points: [{ x: alpha, y: aNow }] },
      ]}
      xMax={ALPHA_MAX}
      yMax={yMax}
      xLabel={L.graph.x}
      yLabel={L.graph.y}
      marker={alpha}
      decimal={dec}
      height={268}
      onScrub={(x) => onPick(clamp(Math.round(x), ALPHA_MIN, ALPHA_MAX))}
      note={mu > 0 ? L.graph.note(fmt(a0, 1, dec)) : L.graph.noteZero}
    />
  );
}
