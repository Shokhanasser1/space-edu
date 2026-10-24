import { useMemo, useState } from 'react';
import { ArrowDownToLine, Car, ChevronsDown, FastForward, Lightbulb, Package, Pause, RotateCcw, Timer, Truck } from 'lucide-react';

import { Btn, Explain, RangeField, Readout, Segmented, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { Grid, TimeGraph, makeView } from '../kit/scene';
import {
  Chip,
  CompareBars,
  DimLine,
  Eq,
  FC,
  FlowDashes,
  ForceArrow,
  G,
  Gauge,
  Ground,
  GroupLabel,
  Hand,
  LOAD_SIZE,
  LabScene,
  Load,
  OIL,
  Panel,
  PressureArrows,
  STEEL,
  SceneRow,
  Step,
  StepsPanel,
  Sym,
  Tag,
  big,
  pickRange,
  useSmooth,
} from './HydraulicPress.parts';
import { LOADS } from './HydraulicPress.press';

/**
 * Tab 2 — distance and work, then a hydraulic jack.
 * One stroke of the small piston pushes the oil volume V = S₁·h₁ into the
 * large cylinder, which rises by h₂ = V / S₂ (h₁S₁ = h₂S₂): the small piston
 * travels far, the large one a little. The hand needs only F₁ = mg·S₁/S₂
 * (the oil pressure is set by the load: p = mg/S₂), so the work is the same:
 * F₁h₁ = mg·h₂ — the golden rule. A jack repeats the stroke: on the way down
 * valve 2 opens and valve 1 closes (oil into the large cylinder, both gauges
 * equal); on the way up valve 1 opens (oil sucked from the reservoir) and
 * valve 2 holds the load. The release valve lets the oil back to lower it.
 * Preset: S₁ = 2 cm², S₂ = 200 cm², h₁ = 20 cm, car 1000 kg:
 *   V = 40 cm³, h₂ = 0.2 cm, N = 10 cm / 0.2 cm = 50 strokes,
 *   p = 9800 N / 0.02 m² = 490 kPa, F₁ = 98 N,
 *   A₁ = 98 N·0.20 m = 19.6 J = A₂ = 9800 N·0.002 m per stroke.
 * Pumping by hand takes about 1 s per stroke (real time); the automatic
 * pump is sped up and the chip says by how much.
 */

const GOAL = 10; // cm
const RAM_MAX = 12; // cm, full extension of the large piston
const STROKE_T = 1; // s per stroke, real time
const LOWER_V = 2; // cm/s while the release valve is open
const S_RES = 1500; // cm², cross-section of the reservoir
const F_HAND_MAX = 500; // N, the most a person can push with
const LOAD_ICONS = { crate: Package, car: Car, truck: Truck };
const IDLE = { n: 0, phase: 0, mode: 'idle', H: 0, target: 0 };

/* drawing, in cm (y up, floor at 0) */
const RX0 = 0; // reservoir outer left
const RX1 = 22; // reservoir outer right
const RWT = 1;
const RY0 = 8.5; // reservoir inner bottom
const RTOP = 37;
const LRES0 = 31; // oil level in the reservoir at the start
const XP = 32; // pump axis
const YP_TOP = 36; // pump cylinder top
const YPL0 = 32.5; // pump piston bottom at rest
const PT = 2.5;
const ROD = 22; // rod above the pump piston (still sticks out at the bottom of a 20 cm stroke)
const CAP = 0.9;
const XL = 66; // large cylinder axis
const YL_TOP = 33;
const Y_STOP = 14;
const STOP_H = 1.5;
const STOP_W = 0.8;
const CLR = 0.15;
const RAM_H = 24;
const PLAT_H = 2;
const BOT = 8.5; // inner bottom of both cylinders
const WT = 1.2;
const PY0 = 9.5; // feed channels (inner)
const PY1 = 12;
const PW = 0.8;
const RY_0 = 4.4; // return line (inner)
const RY_1 = 6;
const XV1 = 25.2; // seat of valve 1 (reservoir → pump)
const XV2 = 45; // seat of valve 2 (pump → large cylinder)
const XTEE = 40; // tee to the pump gauge
const XREL = 47; // release valve
const XRET = 10; // the return line rises into the reservoir here
const XRULER = 95.8;
const BOX = { x0: -3, x1: 104, y0: -1.5, y1: 80 };
const PAD_W = { l: 12, r: 12, t: 14, b: 12 };
const PAD_N = { l: 8, r: 8, t: 40, b: 10 };

const ease = (u) => (1 - Math.cos(Math.PI * clamp(u, 0, 1))) / 2;
/** Share of this stroke's oil already pushed (0 → 1 on the way down, stays 1 on the way up). */
const pushed = (phase) => (phase < 0.5 ? ease(phase / 0.5) : 1);
/** Travel of the pump piston as a share of h₁. */
const travel = (phase) => (phase < 0.5 ? ease(phase / 0.5) : 1 - ease((phase - 0.5) / 0.5));

function jackPhysics(S1, S2, h1, m) {
  const mg = m * G;
  const V = S1 * h1; // cm³
  const h2 = V / S2; // cm
  const N = Math.ceil(GOAL / h2 - 1e-9);
  const nMax = Math.floor(RAM_MAX / h2 + 1e-9);
  const F1 = (mg * S1) / S2;
  const p = (mg / S2) * 10; // kPa
  const rate = clamp(Math.ceil(N / 10), 1, 10); // strokes per second of the automatic pump
  return { mg, V, h2, N, nMax, F1, p, rate, gain: S2 / S1, A1: F1 * (h1 / 100), A2: mg * (h2 / 100) };
}

function stepJack(p, dt, ph) {
  if (p.mode === 'lower') {
    const H = Math.max(0, p.H - LOWER_V * dt);
    return H <= 0 ? IDLE : { ...p, H };
  }
  if (p.mode !== 'stroke' && p.mode !== 'auto') return p;
  let phase = p.phase + dt * (p.mode === 'auto' ? ph.rate : 1 / STROKE_T);
  let { n, mode } = p;
  while (phase >= 1) {
    phase -= 1;
    n += 1;
    if (mode === 'stroke' || n >= p.target || n + 1 > ph.nMax) {
      phase = 0;
      mode = 'idle';
      break;
    }
  }
  return { ...p, n, phase, mode, H: (n + (mode === 'idle' ? 0 : pushed(phase))) * ph.h2 };
}

/* ==================================================================== sim */

export default function JackSim({ T }) {
  const L = T.jack;
  const dec = T.decimal;
  const [S1, setS1] = useState(2);
  const [S2, setS2] = useState(200);
  const [h1, setH1] = useState(20);
  const [load, setLoad] = useState('car');
  const [sim, setSim] = useState(IDLE);

  const ph = useMemo(() => jackPhysics(S1, S2, h1, LOADS[load]), [S1, S2, h1, load]);
  const heavy = ph.F1 > F_HAND_MAX;
  const busy = sim.mode !== 'idle';
  const canPump = !heavy && sim.n + 1 <= ph.nMax;

  useRafLoop(busy, (dt) => setSim((p) => stepJack(p, dt, ph)));

  const change = (fn) => (v) => {
    fn(v);
    setSim(IDLE);
  };
  const oneStroke = () => setSim((p) => (p.mode === 'idle' && canPump ? { ...p, mode: 'stroke', phase: 0, target: p.n + 1 } : p));
  const toggleAuto = () =>
    setSim((p) => {
      if (p.mode === 'auto') return { ...p, mode: 'stroke' }; // finish this stroke, then stop
      if (p.mode !== 'idle' || !canPump) return p;
      return { ...p, mode: 'auto', phase: 0, target: p.n < ph.N ? ph.N : ph.nMax };
    });
  const lower = () => setSim((p) => (p.mode === 'idle' && p.H > 0 ? { ...p, mode: 'lower' } : p));
  const reset = () => setSim(IDLE);

  /* ---- live values */
  const stroking = sim.mode === 'stroke' || sim.mode === 'auto';
  const downNow = stroking && sim.phase > 0 && sim.phase < 0.5;
  const upNow = stroking && sim.phase >= 0.5;
  const pPump = useSmooth(downNow ? ph.p : 0, 0.06);
  const pRam = useSmooth(sim.H > 1e-9 || downNow ? ph.p : 0, 0.06);
  const pRange = pickRange(ph.p, [100, 250, 500, 1000, 2500, 5000, 10000]);
  const A2now = ph.mg * (sim.H / 100);
  const A1now = ph.F1 * (h1 / 100) * (sim.H / ph.h2);

  const F2 = (v) => fmt(v, 2, dec);
  const B = (v) => big(v, 0, dec);
  const J1 = (v) => big(v, 1, dec);

  /* ---- explanation */
  let key;
  if (heavy) key = 'heavy';
  else if (sim.mode === 'lower') key = 'lower';
  else if (sim.mode === 'auto') key = 'auto';
  else if (sim.mode === 'stroke') key = sim.phase < 0.5 ? 'down' : 'up';
  else if (sim.n === 0) key = 'intro';
  else if (sim.n + 1 > ph.nMax) key = 'max';
  else if (sim.n >= ph.N) key = 'goal';
  else if (sim.n === 1) key = 'first';
  else key = 'progress';
  const settled = useSettled(key, key === 'down' || key === 'up' ? 120 : 200);
  const ex = L.explain;
  const text = {
    intro: ex.intro,
    heavy: ex.heavy(B(ph.F1)),
    lower: ex.lower,
    auto: ex.auto(sim.n, ph.N, F2(sim.H), F2(ph.h2)),
    down: ex.down(B(ph.V), B(ph.p)),
    up: ex.up,
    first: ex.first(fmt(h1, 0, dec), F2(ph.h2), J1(ph.A1)),
    progress: ex.progress(sim.n, F2(sim.H), ph.N, Math.max(0, ph.N - sim.n)),
    goal: ex.goal(sim.n, F2(sim.H), J1(A1now), J1(A2now)),
    max: ex.max(fmt(RAM_MAX, 0, dec)),
  }[settled];
  const tone = {
    intro: '#22d3ee',
    heavy: '#f87171',
    lower: '#fbbf24',
    auto: '#a78bfa',
    down: '#60a5fa',
    up: '#fbbf24',
    first: '#f472b6',
    progress: '#a78bfa',
    goal: '#34d399',
    max: '#34d399',
  }[settled];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.loadLabel}</GroupLabel>
          <Segmented
            label={L.loadLabel}
            className="grid-cols-3"
            size="lg"
            value={load}
            onChange={change(setLoad)}
            accent="#f87171"
            options={Object.keys(LOADS).map((id) => ({ value: id, label: T.loads[id], sub: `${B(LOADS[id])} ${T.kg}`, icon: LOAD_ICONS[id] }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:flex">
          <Btn variant="primary" icon={ArrowDownToLine} onClick={oneStroke} disabled={busy || !canPump} className="min-h-[52px] text-[15px]">
            {L.one}
          </Btn>
          <Btn icon={sim.mode === 'auto' ? Pause : FastForward} onClick={toggleAuto} disabled={sim.mode !== 'auto' && (busy || !canPump)} className="min-h-[52px] text-[15px]">
            {sim.mode === 'auto' ? L.stop : L.auto}
          </Btn>
          <Btn icon={ChevronsDown} onClick={lower} disabled={busy || sim.H <= 0} className="min-h-[52px] text-[15px]">
            {L.lower}
          </Btn>
          <Btn icon={RotateCcw} onClick={reset} disabled={!busy && sim.H === 0 && sim.n === 0} className="min-h-[52px] text-[15px]">
            {T.common.reset}
          </Btn>
        </div>
      </div>

      <SceneRow
        min={500}
        under={
          <Explain icon={Lightbulb} id={settled} tone={tone}>
            <Sym>{text}</Sym>
          </Explain>
        }
        renderScene={(fitH) => (
          <JackScene T={T} S1={S1} S2={S2} h1={h1} load={load} sim={sim} ph={ph} pPump={pPump} pRam={pRam} pRange={pRange} downNow={downNow} upNow={upNow} fitH={fitH} />
        )}
        side={<JackSteps T={T} S1={S1} S2={S2} h1={h1} ph={ph} />}
      />

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.n} symbol="n" value={String(sim.n)} accent="#a78bfa" textColor="#c4b5fd" active={stroking} sub={L.nSub(ph.N)} />
        <Readout label={L.readouts.H} symbol="H" value={F2(sim.H)} unit={T.cm} accent={FC.f2} textColor={FC.f2Text} active={stroking || sim.mode === 'lower'} sub={L.HSub(F2(ph.h2), fmt(h1, 0, dec))} />
        <Readout label={L.readouts.F1} symbol="F₁" value={big(ph.F1, ph.F1 < 100 ? 1 : 0, dec)} unit={T.N} accent={FC.f1} textColor={heavy ? '#fca5a5' : FC.f1Text} sub={L.F1Sub(B(ph.p), B(ph.mg))} />
        <Readout label={L.readouts.work} symbol={<Sym>{L.workSym}</Sym>} accent={FC.work}>
          <CompareBars
            max={ph.mg * (GOAL / 100)}
            rows={[
              { label: L.a1, value: A1now, color: FC.f1Text, text: `${J1(A1now)} ${T.J}` },
              { label: L.a2, value: A2now, color: '#93c5fd', text: `${J1(A2now)} ${T.J}` },
            ]}
          />
          <p className="mt-2 text-xs text-gray-400">
            <Sym>{L.workSub}</Sym>
          </p>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField
            id="hp-jk-s1"
            label={L.S1}
            symbol="S₁"
            min={1}
            max={20}
            step={1}
            value={S1}
            onChange={change(setS1)}
            accent={FC.f1}
            display={`${S1} ${T.cm2}`}
            hint={L.S1Hint(fmt(2 * Math.sqrt(S1 / Math.PI), 1, dec))}
          />
          <RangeField
            id="hp-jk-s2"
            label={L.S2}
            symbol="S₂"
            min={50}
            max={500}
            step={10}
            value={S2}
            onChange={change(setS2)}
            accent={FC.f2}
            display={`${S2} ${T.cm2}`}
            hint={L.S2Hint(fmt(2 * Math.sqrt(S2 / Math.PI), 1, dec))}
          />
          <RangeField
            id="hp-jk-h1"
            label={L.h1}
            symbol="h₁"
            min={5}
            max={20}
            step={1}
            value={h1}
            onChange={change(setH1)}
            accent={FC.f1}
            display={`${h1} ${T.cm}`}
            hint={L.h1Hint(B(ph.V), F2(ph.h2))}
          />
        </Panel>
        <Panel className="lg:col-span-3">
          <LiftGraph T={T} ph={ph} sim={sim} />
        </Panel>
      </div>
    </div>
  );
}

/* ================================================================= scene */

function JackScene({ T, S1, S2, h1, load, sim, ph, pPump, pRam, pRange, downNow, upNow, fitH }) {
  const L = T.jack;
  const dec = T.decimal;
  const stroking = sim.mode === 'stroke' || sim.mode === 'auto';
  const s = stroking ? h1 * travel(sim.phase) : 0;
  const H = sim.H;
  const lowering = sim.mode === 'lower';
  const lres = LRES0 - (S2 * H) / S_RES;
  const t = performance.now() / 1000;

  return (
    <LabScene
      defs={
        <linearGradient id="hp-ram2" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#8b9bb0" />
          <stop offset="0.45" stopColor="#e5ebf2" />
          <stop offset="1" stopColor="#8b9bb0" />
        </linearGradient>
      }
      legend={[
        { color: FC.f1, label: L.legend.f1, kind: 'arrow' },
        { color: FC.f2, label: L.legend.f2, kind: 'arrow' },
        { color: FC.p, label: L.legend.p, kind: 'arrows' },
        { color: OIL.fill, label: L.legend.oil, kind: 'box' },
        { color: '#0f172a', label: L.legend.v1, kind: 'num', mark: '1' },
        { color: '#0f172a', label: L.legend.v2, kind: 'num', mark: '2' },
      ]}
      legendBelow
      chips={
        <Chip icon={Timer} color="#0891b2">
          {sim.mode === 'auto' && ph.rate > 1 ? L.chipFast(ph.rate) : L.chipReal}
        </Chip>
      }
      height={(W, narrow) => fitH ?? (narrow ? Math.round(((W - 16) / (BOX.x1 - BOX.x0)) * (BOX.y1 - BOX.y0) + 52) : 540)}
      ariaLabel={L.sceneLabel(sim.n, fmt(H, 2, dec), fmt(ph.h2, 2, dec), big(ph.F1, 0, dec))}
    >
      {(W, Hpx, narrow) => {
        const pad = narrow ? PAD_N : PAD_W;
        const view = makeView(BOX, W, Hpx, pad);
        const k = view.k;
        const { sx, sy } = view;
        const fs = narrow ? 10.5 : 12;
        const box = { w: W, h: Hpx };
        const r1 = Math.sqrt(S1 / Math.PI);
        const r2 = Math.sqrt(S2 / Math.PI);
        const r1v = Math.max(r1, 3.2 / k);
        const R = (x0, y0, x1, y1, props) => <rect x={sx(x0)} y={sy(y1)} width={Math.max(0, (x1 - x0) * k)} height={Math.max(0, (y1 - y0) * k)} {...props} />;
        const P = (x, y) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`;
        const yb = YPL0 - s; // pump piston bottom
        const yr = Y_STOP + H; // large piston bottom
        const pyc = (PY0 + PY1) / 2;
        const ryc = (RY_0 + RY_1) / 2;
        const chanW = (PY1 - PY0) * k;
        const retW = (RY_1 - RY_0) * k;

        /* pipes as thick lines: steel, then oil */
        const pipe = (d, w, key) => (
          <g key={key}>
            <path d={d} fill="none" stroke={STEEL.body} strokeWidth={w + 2 * PW * k} strokeLinejoin="miter" />
            <path d={d} fill="none" stroke={STEEL.dark} strokeWidth={w + 2 * PW * k} strokeLinejoin="miter" strokeOpacity="0.35" />
            <path d={d} fill="none" stroke={STEEL.body} strokeWidth={w + 2 * PW * k - 2.4} strokeLinejoin="miter" />
            <path d={d} fill="none" stroke={OIL.fill} strokeWidth={w} strokeLinejoin="miter" />
          </g>
        );
        const dIn = `M${P(RX1 - RWT - 0.2, pyc)} L${P(XP, pyc)}`;
        const dOut = `M${P(XP, pyc)} L${P(XL, pyc)}`;
        const gauge1 = { x: sx(XTEE), y: sy(23) };
        const rG = narrow ? clamp(3.4 * k, 13, 17) : clamp(4 * k, 19, 25);
        const gauge2 = { x: Math.min(W - rG - 6, sx(XL + r2 + WT) + 10 + rG), y: sy(pyc) };
        const dTee = `M${P(XTEE, pyc)} L${sx(XTEE).toFixed(1)},${(gauge1.y + rG).toFixed(1)}`;
        const dRet = `M${P(XL, BOT - 0.1)} L${P(XL, ryc)} L${P(XRET, ryc)} L${P(XRET, RY0 + 0.1)}`;

        /* forces to one scale; F₁ enlarged by a power of ten when tiny */
        const Lref = narrow ? 46 : clamp(Hpx * 0.15, 56, 80);
        const kF = Lref / ph.mg;
        let M = 1;
        while (ph.F1 * kF * M < 24 && M < 1000) M *= 10;
        if (ph.F1 * kF * M > 92 && M > 1) M /= 10;
        const lenF1 = ph.F1 * kF * M;

        const lp = (narrow ? 0.72 : 1) * Math.min(28, (34 * Math.max(pPump, pRam)) / pRange);
        const lpPump = pRam > 0 ? (lp * pPump) / Math.max(pPump, pRam) : 0;
        const lpRam = pRam > 0 ? (lp * pRam) / Math.max(pPump, pRam) : 0;

        const capTop = yb + PT + ROD + CAP;
        const handY = sy(capTop) - (downNow ? 0 : 6);
        const hs = narrow ? 0.72 : 1;
        const handTop = handY - 34 * hs;

        const plw = Math.max(LOAD_SIZE[load].w + 6, 2 * r2 + 4);
        const ybLoad = yr + RAM_H + PLAT_H;
        const ball = (seat, open) => {
          const rb = (PY1 - PY0) / 2 - 0.2;
          const cx = seat + 0.95 + (open ? 1.25 : 0);
          return (
            <g>
              <path d={`M${P(seat - 0.3, PY1)} L${P(seat + 0.3, PY1)} L${P(seat, PY1 - 0.62)} Z M${P(seat - 0.3, PY0)} L${P(seat + 0.3, PY0)} L${P(seat, PY0 + 0.62)} Z`} fill={STEEL.edge} />
              <circle cx={sx(cx)} cy={sy(pyc)} r={Math.max(3, rb * k)} fill="#1e293b" />
              <circle cx={sx(cx) - rb * k * 0.3} cy={sy(pyc) - rb * k * 0.3} r={Math.max(1, rb * k * 0.28)} fill="#94a3b8" />
            </g>
          );
        };
        const badge = (x, y, n, on) => (
          <g pointerEvents="none">
            <circle cx={x} cy={y} r={narrow ? 7 : 8.5} fill={on ? '#059669' : '#0f172a'} stroke="#fff" strokeWidth="1.5" />
            <text x={x} y={y + (narrow ? 3.5 : 4)} textAnchor="middle" fontSize={narrow ? 9.5 : 11} fontWeight="800" fill="#fff">
              {n}
            </text>
          </g>
        );
        const ripple = upNow ? Math.sin(t * 9) * 1.3 : 0;

        return (
          <>
            <Grid view={view} W={W} H={Hpx} minPx={26} />
            <Ground W={W} y={sy(0)} depth={Hpx - sy(0)} />

            {/* stands */}
            <g fill={STEEL.mid}>
              {R(RX0 + 1, 0, RX0 + 3, RY0 - RWT)}
              {R(RX1 - 3, 0, RX1 - 1, RY0 - RWT)}
              {R(XP - r1v - PW - 1.5, 0, XP + r1v + PW + 1.5, BOT - PW)}
              {R(XL - r2 - WT - 1.5, 0, XL + r2 + WT + 1.5, BOT - WT)}
            </g>

            {/* vessel bodies */}
            <g fill={STEEL.body}>
              {R(RX0, RY0 - RWT, RX1, RTOP)}
              {R(XP - r1v - PW, BOT - PW, XP + r1v + PW, YP_TOP)}
              {R(XL - r2 - WT, BOT - WT, XL + r2 + WT, YL_TOP)}
            </g>

            {/* pipes: feed, tee to gauge 1, return */}
            {pipe(dRet, retW, 'ret')}
            {pipe(dIn, chanW, 'in')}
            {pipe(dOut, chanW, 'out')}
            {pipe(dTee, Math.max(3, 0.9 * k), 'tee')}

            {/* insides: reservoir, pump, large cylinder */}
            {R(RX0 + RWT, RY0, RX1 - RWT, RTOP, { fill: '#f8fafc' })}
            {R(RX0 + RWT, RY0, RX1 - RWT, lres, { fill: OIL.fill })}
            <path
              d={`M${P(RX0 + RWT, lres)} Q${sx(RX0 + 6)},${sy(lres) - ripple} ${sx(RX0 + 11)},${sy(lres)} T${P(RX1 - RWT, lres)}`}
              fill="none"
              stroke={OIL.edge}
              strokeWidth="1.8"
            />
            {R(XP - r1v, BOT, XP + r1v, YP_TOP, { fill: '#f8fafc' })}
            {R(XP - r1v, BOT, XP + r1v, yb, { fill: OIL.fill })}
            {R(XL - r2, BOT, XL + r2, YL_TOP, { fill: OIL.fill })}

            {/* outlines, open at the top */}
            <path
              d={`M${P(RX0 + RWT, RTOP)} L${P(RX0, RTOP)} L${P(RX0, RY0 - RWT)} L${P(RX1, RY0 - RWT)} L${P(RX1, RTOP)} L${P(RX1 - RWT, RTOP)} L${P(RX1 - RWT, RY0)} L${P(RX0 + RWT, RY0)} Z`}
              fill="none"
              stroke={STEEL.edge}
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path
              d={`M${P(XP - r1v, YP_TOP)} L${P(XP - r1v - PW, YP_TOP)} L${P(XP - r1v - PW, BOT - PW)} L${P(XP + r1v + PW, BOT - PW)} L${P(XP + r1v + PW, YP_TOP)} L${P(XP + r1v, YP_TOP)}`}
              fill="none"
              stroke={STEEL.edge}
              strokeWidth="1.4"
            />
            <path
              d={`M${P(XL - r2, YL_TOP)} L${P(XL - r2 - WT, YL_TOP)} L${P(XL - r2 - WT, BOT - WT)} L${P(XL + r2 + WT, BOT - WT)} L${P(XL + r2 + WT, YL_TOP)} L${P(XL + r2, YL_TOP)}`}
              fill="none"
              stroke={STEEL.edge}
              strokeWidth="1.4"
            />
            <g fill={STEEL.dark}>
              {R(XL - r2, Y_STOP - STOP_H, XL - r2 + STOP_W, Y_STOP)}
              {R(XL + r2 - STOP_W, Y_STOP - STOP_H, XL + r2, Y_STOP)}
            </g>

            {/* valves */}
            {ball(XV1, upNow)}
            {ball(XV2, downNow)}
            {badge(sx(XV1 + 1.2), sy(PY1 + PW) - (narrow ? 11 : 14), 1, upNow)}
            {badge(sx(XV2 + 1.2), sy(PY1 + PW) - (narrow ? 11 : 14), 2, downNow)}
            <g pointerEvents="none">
              <circle cx={sx(XREL)} cy={sy(ryc)} r={Math.max(5, 1.6 * k)} fill={lowering ? '#bbf7d0' : '#fecaca'} stroke={STEEL.edge} strokeWidth="1.5" />
              <line x1={sx(XREL)} x2={sx(XREL)} y1={sy(ryc) - Math.max(5, 1.6 * k)} y2={sy(ryc + 2.1)} stroke={STEEL.edge} strokeWidth="2" />
              {lowering ? (
                <circle cx={sx(XREL)} cy={sy(ryc + 2.1)} r={3} fill={STEEL.edge} />
              ) : (
                <line x1={sx(XREL - 1.6)} x2={sx(XREL + 1.6)} y1={sy(ryc + 2.1)} y2={sy(ryc + 2.1)} stroke={STEEL.edge} strokeWidth="3" strokeLinecap="round" />
              )}
              <text x={sx(XREL)} y={Math.min(sy(0) - 3, sy(RY_0 - PW) + fs)} textAnchor="middle" fontSize={fs - 2} fontWeight="600" fill="#475569" stroke="#fbfcfe" strokeWidth="3" paintOrder="stroke">
                {L.releaseTag}
              </text>
            </g>

            {/* flowing oil */}
            <FlowDashes d={`M${P(RX1 - RWT - 3, pyc)} L${P(XP, pyc)} L${P(XP, Math.max(BOT + 0.5, yb - 1))}`} phase={t} active={upNow} speed={60} />
            <FlowDashes d={`M${P(XP, Math.max(BOT + 0.5, yb - 1))} L${P(XP, pyc)} L${P(XL, pyc)} L${P(XL, Math.max(pyc, yr - 1))}`} phase={t} active={downNow} speed={60} />
            <FlowDashes d={`M${P(XL, Math.max(pyc, yr - 1))} L${P(XL, ryc)} L${P(XRET, ryc)} L${P(XRET, lres - 1)}`} phase={t} active={lowering} speed={60} />

            {/* pressure: equal arrows under both pistons while valve 2 is open */}
            <PressureArrows a={sx(XP - r1v) + 1} b={sx(XP + r1v) - 1} at={sy(yb)} dir="up" len={lpPump} spacing={16} />
            <PressureArrows a={sx(XL - r2 + STOP_W) + 3} b={sx(XL + r2 - STOP_W) - 3} at={sy(yr)} dir="up" len={lpRam} spacing={16} />

            {/* the pump piston, rod, plate and the hand */}
            {R(XP - r1v + 0.04, yb, XP + r1v - 0.04, yb + PT, { fill: STEEL.mid, stroke: STEEL.edge, strokeWidth: 1.2 })}
            {R(XP - Math.max(r1v * 0.45, 1.6 / k), yb + PT, XP + Math.max(r1v * 0.45, 1.6 / k), yb + PT + ROD, { fill: STEEL.ram, stroke: STEEL.edge, strokeWidth: 1 })}
            {R(XP - Math.max(r1v + 0.7, 7 / k), yb + PT + ROD, XP + Math.max(r1v + 0.7, 7 / k), capTop, { fill: STEEL.dark, stroke: STEEL.edge, strokeWidth: 1, rx: 2 })}
            <Hand x={sx(XP)} y={handY} s={hs} pressing={downNow} />

            {/* the large piston, platform, load */}
            {R(XL - r2 + CLR, yr, XL + r2 - CLR, yr + RAM_H, { fill: 'url(#hp-ram2)', stroke: STEEL.edge, strokeWidth: 1.4 })}
            {R(XL - plw / 2, yr + RAM_H, XL + plw / 2, ybLoad, { fill: '#475569', stroke: '#1e293b', strokeWidth: 1, rx: 2 })}
            <Load kind={load} cx={sx(XL)} yb={sy(ybLoad)} k={k} label={L.massTag(big(LOADS[load], 0, dec))} fs={fs - 1} />

            {/* gauges */}
            <Gauge x={gauge1.x} y={gauge1.y} r={rG} value={pPump} max={pRange} unit={T.kPa} label="p₁" decimal={dec} fs={fs - 1} />
            <line x1={gauge2.x - rG} x2={sx(XL + r2 + WT) - 1} y1={gauge2.y} y2={gauge2.y} stroke={STEEL.dark} strokeWidth="6" />
            <line x1={gauge2.x - rG} x2={sx(XL + r2)} y1={gauge2.y} y2={gauge2.y} stroke={OIL.fill} strokeWidth="2.4" />
            <Gauge x={gauge2.x} y={gauge2.y} r={rG} value={pRam} max={pRange} unit={T.kPa} label="p₂" decimal={dec} fs={fs - 1} />

            {/* labels */}
            <text x={sx((RX0 + RX1) / 2)} y={sy(RTOP) - 6} textAnchor="middle" fontSize={fs - 1} fontWeight="700" fill={OIL.dark}>
              {L.resTag}
            </text>
            {!narrow && <Tag x={sx(XP - r1v - PW) - 6} y={sy(YP_TOP + 1.6)} text={L.s1Tag(S1)} color={FC.f1} anchor="end" fs={fs - 1} box={box} />}
            {!narrow && <Tag x={sx(XL - r2 - WT) - 6} y={sy(31)} text={L.s2Tag(S2)} color={FC.f2} anchor="end" fs={fs - 1} box={box} />}

            {/* travel of the pump piston */}
            <line x1={sx(XP - r1v - PW) - 18} x2={sx(XP - r1v)} y1={sy(YPL0)} y2={sy(YPL0)} stroke={FC.f1} strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
            <line x1={sx(XP - r1v - PW) - 18} x2={sx(XP - r1v)} y1={sy(YPL0 - h1)} y2={sy(YPL0 - h1)} stroke={FC.f1} strokeWidth="1" strokeDasharray="2 4" opacity="0.45" />
            {s > 0.3 && <DimLine p1={{ x: sx(XP - r1v - PW) - 12, y: sy(YPL0) }} p2={{ x: sx(XP - r1v - PW) - 12, y: sy(yb) }} color={FC.f1} label={s > 2 ? L.h1Tag(fmt(s, 1, dec)) : null} fs={fs - 1} box={box} />}

            {/* the ruler: how high the load is, and the 10 cm goal */}
            <Ruler x={sx(XRULER)} y0={sy(Y_STOP + RAM_H + PLAT_H)} k={k} H={H} fs={fs} L={L} dec={dec} narrow={narrow} />
            <line x1={sx(XL + plw / 2)} x2={sx(XRULER) - 2} y1={sy(ybLoad)} y2={sy(ybLoad)} stroke={FC.f2} strokeWidth="1" strokeDasharray="3 3" />

            {/* forces */}
            {(H > 1e-9 || downNow) && (
              <ForceArrow
                x={sx(XL) - Math.min(13, r2 * k * 0.36)}
                y={sy(yr)}
                dx={0}
                dy={-Lref * (pRam / ph.p)}
                color={FC.f2}
                label="F₂"
                fs={fs}
                box={box}
                labelAt={{ x: sx(XL) - Math.min(13, r2 * k * 0.36) - 6, y: sy(yr) - Lref * (pRam / ph.p) + fs * 0.4, anchor: 'end' }}
              />
            )}
            {downNow && (
              <>
                <ForceArrow
                  x={sx(XP)}
                  y={handTop - 4 - lenF1}
                  dx={0}
                  dy={lenF1}
                  color={FC.f1}
                  label="F₁"
                  value={`${big(ph.F1, ph.F1 < 100 ? 1 : 0, dec)} ${T.N}`}
                  fs={fs}
                  box={box}
                  labelAt={{ x: sx(XP) + 9, y: handTop - 4 - lenF1 * 0.55, anchor: 'start' }}
                />
                {M > 1 && (
                  <text x={sx(XP) + 9} y={handTop - 4 - lenF1 * 0.55 + fs + 2} fontSize={fs - 2} fill="#9d174d" fontWeight="600" stroke="#fff" strokeWidth="3" paintOrder="stroke">
                    {T.press.magnified(M)}
                  </text>
                )}
              </>
            )}
          </>
        );
      }}
    </LabScene>
  );
}

/** A vertical ruler from the load's start height: 0 … 12 cm, the 10 cm goal in green, a marker at H. */
function Ruler({ x, y0, k, H, fs, L, dec, narrow }) {
  const marks = [];
  for (let c = 0; c <= RAM_MAX; c += 1) {
    const major = c % 5 === 0;
    marks.push(<line key={c} x1={x} x2={x + (major ? 9 : 5)} y1={y0 - c * k} y2={y0 - c * k} stroke={c === GOAL ? '#059669' : '#334155'} strokeWidth={major || c === GOAL ? 1.6 : 1} />);
    if ((major || c === GOAL) && (!narrow || c === GOAL))
      marks.push(
        <text key={`t${c}`} x={x + 12} y={y0 - c * k + 4} fontSize={fs - 2} fontWeight={c === GOAL ? 800 : 600} fill={c === GOAL ? '#059669' : '#475569'}>
          {c === GOAL && !narrow ? L.goalTag(fmt(GOAL, 0, dec)) : fmt(c, 0, dec)}
        </text>,
      );
  }
  return (
    <g pointerEvents="none">
      <line x1={x} x2={x} y1={y0} y2={y0 - RAM_MAX * k} stroke="#334155" strokeWidth="1.6" />
      <rect x={x - 3} y={y0 - H * k} width={3} height={H * k} fill={FC.f2} />
      {marks}
      <path d={`M${x - 1},${y0 - H * k} l-7,-4 l0,8 Z`} fill={FC.f2} />
    </g>
  );
}

/* ========================================================= steps panel */

function JackSteps({ T, S1, S2, h1, ph }) {
  const L = T.jack;
  const M = L.method;
  const dec = T.decimal;
  const B = (v) => big(v, 0, dec);
  const F2 = (v) => fmt(v, 2, dec);
  const sm = (v) => (Math.abs(v - Math.round(v)) < 0.005 ? B(v) : big(v, v < 10 ? 2 : 1, dec));
  return (
    <StepsPanel formula="h₁S₁ = h₂S₂" title={M.title}>
      <Step n={1} title={M.s1}>
        <Eq sym="V = S₁ · h₁" nums={`= ${S1} ${T.cm2} · ${h1} ${T.cm} =`} result={`${B(ph.V)} ${T.cm3}`} resultColor={OIL.fill} />
      </Step>
      <Step n={2} title={M.s2}>
        <Eq sym="h₂ = V / S₂" nums={`= ${B(ph.V)} ${T.cm3} / ${S2} ${T.cm2} =`} result={`${F2(ph.h2)} ${T.cm}`} resultColor={FC.f2Text} />
        <p className="mt-0.5 text-gray-400">{M.ratio(sm(h1 / ph.h2))}</p>
      </Step>
      <Step n={3} title={M.s3(fmt(GOAL, 0, dec))}>
        <Eq sym={`N = ${fmt(GOAL, 0, dec)} ${T.cm} / h₂`} nums={`= ${fmt(GOAL, 0, dec)} / ${F2(ph.h2)} ${ph.N * ph.h2 > GOAL + 1e-9 ? '≈' : '='}`} result={T.times(ph.N)} resultColor="#c4b5fd" />
      </Step>
      <Step n={4} title={M.s4}>
        <Eq sym="F₁ = mg · S₁ / S₂" nums={`= ${B(ph.mg)} · ${S1} / ${S2} =`} result={`${big(ph.F1, ph.F1 < 100 ? 1 : 0, dec)} ${T.N}`} resultColor={FC.f1Text} />
        <Eq sym={`${L.a1} = F₁ · h₁`} nums={`= ${big(ph.F1, ph.F1 < 100 ? 1 : 0, dec)} ${T.N} · ${fmt(h1 / 100, 2, dec)} ${T.m} =`} result={`${big(ph.A1, 1, dec)} ${T.J}`} resultColor={FC.f1Text} />
        <Eq sym={`${L.a2} = mg · h₂`} nums={`= ${B(ph.mg)} ${T.N} · ${fmt(ph.h2 / 100, 4, dec).replace(/0+$/, '')} ${T.m} =`} result={`${big(ph.A2, 1, dec)} ${T.J}`} resultColor="#93c5fd" />
        <p className="mt-1 text-gray-300">{M.gold(sm(ph.gain))}</p>
      </Step>
    </StepsPanel>
  );
}

/* ================================================================ graph */

function LiftGraph({ T, ph, sim }) {
  const L = T.jack;
  const dec = T.decimal;
  const xMax = Math.max(4, Math.ceil(Math.max(ph.N, sim.n + 1) / 4) * 4);
  const plan = useMemo(() => {
    const pts = [{ x: 0, y: 0 }];
    const last = Math.min(ph.nMax, xMax);
    for (let i = 0; i < last; i += 1) {
      pts.push({ x: i + 0.5, y: (i + 1) * ph.h2 });
      pts.push({ x: i + 1, y: (i + 1) * ph.h2 });
    }
    return pts;
  }, [ph.h2, ph.nMax, xMax]);
  const stroking = sim.mode === 'stroke' || sim.mode === 'auto';
  const done = [{ x: 0, y: 0 }];
  for (let i = 0; i < sim.n; i += 1) {
    done.push({ x: i + 0.5, y: (i + 1) * ph.h2 });
    done.push({ x: i + 1, y: (i + 1) * ph.h2 });
  }
  if (stroking) done.push({ x: sim.n + Math.min(sim.phase, 0.5) + Math.max(0, sim.phase - 0.5), y: sim.H });
  const lowering = sim.mode === 'lower';
  return (
    <TimeGraph
      title={L.graph.title}
      series={[
        { id: 'plan', label: L.graph.plan, color: '#64748b', points: plan, dash: '4 4', dot: false },
        { id: 'goal', label: L.graph.goal, color: '#34d399', points: [{ x: 0, y: GOAL }, { x: xMax, y: GOAL }], dash: '6 5', dot: false },
        { id: 'done', label: L.graph.done, color: '#a78bfa', points: lowering ? [{ x: 0, y: 0 }] : done, dot: !lowering },
      ]}
      xMax={xMax}
      yMax={RAM_MAX}
      xLabel={L.graph.x}
      yLabel={L.graph.y}
      marker={lowering ? undefined : sim.n + (stroking ? sim.phase : 0)}
      decimal={dec}
      height={250}
      note={L.graph.note(fmt(ph.h2, 2, dec))}
    />
  );
}
