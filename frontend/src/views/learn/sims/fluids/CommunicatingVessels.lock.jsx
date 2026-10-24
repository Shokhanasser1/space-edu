import { useState } from 'react';
import { Check, FastForward, Lightbulb, MoveVertical, RotateCcw, Ship, StepForward, Timer } from 'lucide-react';

import { Arrow, Btn, Explain, Readout, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { TimeGraph } from '../kit/scene';
import { CV, Chip, DimLine, G, LIQ, LabScene, Panel, PressureArrow, SceneRow, SurfaceLine, Sym, SymPill, Valve, surfacePoints } from './CommunicatingVessels.parts';

/**
 * Tab 3 — a ship lock (shlyuz) worked step by step: a boat goes upstream from
 * the lower reach (water 4 m above the chamber floor) to the upper reach
 * (12 m). Opening a valve joins the chamber to one reach — the two become
 * communicating vessels and the water flows until the levels are equal;
 * only then can the gate be opened, because before that the water presses
 * on it much harder from one side.
 *
 * Model (SI): chamber 60 m × 12 m (A = 720 m²); each valve is a culvert of
 * S = 2.5 m² with discharge coefficient μ = 0.6, so Q = μS√(2gΔh) and
 * dh/dt = ±Q/A (Torricelli). From Δh = 8 m: Q₀ = 0.6·2.5·√(2·9.8·8) ≈ 18.8 m³/s
 * and the levels meet after t = 2A√Δh/(μS√(2g)) ≈ 613 s ≈ 10.2 min.
 * Gate (12 m wide) with water on both sides: Δp at the bottom = ρgΔh, net force
 * F = ρgW(D₁² − D₂²)/2 — e.g. 7.53 MN on the lower gate with the chamber full.
 * Shown sped up: ×60 while water flows, ×15 for the gates and the boat.
 */

const Y_LOW = 4; // lower reach level above the chamber floor, m
const Y_UP = 12; // upper reach level, m
const SILL = 3; // upper reach bed / upper gate sill, m
const TOP = 14; // top of the lock walls and gates
const XG_L0 = 34; // lower gate
const XG_L1 = 35.5;
const XG_U0 = 95.5; // upper gate
const XG_U1 = 97;
const X_END = 132;
const A_CH = 60 * 12; // chamber area, m²
const S_V = 2.5; // culvert area, m²
const MU = 0.6;
const W_GATE = 12; // gate width, m
const GATE_T = 60; // s to lower or raise a gate
const V_BOAT = 0.8; // m/s
const BOAT = { L: 24, draft: 1.6, start: 14, mid: 65.5, end: 116 };
const STEPS = ['lowValve', 'lowGate', 'boatIn', 'closeLow', 'upValve', 'upGate', 'boatOut'];
const FLOW_STEPS = ['lowValve', 'upValve'];
const T_MAX = 28; // min on the graph
const BOX = { x0: -2, x1: X_END, y0: -3.2, y1: 16.9 };

const RHO = LIQ.water.rho;
const gateForce = (d1, d2) => (RHO * G * W_GATE * (d1 * d1 - d2 * d2)) / 2;

function initial() {
  return { phase: 0, running: false, h: Y_UP, gateL: 0, gateU: 0, valveL: false, valveU: false, boatX: BOAT.start, t: 0, Q: 0, wait: 0, flow: 0, samples: [{ t: 0, h: Y_UP }] };
}

function begin(s, n) {
  return { ...s, phase: n, running: true, wait: 0, valveL: n === 1 ? true : n === 4 ? false : s.valveL, valveU: n === 5 ? true : s.valveU };
}

function step(p, dt, auto) {
  let s = { ...p };
  if (!s.running) {
    if (auto && s.phase < STEPS.length) {
      s.wait += dt;
      if (s.wait > 0.9) s = begin(s, s.phase + 1);
    }
    return s;
  }
  const kind = STEPS[s.phase - 1];
  const scale = FLOW_STEPS.includes(kind) ? 60 : 15;
  let rem = dt * scale;
  while (rem > 1e-9 && s.running) {
    const h = Math.min(rem, 0.5);
    rem -= h;
    s.t += h;
    if (kind === 'lowValve' || kind === 'upValve') {
      const d = kind === 'lowValve' ? s.h - Y_LOW : Y_UP - s.h;
      if (d <= 0.002) {
        s.h = kind === 'lowValve' ? Y_LOW : Y_UP;
        s.Q = 0;
        s.running = false;
      } else {
        s.Q = MU * S_V * Math.sqrt(2 * G * d);
        const dh = (s.Q * h) / A_CH;
        s.h = kind === 'lowValve' ? Math.max(Y_LOW, s.h - dh) : Math.min(Y_UP, s.h + dh);
      }
    } else if (kind === 'lowGate' || kind === 'closeLow') {
      s.gateL = clamp(s.gateL + (kind === 'lowGate' ? h : -h) / GATE_T, 0, 1);
      if (s.gateL >= 1 || s.gateL <= 0) s.running = false;
    } else if (kind === 'upGate') {
      s.gateU = clamp(s.gateU + h / GATE_T, 0, 1);
      if (s.gateU >= 1) s.running = false;
    } else {
      const to = kind === 'boatIn' ? BOAT.mid : BOAT.end;
      s.boatX = Math.min(to, s.boatX + V_BOAT * h);
      if (s.boatX >= to) s.running = false;
    }
  }
  s.flow = p.flow + s.Q * dt;
  const last = s.samples[s.samples.length - 1];
  if (s.t - last.t >= 4 || (!s.running && s.t > last.t)) s.samples = [...s.samples, { t: s.t, h: s.h }];
  return s;
}

/* ==================================================================== sim */

export default function LockSim({ T }) {
  const L = T.lock;
  const dec = T.decimal;
  const [sim, setSim] = useState(initial);
  const [auto, setAuto] = useState(false);

  const done = sim.phase === STEPS.length && !sim.running;
  const active = sim.running || (auto && !done);
  useRafLoop(active, (dt) => setSim((p) => step(p, dt, auto)));

  const next = () => {
    if (sim.running) return;
    if (done) {
      setSim(initial());
      return;
    }
    setSim((p) => (p.running ? p : begin(p, p.phase + 1)));
  };
  const toggleAuto = () => {
    setAuto((a) => !a);
    if (done) setSim(initial());
  };
  const reset = () => {
    setSim(initial());
    setAuto(false);
  };

  /* ---- live values */
  const kind = STEPS[sim.phase - 1];
  const dLow = sim.h - Y_LOW;
  const dUp = Y_UP - sim.h;
  const dpLow = RHO * G * dLow;
  const dpUp = RHO * G * dUp;
  const fLow = gateForce(sim.h, Y_LOW);
  const fUp = gateForce(Y_UP - SILL, Math.max(0, sim.h - SILL));
  const scale = kind && FLOW_STEPS.includes(kind) ? 60 : kind ? 15 : 60;
  const mins = Math.floor(sim.t / 60);
  const secs = Math.floor(sim.t - mins * 60);

  /* ---- explanation */
  const key = sim.phase === 0 ? 'ready' : done ? 'done' : `${STEPS[sim.phase - 1]}-${sim.running ? 'run' : 'end'}`;
  const settled = useSettled(key, 120);
  const ex = L.explain;
  const text =
    settled === 'ready'
      ? ex.ready
      : settled === 'done'
        ? ex.done
        : settled === 'lowValve-run'
          ? ex.lowValveRun(fmt(dLow, 1, dec))
          : settled === 'upValve-run'
            ? ex.upValveRun(fmt(dUp, 1, dec))
            : ex[settled.replace('-run', 'Run').replace('-end', 'End')] ?? ex.ready;
  const tone = settled.endsWith('run') ? '#22d3ee' : settled === 'done' ? '#34d399' : settled === 'ready' ? '#fbbf24' : '#a78bfa';

  const nextLabel = sim.running ? L.busy : done ? T.common.again : L.steps[STEPS[sim.phase]].action;

  const series = [
    { id: 'up', label: L.graph.up, color: '#93c5fd', dash: '5 5', dot: false, points: [{ x: 0, y: Y_UP }, { x: T_MAX, y: Y_UP }] },
    { id: 'low', label: L.graph.low, color: '#64748b', dash: '5 5', dot: false, points: [{ x: 0, y: Y_LOW }, { x: T_MAX, y: Y_LOW }] },
    { id: 'ch', label: L.graph.chamber, color: '#3b82f6', points: sim.samples.map((q) => ({ x: q.t / 60, y: q.h })) },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Btn variant="primary" icon={done ? RotateCcw : StepForward} onClick={next} disabled={sim.running} className="min-h-[52px] text-[15px] sm:min-w-[280px] sm:flex-1 xl:flex-none">
          {nextLabel}
        </Btn>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Btn icon={FastForward} onClick={toggleAuto} aria-pressed={auto} className={`min-h-[52px] text-[15px] ${auto ? '!border-cyan-300/70 !bg-cyan-400/15' : ''}`}>
            {auto ? L.autoOn : L.auto}
          </Btn>
          <Btn icon={RotateCcw} onClick={reset} disabled={sim.phase === 0} className="min-h-[52px] text-[15px]">
            {T.common.reset}
          </Btn>
        </div>
        <p className="text-xs leading-snug text-gray-400 sm:ml-auto sm:max-w-[300px] sm:text-right">{L.toolbarHint}</p>
      </div>

      <SceneRow
        minH={430}
        maxH={540}
        sideW={340}
        renderScene={(fitH) => <LockScene T={T} sim={sim} scale={scale} mins={mins} secs={secs} fitH={fitH} />}
        under={
          <Explain icon={Lightbulb} id={settled} tone={tone}>
            <Sym>{text}</Sym>
          </Explain>
        }
        side={<Stepper T={T} sim={sim} />}
      />

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.level} symbol="h" value={fmt(sim.h, 2, dec)} unit={T.m} accent="#3b82f6" textColor="#93c5fd" active={!!kind && FLOW_STEPS.includes(kind) && sim.running} sub={L.levelSub(fmt(Y_LOW, 0, dec), fmt(Y_UP, 0, dec))} />
        <Readout
          label={L.readouts.low}
          symbol="Δp"
          value={fmt(Math.max(0, dpLow) / 1000, 1, dec)}
          unit={T.kPa}
          accent={CV.pressure}
          textColor={CV.pressureText}
          active={dpLow > 50 && sim.gateL === 0}
          sub={dLow > 0.005 ? L.force(fmt(fLow / 1e6, 2, dec)) : L.noForce}
        />
        <Readout
          label={L.readouts.up}
          symbol="Δp"
          value={fmt(Math.max(0, dpUp) / 1000, 1, dec)}
          unit={T.kPa}
          accent={CV.pressure}
          textColor={CV.pressureText}
          active={dpUp > 50 && sim.gateU === 0}
          sub={dUp > 0.005 ? L.force(fmt(fUp / 1e6, 2, dec)) : L.noForce}
        />
        <Readout label={L.readouts.q} symbol="Q" value={fmt(sim.Q, 1, dec)} unit={L.m3s} accent={CV.flow} textColor="#67e8f9" active={sim.Q > 0} sub={L.qSub} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{L.info.title}</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {L.info.items.map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] leading-tight text-gray-500">{k}</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-gray-100">
                  <Sym>{v}</Sym>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 rounded-xl bg-black/25 px-3 py-2.5 text-xs leading-snug text-gray-400">
            <Sym>{L.info.note}</Sym>
          </p>
        </Panel>
        <Panel className="lg:col-span-3">
          <TimeGraph
            title={L.graph.title}
            series={series}
            xMax={T_MAX}
            yMax={16}
            xLabel={L.graph.t}
            yLabel={L.graph.h}
            decimal={dec}
            marker={sim.t / 60}
            note={L.graph.note}
            ariaLabel={L.graph.label}
            height={190}
          />
        </Panel>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- stepper */

function Stepper({ T, sim }) {
  const L = T.lock;
  return (
    <Panel>
      <p className="flex items-center gap-2 text-sm font-semibold text-gray-100">
        <Ship size={16} className="text-cyan-300" aria-hidden="true" />
        {L.stepsTitle}
      </p>
      <ol className="mt-3 space-y-1.5">
        {STEPS.map((id, i) => {
          const n = i + 1;
          const isDone = sim.phase > n || (sim.phase === n && !sim.running);
          const now = sim.phase === n && sim.running;
          const isNext = sim.phase === n - 1 && !sim.running;
          return (
            <li
              key={id}
              className={`flex gap-2.5 rounded-xl border px-2.5 py-2 transition-colors ${
                now ? 'border-cyan-300/60 bg-cyan-400/10' : isNext ? 'border-white/20 bg-white/[0.05]' : 'border-transparent'
              }`}
              aria-current={now ? 'step' : undefined}
            >
              <span
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                  isDone ? 'bg-emerald-400/20 text-emerald-300' : now ? 'bg-cyan-400 text-slate-950' : 'bg-white/10 text-gray-400'
                }`}
                aria-hidden="true"
              >
                {isDone ? <Check size={12} strokeWidth={3} /> : n}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-[13px] font-semibold leading-tight ${isDone ? 'text-gray-300' : now || isNext ? 'text-white' : 'text-gray-400'}`}>{L.steps[id].title}</p>
                <p className="mt-0.5 text-xs leading-snug text-gray-500">
                  <Sym>{L.steps[id].desc}</Sym>
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

/* ================================================================= scene */

/** World → screen with a vertical exaggeration `e` (the lock is long and low). */
function lockView(W, H, narrow, fitH) {
  const pad = narrow ? { l: 26, r: 8, t: 34, b: 22 } : { l: 34, r: 12, t: 50, b: 26 };
  const kx = (W - pad.l - pad.r) / (BOX.x1 - BOX.x0);
  const span = BOX.y1 - BOX.y0;
  const target = fitH ?? (narrow ? W * 0.82 : 460);
  const e = clamp(Math.round((target - pad.t - pad.b) / (span * kx)), 2, 7);
  const ky = kx * e;
  return {
    e,
    kx,
    ky,
    pad,
    H: Math.round(span * ky + pad.t + pad.b),
    sx: (x) => pad.l + (x - BOX.x0) * kx,
    sy: (y) => pad.t + (BOX.y1 - y) * ky,
  };
}

function LockScene({ T, sim, scale, mins, secs, fitH }) {
  const L = T.lock;
  return (
    <LabScene
      ariaLabel={L.sceneLabel(fmt(sim.h, 1, T.decimal), STEPS[sim.phase - 1] ? L.steps[STEPS[sim.phase - 1]].title : L.steps.lowValve.title)}
      legend={[
        { kind: 'box', color: LIQ.water.edge, fill: LIQ.water.fill, label: L.legend.water },
        { kind: 'arrow', color: CV.pressure, label: L.legend.pressure },
        { kind: 'arrow', color: CV.flow, label: L.legend.flow },
        { kind: 'dash', color: CV.level, label: L.legend.level },
      ]}
      chips={(W, narrow, H) => {
        const v = lockView(W, H, narrow, fitH);
        return (
          <>
            <Chip icon={Timer}>{L.timeChip(scale, mins, secs)}</Chip>
            <Chip icon={MoveVertical} color="#7c3aed">
              {L.scaleChip(v.e)}
            </Chip>
          </>
        );
      }}
      height={(W, narrow) => lockView(W, 0, narrow, fitH).H}
    >
      {(W, H, narrow) => <LockDrawing T={T} W={W} H={H} narrow={narrow} sim={sim} fitH={fitH} />}
    </LabScene>
  );
}

function LockDrawing({ T, W, H, narrow, sim, fitH }) {
  const L = T.lock;
  const dec = T.decimal;
  const v = lockView(W, H, narrow, fitH);
  const { sx, sy, kx, ky } = v;
  const fs = narrow ? 10 : 12;
  const box = { w: W, h: H };
  const water = LIQ.water;
  const kind = STEPS[sim.phase - 1];
  const filling = sim.running && (kind === 'lowValve' || kind === 'upValve');
  const phase = sim.t * 0.25;
  const amp = filling ? clamp(sim.Q / 8, 0.6, 2.4) : 0;

  const lowGateTop = TOP - (TOP - 0) * sim.gateL;
  const upGateTop = TOP - (TOP - SILL) * sim.gateU;

  // water bodies
  const lowSurf = surfacePoints(sx(BOX.x0), sx(XG_L0), sy(Y_LOW), { amp: kind === 'lowValve' && sim.running ? amp * 0.6 : 0, phase });
  const chSurf = surfacePoints(sx(XG_L1), sx(XG_U0), sy(sim.h), { amp, phase: phase + 1 });
  const upSurf = surfacePoints(sx(XG_U1), sx(X_END), sy(Y_UP), { amp: kind === 'upValve' && sim.running ? amp * 0.4 : 0, phase: phase + 2 });

  // pressure on a closed gate: arrows at several depths on both faces
  const kP = (narrow ? 26 : 40) / (RHO * G * Y_UP);
  const gateArrows = (x0, x1, base, top, leftLevel, rightLevel) => {
    const out = [];
    for (let y = base + 0.9; y < Math.max(leftLevel, rightLevel); y += narrow ? 2.4 : 1.6) {
      if (y > top) break;
      const pl = y < leftLevel ? RHO * G * (leftLevel - y) : 0;
      const pr = y < rightLevel ? RHO * G * (rightLevel - y) : 0;
      if (pl > 0) out.push(<PressureArrow key={`l${y}`} x1={sx(x0) - pl * kP - 2} y1={sy(y)} x2={sx(x0) - 1.5} y2={sy(y)} width={narrow ? 1.6 : 2.1} head={narrow ? 5 : 7} />);
      if (pr > 0) out.push(<PressureArrow key={`r${y}`} x1={sx(x1) + pr * kP + 2} y1={sy(y)} x2={sx(x1) + 1.5} y2={sy(y)} width={narrow ? 1.6 : 2.1} head={narrow ? 5 : 7} />);
    }
    return out;
  };

  // the boat floats on the water of the body it is in
  const boatLevel = sim.boatX < (XG_L0 + XG_L1) / 2 ? Y_LOW : sim.boatX < (XG_U0 + XG_U1) / 2 ? sim.h : Y_UP;
  const boatMoving = sim.running && (kind === 'boatIn' || kind === 'boatOut');

  // culverts (world polylines)
  const cLow = [
    [41, 0],
    [41, -1.4],
    [28, -1.4],
    [28, 0],
  ];
  const cUp = [
    [103, SILL],
    [103, 1.3],
    [XG_U0, 1.3],
  ];
  const poly = (pts) => pts.map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(' ');
  const cw = Math.max(5, Math.min(10, ky * 0.9));
  const flowOn = filling;

  // Δh of the open connection
  const dimX = kind === 'upValve' || sim.valveU ? sx(XG_U0 - 11) : sx(XG_L1 + 11);
  const dh = sim.valveU ? Y_UP - sim.h : sim.h - Y_LOW;
  const showDim = (sim.valveL || sim.valveU || sim.phase === 0) && Math.abs(dh) > 0.15;
  const dimFrom = sim.valveU ? Y_UP : Y_LOW;

  return (
    <g>
      {/* metre grid */}
      <LockGrid v={v} W={W} H={H} axisX={L.axisX} axisY={L.axisY} />

      {/* back wall of the chamber and the lock heads */}
      <rect x={sx(XG_L0)} y={sy(TOP)} width={sx(XG_U1) - sx(XG_L0)} height={sy(0) - sy(TOP)} fill="#eef2f7" />
      <line x1={sx(XG_L0)} x2={sx(XG_U1)} y1={sy(TOP)} y2={sy(TOP)} stroke="#94a3b8" strokeWidth="3" />
      {/* ground and the raised bed of the upper reach */}
      <path
        d={`M${sx(BOX.x0)},${sy(0)} L${sx(XG_U0)},${sy(0)} L${sx(XG_U0)},${sy(SILL)} L${sx(X_END)},${sy(SILL)} L${sx(X_END)},${sy(BOX.y0)} L${sx(BOX.x0)},${sy(BOX.y0)} Z`}
        fill="url(#cv-concrete)"
      />
      <Hatch v={v} />
      <path d={`M${sx(BOX.x0)},${sy(0)} L${sx(XG_U0)},${sy(0)} L${sx(XG_U0)},${sy(SILL)} L${sx(X_END)},${sy(SILL)}`} fill="none" stroke="#64748b" strokeWidth="2" />

      {/* culverts */}
      <polyline points={poly(cLow)} fill="none" stroke="#64748b" strokeWidth={cw + 4} strokeLinejoin="round" />
      <polyline points={poly(cLow)} fill="none" stroke="#a5c8f7" strokeWidth={cw} strokeLinejoin="round" />
      <polyline points={poly(cUp)} fill="none" stroke="#64748b" strokeWidth={cw + 4} strokeLinejoin="round" />
      <polyline points={poly(cUp)} fill="none" stroke="#a5c8f7" strokeWidth={cw} strokeLinejoin="round" />
      {flowOn && kind === 'lowValve' && <polyline points={poly(cLow)} fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="6 8" strokeDashoffset={sim.flow * 0.35} strokeLinejoin="round" />}
      {flowOn && kind === 'upValve' && <polyline points={poly(cUp)} fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="6 8" strokeDashoffset={-sim.flow * 0.35} strokeLinejoin="round" />}

      {/* water */}
      <g opacity={water.opacity}>
        <path d={`M${sx(BOX.x0)},${sy(0)} L${lowSurf.map(([x, y]) => `${x},${y}`).join(' L')} L${sx(XG_L0)},${sy(0)} Z`} fill={water.fill} />
        <path d={`M${sx(XG_L1)},${sy(0)} L${chSurf.map(([x, y]) => `${x},${y}`).join(' L')} L${sx(XG_U0)},${sy(0)} Z`} fill={water.fill} />
        <path d={`M${sx(XG_U1)},${sy(SILL)} L${upSurf.map(([x, y]) => `${x},${y}`).join(' L')} L${sx(X_END)},${sy(SILL)} Z`} fill={water.fill} />
        {/* water above a lowered gate joins the two sides */}
        {lowGateTop < Math.min(Y_LOW, sim.h) && <rect x={sx(XG_L0)} y={sy(Math.min(Y_LOW, sim.h))} width={sx(XG_L1) - sx(XG_L0)} height={sy(lowGateTop) - sy(Math.min(Y_LOW, sim.h))} fill={water.fill} />}
        {upGateTop < Math.min(Y_UP, sim.h) && <rect x={sx(XG_U0)} y={sy(Math.min(Y_UP, sim.h))} width={sx(XG_U1) - sx(XG_U0)} height={sy(upGateTop) - sy(Math.min(Y_UP, sim.h))} fill={water.fill} />}
      </g>
      <SurfaceLine liq={water} surface={lowSurf} />
      <SurfaceLine liq={water} surface={chSurf} />
      <SurfaceLine liq={water} surface={upSurf} />

      {/* levels of the reaches */}
      <line x1={sx(BOX.x0)} x2={sx(X_END)} y1={sy(Y_LOW)} y2={sy(Y_LOW)} stroke={CV.level} strokeWidth="1.2" strokeDasharray="6 6" opacity="0.55" />
      <line x1={sx(BOX.x0)} x2={sx(X_END)} y1={sy(Y_UP)} y2={sy(Y_UP)} stroke={CV.level} strokeWidth="1.2" strokeDasharray="6 6" opacity="0.55" />
      {!narrow && (
        <>
          <SymPill x={sx(BOX.x0) + 8} y={sy(Y_LOW / 2)} anchor="start" text={L.lowTag(fmt(Y_LOW, 0, dec))} bg="#fff" color={CV.level} border={CV.level} fs={fs - 1} box={box} />
          <SymPill x={sx(X_END) - 8} y={sy((Y_UP + SILL) / 2)} anchor="end" text={L.upTag(fmt(Y_UP, 0, dec))} bg="#fff" color={CV.level} border={CV.level} fs={fs - 1} box={box} />
        </>
      )}

      {/* gates */}
      <Gate x0={sx(XG_L0)} x1={sx(XG_L1)} yBase={sy(0)} yTop={sy(lowGateTop)} />
      <Gate x0={sx(XG_U0)} x1={sx(XG_U1)} yBase={sy(SILL)} yTop={sy(upGateTop)} />
      {sim.gateL === 0 && gateArrows(XG_L0, XG_L1, 0, TOP, Y_LOW, sim.h)}
      {sim.gateU === 0 && gateArrows(XG_U0, XG_U1, SILL, TOP, sim.h, Y_UP)}
      {!narrow && (
        <>
          <text x={(sx(XG_L0) + sx(XG_L1)) / 2} y={sy(TOP) - 6} textAnchor="middle" fontSize={fs - 1} fontWeight="700" fill="#475569">
            {L.gateLow}
          </text>
          <text x={(sx(XG_U0) + sx(XG_U1)) / 2} y={sy(TOP) - 6} textAnchor="middle" fontSize={fs - 1} fontWeight="700" fill="#475569">
            {L.gateUp}
          </text>
          <text x={(sx(XG_L1) + sx(XG_U0)) / 2} y={sy(TOP) - 6} textAnchor="middle" fontSize={fs - 1} fontWeight="700" fill="#475569">
            {L.chamber}
          </text>
        </>
      )}

      {/* valves */}
      <Valve x={sx(34.75)} y={sy(-1.4)} r={narrow ? 5.5 : 8} open={sim.valveL} label={narrow ? null : L.valveLow} />
      <Valve x={sx(99.5)} y={sy(1.3)} r={narrow ? 5.5 : 8} open={sim.valveU} label={narrow ? null : L.valveUp} />

      {/* level difference across the open connection */}
      {showDim && (
        <DimLine p1={{ x: dimX, y: sy(dimFrom) }} p2={{ x: dimX, y: sy(sim.h) }} color="#ea580c" label={`Δh = ${fmt(Math.abs(dh), 1, dec)} ${T.m}`} fs={fs} box={box} />
      )}

      {/* boat */}
      <Boat x={sx(sim.boatX)} y={sy(boatLevel)} kx={kx} moving={boatMoving} t={sim.t} />

      {/* flow arrows at the culvert mouths */}
      {flowOn && kind === 'lowValve' && <Arrow x1={sx(29.5)} y1={sy(0.4)} x2={sx(24)} y2={sy(1.6)} color={CV.flow} width={2.4} head={8} />}
      {flowOn && kind === 'upValve' && <Arrow x1={sx(XG_U0 - 0.5)} y1={sy(1.3)} x2={sx(XG_U0 - 6)} y2={sy(1.3)} color={CV.flow} width={2.4} head={8} />}
    </g>
  );
}

function Gate({ x0, x1, yBase, yTop }) {
  if (yBase - yTop < 0.5) return <rect x={x0} y={yBase - 2} width={x1 - x0} height={2} fill="#334155" />;
  return (
    <g pointerEvents="none">
      <rect x={x0} y={yTop} width={x1 - x0} height={yBase - yTop} fill="#475569" stroke="#1e293b" strokeWidth="1" />
      <line x1={(x0 + x1) / 2} x2={(x0 + x1) / 2} y1={yTop + 3} y2={yBase - 3} stroke="#94a3b8" strokeWidth="1" opacity="0.6" />
    </g>
  );
}

/** A small motor ship in true proportions (both axes in kx), bow to the right. */
function Boat({ x, y, kx, moving, t }) {
  const s = kx;
  const half = (BOAT.L / 2) * s;
  const draft = BOAT.draft * s;
  const free = 1.6 * s;
  const hull = `M${x - half},${y - free} L${x + half * 0.78},${y - free} L${x + half},${y - free - 0.4 * s} L${x + half * 0.9},${y + draft * 0.4} Q${x + half * 0.7},${y + draft} ${x + half * 0.5},${y + draft} L${x - half * 0.92},${y + draft} Q${x - half},${y + draft} ${x - half},${y + draft * 0.4} Z`;
  return (
    <g pointerEvents="none">
      {moving &&
        [0, 1, 2].map((i) => {
          const off = ((t * 0.9 + i * 4) % 12) * s;
          return <path key={i} d={`M${x - half - off},${y + 1} q${-2 * s},${-1.2} ${-4 * s},0`} fill="none" stroke="#2563eb" strokeWidth="1.2" opacity={0.6 - (off / (12 * s)) * 0.5} />;
        })}
      <path d={hull} fill="#b91c1c" stroke="#7f1d1d" strokeWidth="1.2" strokeLinejoin="round" />
      <line x1={x - half} x2={x + half * 0.95} y1={y - free + 1.2 * s * 0.6} y2={y - free + 1.2 * s * 0.6} stroke="#fff" strokeWidth={Math.max(1, s * 0.25)} />
      <rect x={x - half * 0.75} y={y - free - 2.6 * s} width={half * 0.7} height={2.6 * s} rx={0.4 * s} fill="#f8fafc" stroke="#475569" strokeWidth="1" />
      <rect x={x - half * 0.68} y={y - free - 4.4 * s} width={half * 0.42} height={1.8 * s} rx={0.3 * s} fill="#f8fafc" stroke="#475569" strokeWidth="1" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={x - half * 0.7 + i * half * 0.22} y={y - free - 1.9 * s} width={half * 0.12} height={0.9 * s} fill="#38bdf8" />
      ))}
      <rect x={x - half * 0.55} y={y - free - 6.2 * s} width={0.9 * s} height={1.8 * s} fill="#334155" />
      <line x1={x + half * 0.5} x2={x + half * 0.5} y1={y - free} y2={y - free - 4 * s} stroke="#334155" strokeWidth="1.2" />
      <path d={`M${x + half * 0.5},${y - free - 4 * s} l${2.2 * s},${0.6 * s} l${-2.2 * s},${0.6 * s} Z`} fill="#22c55e" />
    </g>
  );
}

function LockGrid({ v, W, H, axisX, axisY }) {
  const lines = [];
  for (let x = 0; x <= X_END; x += 10) {
    lines.push(<line key={`x${x}`} x1={v.sx(x)} x2={v.sx(x)} y1={v.pad.t - 10} y2={H - v.pad.b} stroke="#eef2f6" strokeWidth="1" />);
  }
  for (let y = 0; y <= 14; y += 2) {
    lines.push(<line key={`y${y}`} x1={v.pad.l} x2={W - v.pad.r} y1={v.sy(y)} y2={v.sy(y)} stroke="#eef2f6" strokeWidth="1" />);
  }
  const nums = [];
  for (let y = 0; y <= 14; y += 2) {
    nums.push(
      <text key={`ny${y}`} x={v.pad.l - 6} y={v.sy(y) + 4} textAnchor="end" fontSize="10.5" fill="#64748b">
        {y}
      </text>,
    );
  }
  for (let x = 0; x <= X_END; x += 20) {
    nums.push(
      <text key={`nx${x}`} x={v.sx(x)} y={H - 7} textAnchor="middle" fontSize="10.5" fill="#64748b">
        {x}
      </text>,
    );
  }
  return (
    <g aria-hidden="true">
      {lines}
      {nums}
      <text x={v.pad.l - 4} y={v.sy(14) - 14} textAnchor="end" fontSize="10.5" fontWeight="700" fill="#475569">
        {axisY}
      </text>
      <text x={W - v.pad.r} y={H - 7} textAnchor="end" fontSize="10.5" fontWeight="700" fill="#475569">
        {axisX}
      </text>
    </g>
  );
}

function Hatch({ v }) {
  const out = [];
  const y0 = v.sy(0);
  const y1 = v.sy(BOX.y0);
  for (let x = v.sx(BOX.x0) - (y1 - y0); x < v.sx(X_END); x += 14) {
    out.push(<line key={x} x1={x} y1={y1} x2={x + (y1 - y0)} y2={y0} stroke="#aab4c0" strokeWidth="1" opacity="0.55" />);
  }
  return <g aria-hidden="true">{out}</g>;
}
