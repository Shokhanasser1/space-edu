import { useState } from 'react';
import { Bus, Globe2, MoveRight, OctagonMinus, TrendingUp } from 'lucide-react';

import { Arrow, Readout, Segmented, fmt, useRafLoop, useSettled, useTween } from '../kit/ui';
import { PALETTE, TimeGraph } from '../kit/scene';
import { Chip, GroupLabel, LabScene, LiveExplain, PlayControls, Ruler, Sym, TagPill, hash01, niceMax, num, rulerStep, tickDigits } from './NewtonFirstLaw.parts';

/**
 * Tab 3 — "Avtobusda": a smooth ball lies on the floor of a bus (friction
 * neglected) and a hand strap hangs from the ceiling. The same motion is
 * shown from the ground's frame and from the bus's frame.
 *  - Ground (inertial): nothing pushes the ball horizontally, so its velocity
 *    stays the same — its half-second marks stay equally spaced — until a
 *    wall of the bus hits it. When the bus brakes the ball "runs ahead"
 *    relative to the bus; when the bus speeds up, the ball "stays behind".
 *  - Bus: while the bus moves uniformly it is an inertial frame too (the ball
 *    rests); while it brakes or speeds up the ball accelerates with no force
 *    acting on it — Newton's first law fails: the frame is non-inertial.
 * The strap swings to tan θ = a/g (3 m/s² → 17°).
 *
 * Presets: braking 6 m/s → 0 at 3 m/s² (2 s, 6 m), starting 0 → 6 m/s at
 * 2 m/s² (3 s, 9 m), uniform 4 m/s.
 */

const G = 9.8;
const BUS_L = 9; // m
const WALL = 4.2; // inner walls at ±WALL from the bus centre
const BALL_R = 0.3;
const LIM = WALL - BALL_R;
const FLOOR = 0.6; // floor height above the road
const ROOF = 3.1;
const WHEEL_R = 0.5;
const STRAP_X = -2.3; // strap anchor, from the bus centre
const STRAP_L = 0.5;
const STRAP_TOP = 2.95;
const E_WALL = 0.35; // fraction of the relative speed kept in a bounce
const MARK_DT = 0.5;

export const PROGRAMS = {
  brake: { v0: 6, tEnd: 5.5, phases: [{ t0: 0, a: 0 }, { t0: 1, a: -3 }, { t0: 3, a: 0 }], travel: 12, icon: OctagonMinus },
  start: { v0: 0, tEnd: 5.5, phases: [{ t0: 0, a: 0 }, { t0: 1, a: 2 }, { t0: 4, a: 0 }], travel: 18, icon: TrendingUp },
  cruise: { v0: 4, tEnd: 5, phases: [{ t0: 0, a: 0 }], travel: 20, icon: MoveRight },
};
const PROG_IDS = ['brake', 'start', 'cruise'];

const accAt = (prog, t) => {
  let a = 0;
  for (const ph of prog.phases) if (t >= ph.t0 - 1e-9) a = ph.a;
  return a;
};
const nextBoundary = (prog, t) => {
  for (const ph of prog.phases) if (ph.t0 > t + 1e-9) return ph.t0;
  return prog.tEnd;
};

const initial = (prog) => ({
  t: 0,
  xb: 0,
  V: prog.v0,
  x: 0,
  v: prog.v0,
  th: 0,
  om: 0,
  wallT: -1e9,
  wallSide: 0,
  running: false,
  done: false,
  marks: [{ t: 0, x: 0, xr: 0 }],
  samples: [{ t: 0, V: prog.v0, v: prog.v0 }],
});

function advance(p, dt, prog) {
  const s = { ...p };
  let left = Math.min(dt, prog.tEnd - s.t);
  while (left > 1e-9) {
    const h = Math.min(left, 1 / 240, nextBoundary(prog, s.t) - s.t);
    const a = accAt(prog, s.t + 1e-7);
    s.xb += s.V * h + 0.5 * a * h * h;
    s.V = Math.max(0, s.V + a * h);
    s.x += s.v * h;
    let rel = s.x - s.xb;
    let vrel = s.v - s.V;
    if (rel > LIM || rel < -LIM) {
      const side = rel > 0 ? 1 : -1;
      rel = side * LIM;
      if (vrel * side > 0) {
        if (Math.abs(vrel) > 0.3) {
          s.wallT = s.t;
          s.wallSide = side;
        }
        vrel = Math.abs(vrel) < 0.12 ? 0 : -E_WALL * vrel;
      }
      s.x = s.xb + rel;
      s.v = s.V + vrel;
    }
    // hand strap: a damped pendulum in the bus frame (θ > 0 swings to the front)
    const alpha = -(G * Math.sin(s.th) + a * Math.cos(s.th)) / STRAP_L - 2.6 * s.om;
    s.om += alpha * h;
    s.th += s.om * h;
    const tPrev = s.t;
    s.t += h;
    if (Math.floor((s.t + 1e-9) / MARK_DT) > Math.floor((tPrev + 1e-9) / MARK_DT)) s.marks = [...s.marks, { t: s.t, x: s.x, xr: s.x - s.xb }];
    left -= h;
  }
  const ls = s.samples[s.samples.length - 1];
  if (s.t - ls.t >= 0.04) s.samples = [...s.samples, { t: s.t, V: s.V, v: s.v }];
  if (s.t >= prog.tEnd - 1e-9) {
    s.running = false;
    s.done = true;
    s.samples = [...s.samples, { t: s.t, V: s.V, v: s.v }];
  }
  return s;
}

export default function BusSim({ T }) {
  const L = T.bus;
  const dec = T.decimal;
  const [progId, setProgId] = useState('brake');
  const prog = PROGRAMS[progId];
  const [frame, setFrame] = useState('ground');
  const [s, setS] = useState(() => initial(PROGRAMS.brake));
  const [blend, setBlend] = useTween(0);

  useRafLoop(s.running, (dt) => setS((p) => (p.running ? advance(p, dt, prog) : p)));

  const toggle = () => {
    if (s.done) setS({ ...initial(prog), running: true });
    else setS((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setS(initial(prog));
  const pickProg = (id) => {
    setProgId(id);
    setS(initial(PROGRAMS[id]));
  };
  const pickFrame = (f) => {
    setFrame(f);
    setBlend(f === 'bus' ? 1 : 0, 650);
  };

  const a = s.done ? 0 : accAt(prog, s.t + 1e-7);
  const vr = s.v - s.V;
  const rel = s.x - s.xb;
  const atWall = Math.abs(Math.abs(rel) - LIM) < 1e-6;
  const started = s.t > 0;
  // after a wall hit the wall message stays while the bus is still braking / speeding up
  const wallRecent = s.wallT > 0 && (s.t - s.wallT < 1.6 || Math.abs(a) > 1e-9);
  const F1 = (n) => num(n, 1, dec);

  /* ---- explanation */
  let key = 'idle';
  if (s.done) key = `done_${progId}`;
  else if (started) {
    if (wallRecent) key = 'wall';
    else if (Math.abs(a) > 1e-9) key = (a < 0 ? 'brake' : 'accel') + (frame === 'ground' ? 'G' : 'B');
    else if (s.V < 1e-6 && progId === 'brake') key = 'stopped';
    else if (Math.abs(vr) < 0.02) key = frame === 'ground' ? (s.V < 1e-6 ? 'restG' : 'uniformG') : 'uniformB';
    else key = 'drift';
  }
  const settled = useSettled(key, key === 'idle' || key.startsWith('done') ? 0 : 250);
  const ex = L.explain;
  const text = {
    idle: ex.idle,
    uniformG: ex.uniformG(F1(s.V)),
    restG: ex.restG,
    uniformB: ex.uniformB,
    brakeG: ex.brakeG(F1(s.v)),
    brakeB: ex.brakeB,
    accelG: ex.accelG,
    accelB: ex.accelB,
    wall: ex.wall,
    stopped: ex.stopped,
    drift: ex.drift(F1(Math.abs(vr)), vr > 0 ? L.toFront : L.toBack),
    done_brake: ex.done_brake,
    done_start: ex.done_start,
    done_cruise: ex.done_cruise,
  }[settled];
  const tone =
    settled === 'idle'
      ? '#22d3ee'
      : settled.endsWith('B') && settled !== 'uniformB'
        ? '#fbbf24'
        : settled === 'wall'
          ? '#94a3b8'
          : settled.startsWith('done')
            ? '#34d399'
            : '#34d399';

  /* ---- frame verdict */
  const inertial = frame === 'ground' || Math.abs(a) < 1e-9;
  const verdictSub = frame === 'ground' ? L.verdictSub.ground : Math.abs(a) < 1e-9 ? (s.V < 1e-6 ? L.verdictSub.busRest : L.verdictSub.busUniform) : a < 0 ? L.verdictSub.busBrake : L.verdictSub.busAccel;

  /* ---- graph (in the chosen frame) */
  const busFrame = frame === 'bus';
  const pts = s.running ? [...s.samples, { t: s.t, V: s.V, v: s.v }] : s.samples;
  const ballPts = pts.map((q) => ({ x: q.t, y: busFrame ? q.v - q.V : q.v }));
  const busPts = pts.map((q) => ({ x: q.t, y: busFrame ? 0 : q.V }));
  const top = Math.max(1, prog.v0, ...pts.map((q) => q.V), ...ballPts.map((q) => Math.abs(q.y)));
  const yMax = niceMax(busFrame ? Math.max(1, ...ballPts.map((q) => Math.abs(q.y)), 4) : top);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-5">
          <div className="md:col-span-3">
            <GroupLabel>{L.progLabel}</GroupLabel>
            <Segmented
              label={L.progLabel}
              className="grid-cols-1 sm:grid-cols-3"
              size="lg"
              value={progId}
              onChange={pickProg}
              options={PROG_IDS.map((id) => ({ value: id, label: L.progs[id].name, sub: L.progs[id].sub, icon: PROGRAMS[id].icon }))}
            />
          </div>
          <div className="md:col-span-2">
            <GroupLabel>{L.frameLabel}</GroupLabel>
            <Segmented
              label={L.frameLabel}
              className="grid-cols-2"
              size="lg"
              value={frame}
              onChange={pickFrame}
              accent={frame === 'ground' ? '#f59e0b' : '#818cf8'}
              options={[
                { value: 'ground', label: L.frames.ground.name, sub: L.frames.ground.sub, icon: Globe2 },
                { value: 'bus', label: L.frames.bus.name, sub: L.frames.bus.sub, icon: Bus },
              ]}
            />
          </div>
        </div>
        <PlayControls labels={T.common} running={s.running} done={s.done} started={started} onToggle={toggle} onReset={reset} />
      </div>

      <BusScene T={T} s={s} prog={prog} a={a} blend={blend} frame={frame} atWall={atWall} />

      <LiveExplain id={settled} tone={tone} text={text} />

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={L.readouts.bus}
          symbol="V"
          value={F1(s.V)}
          unit={T.ms}
          accent={PALETTE.vel}
          textColor={PALETTE.velText}
          sub={L.busSub(num(a, 1, dec))}
          active={Math.abs(a) > 1e-9}
        />
        <Readout label={L.readouts.ballG} symbol="v" value={F1(s.v)} unit={T.ms} accent={PALETTE.second} textColor={PALETTE.secondText} sub={wallRecent ? L.ballGSubWall : L.ballGSub} active={frame === 'ground'} />
        <Readout label={L.readouts.ballB} symbol="v′" value={F1(vr)} unit={T.ms} accent="#f472b6" textColor="#fbcfe8" sub={L.ballBSub(F1(s.v), F1(s.V))} active={frame === 'bus'} />
        <Readout label={L.readouts.frame} accent={inertial ? '#34d399' : '#fbbf24'}>
          <p className={`mt-1.5 text-xl sm:text-2xl font-bold leading-tight ${inertial ? 'text-emerald-300' : 'text-amber-300'}`}>{inertial ? L.inertial : L.nonInertial}</p>
          <p className="mt-auto pt-1.5 text-xs leading-snug text-gray-400">{verdictSub}</p>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{L.law.title}</p>
          <p className="text-sm leading-relaxed text-gray-200">{L.law.text}</p>
          <div className="rounded-xl bg-black/25 px-3 py-2.5 text-[13px] leading-snug text-gray-300 tabular-nums">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{L.strap.title}</p>
            <p className="mt-1">
              tg θ = <Sym s="a" /> / <Sym s="g" />
              {Math.abs(a) > 1e-9 ? (
                <>
                  {' '}
                  = {fmt(Math.abs(a), 1, dec)} / {fmt(G, 1, dec)} ⇒ θ ≈ <b className="text-amber-300">{fmt((Math.atan(Math.abs(a) / G) * 180) / Math.PI, 0, dec)}°</b>
                </>
              ) : (
                <> = 0 ⇒ θ = 0°</>
              )}
            </p>
            <p className="mt-1 text-[11px] text-gray-500">{L.strap.note}</p>
          </div>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <TimeGraph
            title={busFrame ? L.graph.titleB : L.graph.titleG}
            series={[
              { id: 'bus', label: busFrame ? L.graph.busB : L.graph.busG, color: PALETTE.velText, points: busPts },
              { id: 'ball', label: busFrame ? L.graph.ballB : L.graph.ballG, color: PALETTE.secondText, points: ballPts },
            ]}
            xMax={prog.tEnd}
            yMax={yMax}
            yMin={busFrame ? -yMax : 0}
            xLabel={L.graph.t}
            yLabel={L.graph.v}
            marker={started ? s.t : undefined}
            decimal={dec}
            xDigits={1}
            yDigits={tickDigits(busFrame ? 2 * yMax : yMax)}
            height={210}
            note={busFrame ? L.graph.noteB : L.graph.noteG}
            ariaLabel={L.graph.label}
          />
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

function BusScene({ T, s, prog, a, blend, frame, atWall }) {
  const L = T.bus;
  const dec = T.decimal;
  const busFrame = frame === 'bus';
  return (
    <LabScene
      legend={[
        { color: PALETTE.vel, label: L.legend.v, kind: 'arrow' },
        { color: PALETTE.acc, label: L.legend.a, kind: 'arrow' },
        { color: PALETTE.second, label: L.legend.marks, kind: 'ring' },
      ]}
      chips={
        <>
          <Chip>{L.chipTime(fmt(s.t, 1, dec))}</Chip>
          <Chip icon={busFrame ? Bus : Globe2} color={busFrame ? '#4f46e5' : '#d97706'} strong>
            {L.chipFrame(busFrame ? L.frames.bus.name : L.frames.ground.name)}
          </Chip>
        </>
      }
      height={(W, narrow) => (narrow ? 230 : 340)}
      ariaLabel={L.sceneLabel(busFrame ? L.frames.bus.name : L.frames.ground.name, num(s.V, 1, dec), num(s.v, 1, dec), num(s.v - s.V, 1, dec))}
    >
      {(W, H, narrow) => {
        const xmin = -BUS_L / 2 - 1.5;
        const xmax = prog.travel + BUS_L / 2 + 1.5;
        const k = W / (xmax - xmin);
        const camG = (xmin + xmax) / 2;
        const cam = camG * (1 - blend) + s.xb * blend;
        const view = { k, sx: (x) => W / 2 + (x - cam) * k, wx: (px) => cam + (px - W / 2) / k };
        const groundY = H - (narrow ? 44 : 52);
        const Y = (y) => groundY - y * k;
        const fs = narrow ? 10 : 12;
        const box = { w: W, h: H };
        const kv = narrow ? 9 : 17;
        const ka = narrow ? 9 : 16;
        const bx = view.sx(s.xb);
        const step = rulerStep(k, narrow ? 40 : 56);
        const relView = { k, sx: (xr) => view.sx(s.xb + xr), wx: (px) => view.wx(px) - s.xb };
        const ballX = view.sx(s.x);
        const ballY = Y(FLOOR + BALL_R);
        const br = Math.max(3.5, BALL_R * k);
        const roofY = Y(ROOF);
        const vRow = roofY - (narrow ? 14 : 20);
        const aRow = vRow - (narrow ? 20 : 28);
        const vr = s.v - s.V;
        const wallOn = s.t - s.wallT < 0.35;
        // strap
        const ax0 = view.sx(s.xb + STRAP_X);
        const ay0 = Y(STRAP_TOP);
        const hx = ax0 + Math.sin(s.th) * STRAP_L * k;
        const hy = ay0 + Math.cos(s.th) * STRAP_L * k;
        const thDeg = (s.th * 180) / Math.PI;
        // passenger leaning with the strap
        const feetX = view.sx(s.xb + STRAP_X - 0.35);
        const lean = s.th * 0.6;
        const bodyH = 1.05 * k;
        const hipX = feetX + Math.sin(lean) * 0.85 * k;
        const hipY = Y(FLOOR) - Math.cos(lean) * 0.85 * k;
        const shX = hipX + Math.sin(lean) * bodyH * 0.62;
        const shY = hipY - Math.cos(lean) * bodyH * 0.62;
        const headX = shX + Math.sin(lean) * 0.24 * k;
        const headY = shY - Math.cos(lean) * 0.24 * k;
        const showB = narrow ? false : true;

        return (
          <>
            <rect width={W} height={H} fill="#fbfcfe" />
            <Roadside view={view} W={W} groundY={groundY} k={k} />
            <rect x={0} y={groundY} width={W} height={10} fill="#e2e8f0" />
            <line x1={0} x2={W} y1={groundY} y2={groundY} stroke="#94a3b8" strokeWidth="1.2" />
            <line x1={0} x2={W} y1={groundY + 10} y2={groundY + 10} stroke="#64748b" strokeWidth="1.4" />
            {busFrame ? (
              <Ruler view={relView} W={W} y={groundY + 16} step={step} unit={L.axisBus} decimal={dec} fs={fs - 1} color="#4f46e5" />
            ) : (
              <Ruler view={view} W={W} y={groundY + 16} step={step} unit={L.axisGround} decimal={dec} fs={fs - 1} color="#b45309" />
            )}

            {/* ball marks every 0.5 s (in the chosen frame) */}
            {s.marks.map((mk) => {
              const wx = mk.x * (1 - blend) + (s.xb + mk.xr) * blend;
              const mx = view.sx(wx);
              return <circle key={mk.t} cx={mx} cy={Y(BALL_R) - 1} r={narrow ? 2.5 : 3.5} fill="#fff" stroke={PALETTE.second} strokeWidth="1.8" opacity="0.85" />;
            })}

            {/* bus */}
            <g>
              <rect x={view.sx(s.xb - BUS_L / 2)} y={roofY} width={BUS_L * k} height={(ROOF - 0.45) * k} rx={0.45 * k} fill="#fef3c7" stroke="#b45309" strokeWidth={narrow ? 1.5 : 2.5} />
              <rect x={view.sx(s.xb - BUS_L / 2) + 0.25 * k} y={Y(ROOF - 0.25)} width={(BUS_L - 0.5) * k} height={1.0 * k} rx={0.15 * k} fill="#e0f2fe" stroke="#7dd3fc" strokeWidth="1" opacity="0.8" />
              {[-1, 1].map((side) => (
                <rect key={side} x={view.sx(s.xb + side * WALL) - (side > 0 ? 0 : 0.3 * k)} y={roofY + 2} width={0.3 * k} height={(ROOF - 0.45) * k - 4} fill="#f59e0b" opacity="0.65" />
              ))}
              <rect x={view.sx(s.xb - BUS_L / 2) + 0.2 * k} y={Y(FLOOR)} width={(BUS_L - 0.4) * k} height={0.12 * k} fill="#78350f" opacity="0.8" />
              <rect x={view.sx(s.xb + BUS_L / 2) - 0.25 * k} y={Y(1.1)} width={0.18 * k} height={0.3 * k} rx={2} fill="#fde047" stroke="#ca8a04" />
              <rect x={view.sx(s.xb - BUS_L / 2) + 0.07 * k} y={Y(1.1)} width={0.15 * k} height={0.3 * k} rx={2} fill="#ef4444" />
              {[-2.9, 2.9].map((dx) => (
                <g key={dx}>
                  <circle cx={view.sx(s.xb + dx)} cy={Y(WHEEL_R)} r={WHEEL_R * k} fill="#1e293b" />
                  <circle cx={view.sx(s.xb + dx)} cy={Y(WHEEL_R)} r={WHEEL_R * k * 0.45} fill="#cbd5e1" />
                </g>
              ))}
            </g>

            {/* strap and passenger */}
            <line x1={ax0 - 0.5 * k} x2={ax0 + 0.5 * k} y1={ay0} y2={ay0} stroke="#475569" strokeWidth="2" />
            <line x1={ax0} y1={ay0} x2={hx} y2={hy} stroke="#334155" strokeWidth={narrow ? 1.5 : 2.2} />
            <circle cx={hx} cy={hy + 0.07 * k} r={Math.max(2.5, 0.08 * k)} fill="none" stroke="#334155" strokeWidth={narrow ? 1.5 : 2.2} />
            <g strokeLinecap="round" fill="none">
              <line x1={feetX - 0.1 * k} y1={Y(FLOOR)} x2={hipX - 0.04 * k} y2={hipY} stroke="#1e3a8a" strokeWidth={Math.max(2, 0.13 * k)} />
              <line x1={feetX + 0.1 * k} y1={Y(FLOOR)} x2={hipX + 0.04 * k} y2={hipY} stroke="#1e3a8a" strokeWidth={Math.max(2, 0.13 * k)} />
              <line x1={hipX} y1={hipY} x2={shX} y2={shY} stroke="#2563eb" strokeWidth={Math.max(3, 0.3 * k)} />
              <line x1={shX} y1={shY} x2={hx} y2={hy + 0.07 * k} stroke="#2563eb" strokeWidth={Math.max(1.5, 0.1 * k)} />
            </g>
            <circle cx={headX} cy={headY} r={Math.max(3, 0.16 * k)} fill="#f4c095" stroke="#c0835a" strokeWidth="1" />
            {Math.abs(thDeg) > 2.5 && showB && (
              <text x={ax0 + (thDeg > 0 ? 10 : -10)} y={ay0 + 16} textAnchor={thDeg > 0 ? 'start' : 'end'} fontSize={fs - 1} fontWeight="700" fill="#b45309">
                θ ≈ {fmt(Math.abs(thDeg), 0, dec)}°
              </text>
            )}

            {/* ball */}
            <circle cx={ballX} cy={ballY} r={br} fill={PALETTE.second} stroke="#9d174d" strokeWidth="1.5" />
            <circle cx={ballX - br * 0.35} cy={ballY - br * 0.35} r={br * 0.3} fill="#fff" opacity="0.5" />

            {/* wall force when it hits */}
            {wallOn && (
              <g opacity={1 - (s.t - s.wallT) / 0.35}>
                <Arrow x1={ballX + s.wallSide * br} y1={ballY} x2={ballX - s.wallSide * (br + (narrow ? 26 : 50))} y2={ballY} color="#334155" width={narrow ? 3 : 4} head={narrow ? 9 : 12} />
                <TagPill x={ballX - s.wallSide * (br + (narrow ? 30 : 56))} y={ballY - 16} anchor={s.wallSide > 0 ? 'end' : 'start'} parts={[{ t: L.wallForce }]} bg="#334155" size={fs} box={box} />
              </g>
            )}

            {/* velocity of the ball in the chosen frame */}
            {(() => {
              const vShow = busFrame ? vr : s.v;
              if (Math.abs(vShow) < 0.05) return null;
              const len = vShow * kv;
              const y0 = ballY - br - (narrow ? 7 : 10);
              return (
                <>
                  <Arrow x1={ballX} y1={y0} x2={ballX + len} y2={y0} color={PALETTE.vel} width={narrow ? 2.5 : 3} head={narrow ? 8 : 11} />
                  {showB && (
                    <TagPill
                      x={ballX + len + Math.sign(len) * 6}
                      y={y0}
                      anchor={len > 0 ? 'start' : 'end'}
                      parts={[{ t: 'v', italic: true }, ...(busFrame ? [{ t: '′' }] : []), { t: L.subBall, sub: true }, { t: ` = ${num(vShow, 1, dec)} ${T.ms}` }]}
                      bg={PALETTE.vel}
                      size={fs - 1}
                      box={box}
                    />
                  )}
                </>
              );
            })()}
            {busFrame && Math.abs(a) > 1e-9 && !atWall && (
              <TagPill x={ballX} y={ballY - br - (narrow ? 26 : 38)} parts={[{ t: L.noForce }]} bg="#d97706" size={fs - 1} box={box} />
            )}

            {/* velocity and acceleration of the bus (ground frame only: in its own frame the bus is at rest) */}
            {!busFrame && s.V > 0.05 && (
              <>
                <Arrow x1={bx} y1={vRow} x2={bx + s.V * kv} y2={vRow} color={PALETTE.vel} width={narrow ? 3 : 3.5} head={narrow ? 9 : 12} />
                <circle cx={bx} cy={vRow} r={3} fill={PALETTE.vel} />
                <TagPill x={bx - 8} y={vRow} anchor="end" parts={[{ t: 'V', italic: true }, { t: ` = ${num(s.V, 1, dec)} ${T.ms}` }]} bg={PALETTE.vel} size={fs} box={box} />
              </>
            )}
            {Math.abs(a) > 1e-9 && (
              <>
                <Arrow x1={bx} y1={aRow} x2={bx + a * ka} y2={aRow} color={PALETTE.acc} width={narrow ? 3 : 3.5} head={narrow ? 9 : 12} />
                <circle cx={bx} cy={aRow} r={3} fill={PALETTE.acc} />
                <TagPill
                  x={a > 0 ? bx - 8 : bx + 8}
                  y={aRow}
                  anchor={a > 0 ? 'end' : 'start'}
                  parts={[{ t: 'a', italic: true }, { t: ` = ${num(a, 1, dec)} ${T.ms2}` }]}
                  bg={PALETTE.acc}
                  size={fs}
                  box={box}
                />
              </>
            )}
          </>
        );
      }}
    </LabScene>
  );
}

/** Trees and posts fixed to the ground (they show the bus's motion in either frame). */
function Roadside({ view, W, groundY, k }) {
  const items = [];
  const stepW = 4;
  const first = Math.floor(view.wx(-60) / stepW);
  const last = Math.ceil(view.wx(W + 60) / stepW);
  for (let i = first; i <= last; i += 1) {
    const x = view.sx((i + 0.2 + hash01(i) * 0.6) * stepW);
    const h = (2.4 + hash01(i + 9) * 1.4) * k;
    if (hash01(i + 4) > 0.5) {
      items.push(
        <g key={`t${i}`} opacity="0.75">
          <line x1={x} x2={x} y1={groundY} y2={groundY - h * 0.5} stroke="#a16207" strokeWidth={Math.max(1.5, 0.1 * k)} />
          <ellipse cx={x} cy={groundY - h * 0.7} rx={h * 0.16} ry={h * 0.24} fill="#dcfce7" stroke="#86efac" strokeWidth="1" />
        </g>,
      );
    } else {
      items.push(<line key={`p${i}`} x1={x} x2={x} y1={groundY} y2={groundY - 1.4 * k} stroke="#94a3b8" strokeWidth={Math.max(1.5, 0.08 * k)} />);
    }
  }
  const lines = [];
  for (let y = groundY - 28; y > 0; y -= 28) lines.push(<line key={`h${y}`} x1={0} x2={W} y1={y} y2={y} stroke={PALETTE.grid} strokeWidth={1} />);
  return (
    <g aria-hidden="true">
      {lines}
      {items}
    </g>
  );
}
