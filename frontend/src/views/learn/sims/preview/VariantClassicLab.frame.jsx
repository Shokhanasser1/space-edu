import { useState } from 'react';
import { Building2, Lightbulb, MoveLeft, MoveRight, Pause, Play, RotateCcw, Timer, TrainFront } from 'lucide-react';
import { Arrow, Btn, Explain, Pill, RangeField, Readout, Segmented, clamp, fmt, useElementSize, useRafLoop, useSettled, useTween } from './VariantClassicLab.ui';

/**
 * "Sanoq sistemasi": a passenger walks inside a train car that is pulling
 * out of a station. The same motion is shown from the platform's frame and
 * from the train's frame — the camera, the coordinate axis and the clock are
 * attached to whichever body is chosen as the reference body.
 *
 * Galilean kinematics: x = x_rear + x′, v = V + v′, and both clocks agree.
 * All strings come in through `t` (UZ.frame in VariantClassicLab.jsx).
 */

const T_END = 8; // s, length of one run (real time, no compression)
const CAR = 18; // m, car length
const REAR0 = 2; // m, rear of the car on the platform axis at t = 0
const VIEW_X0 = -4; // m, left edge of the platform-frame view
const VIEW_W = 54; // m, view width
const START_FWD = 3; // m from the rear when walking forwards
const START_BACK = 15; // m from the rear when walking backwards

const COL = {
  platform: '#d97706',
  platformText: '#fcd34d',
  train: '#4f46e5',
  trainText: '#a5b4fc',
  person: '#e11d48',
  vel: '#059669',
  ink: '#0f172a',
};

function initial(dir) {
  const xp = dir > 0 ? START_FWD : START_BACK;
  return { t: 0, rear: REAR0, xp, walked: 0, sP: 0, sT: 0, running: false, done: false, marks: [{ t: 0, x: REAR0 + xp, xp }] };
}

export default function FrameSim({ t, common, decimal }) {
  const [frame, setFrame] = useState('platform');
  const [dir, setDir] = useState(1);
  const [V, setV] = useState(2.5);
  const [u, setU] = useState(1.2);
  const [sim, setSim] = useState(() => initial(1));
  const [blend, setBlend] = useTween(0);

  useRafLoop(sim.running, (dtRaw) => {
    setSim((p) => {
      if (!p.running) return p;
      const dt = Math.min(dtRaw, T_END - p.t);
      const tt = p.t + dt;
      const rear = p.rear + V * dt;
      const xp = clamp(p.xp + dir * u * dt, 0.6, CAR - 0.6);
      const marks = [...p.marks];
      const nextMark = Math.floor(p.t + 1e-9) + 1;
      if (tt >= nextMark - 1e-9 && nextMark <= T_END) {
        const f = dt > 0 ? (nextMark - p.t) / dt : 1;
        const mxp = p.xp + (xp - p.xp) * f;
        const mrear = p.rear + (rear - p.rear) * f;
        marks.push({ t: nextMark, x: mrear + mxp, xp: mxp });
      }
      const done = tt >= T_END - 1e-9;
      return {
        t: done ? T_END : tt,
        rear,
        xp,
        walked: p.walked + u * dt,
        sP: p.sP + Math.abs(V + dir * u) * dt,
        sT: p.sT + u * dt,
        running: !done,
        done,
        marks,
      };
    });
  });

  const toggle = () => {
    if (sim.done) setSim({ ...initial(dir), running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(initial(dir));
  const pickDir = (d) => {
    setDir(d);
    setSim(initial(d));
  };
  const pickFrame = (f) => {
    setFrame(f);
    setBlend(f === 'train' ? 1 : 0, 650);
  };

  const v = V + dir * u; // passenger velocity relative to the platform
  const vp = dir * u; // relative to the train
  const x = sim.rear + sim.xp;

  let key = 'idle';
  if (sim.done) key = 'done';
  else if (sim.t > 0) {
    if (frame === 'platform') {
      if (V < 0.05) key = 'still';
      else if (Math.abs(v) < 0.05) key = 'zero';
      else if (dir > 0) key = 'fwd';
      else key = v > 0 ? 'backFwd' : 'backBack';
    } else key = u < 0.05 ? 'trainRest' : 'train';
  }
  const settled = useSettled(key, key === 'done' || key === 'idle' ? 0 : 300);
  const F = (n) => fmt(n, 1, decimal);
  const ex = t.explain;
  const text = {
    idle: ex.idle,
    still: ex.still(F(u)),
    zero: ex.zero,
    fwd: ex.fwd(F(Math.abs(v))),
    backFwd: ex.backFwd(F(Math.abs(v))),
    backBack: ex.backBack(F(Math.abs(v))),
    train: ex.train(F(u), F(V)),
    trainRest: ex.trainRest(F(V)),
    done: ex.done(F(sim.t)),
  }[settled];
  const tone = settled === 'done' ? '#34d399' : frame === 'platform' ? COL.platform : '#818cf8';

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{t.frameLabel}</p>
          <Segmented
            label={t.frameLabel}
            className="grid-cols-2"
            size="lg"
            value={frame}
            onChange={pickFrame}
            accent={frame === 'platform' ? '#f59e0b' : '#818cf8'}
            options={[
              { value: 'platform', label: t.frames.platform.name, sub: t.frames.platform.sub, icon: Building2 },
              { value: 'train', label: t.frames.train.name, sub: t.frames.train.sub, icon: TrainFront },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex">
          <Btn variant="primary" icon={sim.running ? Pause : Play} onClick={toggle} className="md:min-w-[148px] min-h-[52px] text-[15px]">
            {sim.running ? common.pause : sim.done ? common.again : sim.t > 0 ? common.resume : common.start}
          </Btn>
          <Btn icon={RotateCcw} onClick={reset} disabled={sim.t === 0 && !sim.running} className="min-h-[52px] text-[15px]">
            {common.reset}
          </Btn>
        </div>
      </div>

      <FrameScene t={t} sim={sim} frame={frame} blend={blend} V={V} v={v} vp={vp} dir={dir} decimal={decimal} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        <Readout
          className="col-span-2 lg:col-span-1"
          label={t.readouts.time}
          symbol="t"
          value={F(sim.t)}
          unit="s"
          accent="#22d3ee"
          textColor="#a5f3fc"
          sub={t.readouts.timeSub}
        >
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full bg-cyan-400" style={{ width: `${(sim.t / T_END) * 100}%` }} />
          </div>
        </Readout>
        <Readout label={t.readouts.platform} accent={COL.platform} active={frame === 'platform'} sub={t.readouts.path(F(sim.sP))}>
          <FramePair x={`${F(x)}`} xName="x" v={F(v)} vName="v" color={COL.platformText} />
        </Readout>
        <Readout label={t.readouts.train} accent={COL.train} active={frame === 'train'} sub={t.readouts.path(F(sim.sT))}>
          <FramePair x={`${F(sim.xp)}`} xName="x′" v={F(vp)} vName="v′" color={COL.trainText} />
        </Readout>
      </div>

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4 lg:grid-cols-3 lg:gap-6">
        <div>
          <p className="mb-1.5 text-sm text-gray-300">{t.dirLabel}</p>
          <Segmented
            label={t.dirLabel}
            className="grid-cols-2"
            value={dir}
            onChange={pickDir}
            accent="#fb7185"
            options={[
              { value: 1, label: t.dirs.fwd, icon: MoveRight },
              { value: -1, label: t.dirs.back, icon: MoveLeft },
            ]}
          />
        </div>
        <RangeField
          id="cl-train-v"
          label={t.trainSpeed}
          symbol="V"
          min={0}
          max={3.5}
          step={0.1}
          value={V}
          onChange={setV}
          accent="#818cf8"
          display={`${F(V)} m/s`}
          hint={t.trainHint(fmt(V * 3.6, 0, decimal))}
        />
        <RangeField
          id="cl-walk-u"
          label={t.walkSpeed}
          symbol="u"
          min={0}
          max={1.5}
          step={0.1}
          value={u}
          onChange={setU}
          accent="#fb7185"
          display={`${F(u)} m/s`}
          hint={t.walkHint}
        />
      </div>
    </div>
  );
}

function FramePair({ x, xName, v, vName, color }) {
  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex items-baseline gap-1.5">
        <span className="font-serif italic text-gray-400 text-lg">{xName} =</span>
        <span className="text-[24px] sm:text-[30px] leading-none font-bold tabular-nums tracking-tight" style={{ color }}>
          {x}
        </span>
        <span className="text-sm text-gray-400">m</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-serif italic text-gray-400">{vName} =</span>
        <span className="text-lg font-semibold tabular-nums text-white">{v}</span>
        <span className="text-sm text-gray-400">m/s</span>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

function hash(i) {
  const s = Math.sin(i * 91.7 + 13.3) * 43758.5453;
  return s - Math.floor(s);
}

function Clock({ cx, cy, r, time, color, active }) {
  const a = ((time % 60) / 60) * Math.PI * 2;
  const am = ((time / 600) % 1) * Math.PI * 2;
  return (
    <g>
      {active && <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke={color} strokeWidth={2.5} strokeOpacity="0.9" />}
      <circle cx={cx} cy={cy} r={r} fill="#fff" stroke={COL.ink} strokeWidth={1.6} />
      {Array.from({ length: 12 }, (_, i) => {
        const b = (i / 12) * Math.PI * 2;
        return <line key={i} x1={cx + Math.sin(b) * r * 0.78} y1={cy - Math.cos(b) * r * 0.78} x2={cx + Math.sin(b) * r * 0.92} y2={cy - Math.cos(b) * r * 0.92} stroke="#64748b" strokeWidth={1} />;
      })}
      <line x1={cx} y1={cy} x2={cx + Math.sin(am) * r * 0.5} y2={cy - Math.cos(am) * r * 0.5} stroke={COL.ink} strokeWidth={2} strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={cx + Math.sin(a) * r * 0.82} y2={cy - Math.cos(a) * r * 0.82} stroke="#e11d48" strokeWidth={1.4} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={1.8} fill={COL.ink} />
    </g>
  );
}

function Person({ x, floor, h, facing, walked, moving }) {
  const swing = moving ? Math.sin((walked / 0.7) * Math.PI) * 0.5 : 0;
  const hipY = floor - h * 0.47;
  const shoulderY = floor - h * 0.78;
  const leg = h * 0.47;
  const arm = h * 0.34;
  const sw = Math.max(2, h * 0.075);
  const foot = (a) => [x + Math.sin(a) * leg * facing, hipY + Math.cos(a) * leg];
  const hand = (a) => [x + Math.sin(a) * arm * facing, shoulderY + Math.cos(a) * arm];
  const [f1x, f1y] = foot(swing);
  const [f2x, f2y] = foot(-swing);
  const [h1x, h1y] = hand(-swing * 0.9);
  const [h2x, h2y] = hand(swing * 0.9);
  return (
    <g stroke={COL.person} strokeWidth={sw} strokeLinecap="round" fill="none">
      <line x1={x} y1={hipY} x2={f2x} y2={f2y} strokeOpacity="0.55" />
      <line x1={x} y1={shoulderY} x2={h2x} y2={h2y} strokeOpacity="0.55" />
      <line x1={x} y1={hipY} x2={x} y2={shoulderY - h * 0.04} />
      <line x1={x} y1={hipY} x2={f1x} y2={f1y} />
      <line x1={x} y1={shoulderY} x2={h1x} y2={h1y} />
      <circle cx={x + facing * h * 0.01} cy={floor - h * 0.9} r={h * 0.1} fill={COL.person} stroke="none" />
    </g>
  );
}

function FrameScene({ t, sim, frame, blend, V, v, vp, dir, decimal }) {
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 280);
  const narrow = W < 560;
  const H = narrow ? Math.round(W * 0.74) : Math.round(clamp(W * 0.34, 300, 390));
  const k = W / VIEW_W;
  // heights are drawn slightly exaggerated (only horizontal positions carry physics)
  const hk = narrow ? Math.max(k, 10.5) : k * 1.22;
  const fs = narrow ? 11 : 12;
  const F = (n) => fmt(n, 1, decimal);

  // camera: left edge on the platform axis; follows the car in the train frame
  const camX0 = VIEW_X0 + blend * (sim.rear - REAR0);
  const X = (xm) => (xm - camX0) * k;

  const railY = H - (narrow ? 78 : 80);
  const wheelR = 0.42 * hk;
  const bodyBottom = railY - 0.95 * hk;
  const bodyH = 3.4 * hk;
  const roofY = bodyBottom - bodyH;
  const floorY = bodyBottom - 0.32 * hk;
  const personH = 1.75 * hk;
  const chestY = floorY - personH * 0.62;
  const rulerY = roofY - 7;
  const platTop = railY + 5;
  const platBot = railY + 19;

  const rearX = X(sim.rear);
  const frontX = X(sim.rear + CAR);
  const px = X(sim.rear + sim.xp);
  const moving = sim.running && Math.abs(vp) > 0.01;
  const xLeft = camX0 - 2;
  const xRight = camX0 + VIEW_W + 2;

  // platform: lamps, skyline and ruler ticks (all attached to the ground)
  const skyline = [];
  for (let i = Math.floor(xLeft / 7) - 1; i <= Math.ceil(xRight / 7); i += 1) {
    const hgt = (2.5 + hash(i) * 4.5) * hk * 0.9;
    skyline.push(<rect key={`sk${i}`} x={X(i * 7)} y={roofY - 10 - hgt * 0.55} width={6.2 * k} height={hgt * 0.55 + (railY - roofY) + 10} fill={hash(i + 7) > 0.5 ? '#e2e8f0' : '#e8edf4'} />);
  }
  const lamps = [];
  for (let i = Math.ceil(xLeft / 10); i <= Math.floor(xRight / 10); i += 1) {
    if (i === 0) continue;
    const lx = X(i * 10);
    lamps.push(
      <g key={`lp${i}`}>
        <line x1={lx} x2={lx} y1={platTop} y2={roofY - 0.9 * hk} stroke="#94a3b8" strokeWidth={2} />
        <rect x={lx - 0.35 * hk} y={roofY - 1.15 * hk} width={0.7 * hk} height={0.3 * hk} rx={2} fill="#94a3b8" />
      </g>,
    );
  }
  const pTicks = [];
  const pLabelEvery = k > 14 ? 5 : 10;
  for (let i = Math.ceil(xLeft); i <= Math.floor(xRight); i += 1) {
    const tx = X(i);
    const major = i % pLabelEvery === 0;
    pTicks.push(<line key={`pt${i}`} x1={tx} x2={tx} y1={platBot} y2={platBot + (major ? 8 : i % 5 === 0 ? 6 : 3.5)} stroke="#78350f" strokeOpacity={major ? 0.9 : 0.5} strokeWidth={major ? 1.4 : 1} />);
    if (major && tx > 6 && tx < W - 8)
      pTicks.push(
        <text key={`pl${i}`} x={tx} y={platBot + 21} textAnchor="middle" fontSize={fs - 1} fill="#92400e" fontWeight={i === 0 ? 700 : 500}>
          {i}
        </text>,
      );
  }
  const tTicks = [];
  const tLabelEvery = k > 14 ? 3 : 6;
  for (let i = 0; i <= CAR; i += 1) {
    const tx = X(sim.rear + i);
    const major = i % tLabelEvery === 0;
    tTicks.push(<line key={`tt${i}`} x1={tx} x2={tx} y1={rulerY} y2={rulerY - (major ? 7 : 3.5)} stroke={COL.train} strokeOpacity={major ? 0.95 : 0.6} strokeWidth={major ? 1.4 : 1} />);
    if (major)
      tTicks.push(
        <text key={`tl${i}`} x={tx} y={rulerY - 11} textAnchor="middle" fontSize={fs - 1} fill={COL.train} fontWeight={i === 0 ? 700 : 500}>
          {i}
        </text>,
      );
  }

  // windows
  const windows = [];
  for (let wx = 1.3; wx + 2 <= CAR - 1.1; wx += 2.45) {
    windows.push(
      <rect key={`w${wx.toFixed(2)}`} x={X(sim.rear + wx)} y={roofY + 0.55 * hk} width={2.0 * k} height={1.25 * hk} rx={Math.min(4, 0.25 * hk)} fill="#e0f2fe" stroke="#7dd3fc" strokeWidth={1} />,
    );
  }

  // trajectory marks in the chosen frame
  const isPlatform = frame === 'platform';
  const markX = (m) => (isPlatform ? X(m.x) : X(sim.rear + m.xp));
  const curX = px;
  const firstX = sim.marks.length ? markX(sim.marks[0]) : px;

  const pActive = isPlatform;
  const vShown = isPlatform ? v : vp;
  const vLen = Math.abs(vShown) * hk * 0.95;
  const vDir = Math.sign(vShown) || 1;
  const box = { w: W, h: H };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-300/70 bg-white shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]">
      <div ref={ref} className="w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t.sceneLabel(t.frames[frame].name)} className="cl-scene block select-none">
          <defs>
            <linearGradient id="cl-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="100%" stopColor="#eef2ff" />
            </linearGradient>
          </defs>
          <rect width={W} height={H} fill="url(#cl-sky)" />
          {skyline}
          {/* station clock (platform frame) */}
          <line x1={X(0)} x2={X(0)} y1={platTop} y2={roofY - 2.4 * hk} stroke="#64748b" strokeWidth={2.5} />
          {lamps}


          {/* rails & platform */}
          <rect x={0} y={railY - 2} width={W} height={4} fill="#475569" />
          {Array.from({ length: Math.ceil(VIEW_W / 1.2) + 4 }, (_, i) => {
            const sx = X(Math.floor(xLeft / 1.2) * 1.2 + i * 1.2);
            return <rect key={`sl${i}`} x={sx} y={railY + 2} width={Math.max(2, 0.35 * k)} height={3} fill="#94a3b8" />;
          })}
          <rect x={0} y={platTop} width={W} height={platBot - platTop} fill="#e5e7eb" />
          <rect x={0} y={platTop} width={W} height={3} fill="#facc15" />
          <rect x={0} y={platBot} width={W} height={H - platBot} fill="#f8fafc" />
          <g opacity={pActive ? 1 : 0.5}>
            {pTicks}
            <line x1={0} x2={W} y1={platBot} y2={platBot} stroke="#92400e" strokeWidth={pActive ? 2 : 1} />
          </g>
          {pActive && <Arrow x1={W - 40} y1={platBot} x2={W - 4} y2={platBot} color={COL.platform} width={2} head={9} />}
          <text x={X(0) - 7} y={platTop - 6} textAnchor="end" fontSize={fs + 1} fontWeight="700" fill={COL.platform} opacity={pActive ? 1 : 0.55}>
            O
          </text>

          {/* the car */}
          <g>
            {[2.6, 4.3, 13.7, 15.4].map((wx) => (
              <circle key={wx} cx={X(sim.rear + wx)} cy={railY - wheelR} r={wheelR} fill="#334155" stroke="#0f172a" strokeWidth={1} />
            ))}
            <rect x={rearX} y={roofY} width={frontX - rearX} height={bodyH} rx={Math.min(10, 0.6 * hk)} fill="#f8fafc" stroke="#334155" strokeWidth={1.6} />
            <rect x={rearX + 1} y={bodyBottom - 0.55 * hk} width={frontX - rearX - 2} height={0.26 * hk} fill={COL.train} opacity="0.85" />
            {windows}
            <line x1={rearX + 4} x2={frontX - 4} y1={floorY} y2={floorY} stroke="#cbd5e1" strokeWidth={1.5} />
            <Clock cx={X(sim.rear + CAR / 2)} cy={roofY + 0.55 * hk + 0.62 * hk} r={Math.max(7, 0.5 * hk)} time={sim.t} color={COL.train} active={!pActive} />
          </g>

          {/* station clock face (in front of lamps, behind labels) */}
          <Clock cx={X(0)} cy={roofY - 2.4 * hk - Math.max(9, 0.75 * hk)} r={Math.max(9, 0.75 * hk)} time={sim.t} color={COL.platform} active={pActive} />

          {/* train axis on the roof */}
          <g opacity={pActive ? 0.5 : 1}>
            <line x1={rearX} x2={frontX} y1={rulerY} y2={rulerY} stroke={COL.train} strokeWidth={pActive ? 1 : 2} />
            {tTicks}
            {!pActive && <Arrow x1={frontX} y1={rulerY} x2={frontX + 1.6 * k + 10} y2={rulerY} color={COL.train} width={2} head={9} />}
            <text x={rearX - 7} y={rulerY + 4} textAnchor="end" fontSize={fs + 1} fontWeight="700" fill={COL.train}>
              O′
            </text>
          </g>

          {/* trajectory in the chosen frame, with a mark every second */}
          {sim.t > 0 && (
            <line x1={firstX} x2={curX} y1={chestY} y2={chestY} stroke={COL.person} strokeOpacity="0.55" strokeWidth={2.5} strokeDasharray="1 5" strokeLinecap="round" />
          )}
          {sim.marks.map((m) => (
            <circle key={m.t} cx={markX(m)} cy={chestY} r={narrow ? 2.8 : 3.4} fill="#fff" stroke={COL.person} strokeWidth={1.8} />
          ))}

          {/* passenger */}
          <Person x={px} floor={floorY} h={personH} facing={dir} walked={sim.walked} moving={moving} />

          {/* projection lines to both axes */}
          <line x1={px} x2={px} y1={rulerY + 1} y2={floorY - personH} stroke={COL.train} strokeWidth={1.2} strokeDasharray="3 3" opacity={pActive ? 0.45 : 0.9} />
          <line x1={px} x2={px} y1={floorY + 1} y2={platBot} stroke={COL.platform} strokeWidth={1.2} strokeDasharray="3 3" opacity={pActive ? 0.9 : 0.45} />
          <circle cx={px} cy={platBot} r={3.5} fill={COL.platform} opacity={pActive ? 1 : 0.5} />
          <circle cx={px} cy={rulerY} r={3.5} fill={COL.train} opacity={pActive ? 0.5 : 1} />

          {/* velocity of the passenger in the chosen frame */}
          {sim.t > 0 && vLen > 3 && (
            <Arrow x1={px + vDir * 0.5 * hk} y1={chestY - personH * 0.12} x2={px + vDir * (0.5 * hk + vLen)} y2={chestY - personH * 0.12} color={COL.vel} width={3} head={10} />
          )}
          {/* velocity of the other body */}
          {pActive && V > 0.05 && sim.t > 0 && (
            <Arrow x1={frontX + 6} y1={roofY + bodyH * 0.5} x2={frontX + 6 + V * hk * 0.95} y2={roofY + bodyH * 0.5} color={COL.train} width={3} head={10} />
          )}
          {!pActive && V > 0.05 && sim.t > 0 && (
            <Arrow x1={W * 0.62} y1={(platTop + platBot) / 2 + 1} x2={W * 0.62 - V * hk * 0.95} y2={(platTop + platBot) / 2 + 1} color={COL.platform} width={3} head={10} />
          )}

          {/* value tags */}
          <Pill x={px} y={platBot + (narrow ? 42 : 46)} text={t.xTag(F(sim.rear + sim.xp))} bg={pActive ? COL.platform : '#fff'} color={pActive ? '#fff' : '#b45309'} border={pActive ? undefined : '#fcd34d'} size={fs} box={box} />
          <Pill x={px} y={rulerY - (narrow ? 34 : 42)} text={t.xpTag(F(sim.xp))} bg={pActive ? '#fff' : COL.train} color={pActive ? COL.train : '#fff'} border={pActive ? '#c7d2fe' : undefined} size={fs} box={box} />
          {sim.t > 0 && vLen > 3 && (
            <Pill
              x={px + vDir * (0.5 * hk + vLen + (narrow ? 34 : 42))}
              y={chestY - personH * 0.12}
              text={pActive ? t.vTag(F(v)) : t.vpTag(F(vp))}
              bg={COL.vel}
              size={fs - 1}
              box={box}
            />
          )}
          {pActive && V > 0.05 && sim.t > 0 && !narrow && (
            <Pill x={frontX + 6 + V * hk * 0.95 + 52} y={roofY + bodyH * 0.5} text={t.VTag(F(V))} bg="#fff" color={COL.train} border="#c7d2fe" size={fs - 1} box={box} />
          )}
          {!pActive && V > 0.05 && sim.t > 0 && (
            <Pill x={W * 0.62 - V * hk * 0.95 - (narrow ? 44 : 52)} y={(platTop + platBot) / 2 + 1} text={t.platformTag(F(-V))} bg="#fff" color="#b45309" border="#fcd34d" size={fs - 1} box={box} />
          )}
        </svg>
      </div>

      {/* overlays */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 sm:p-3">
        <div
          className="rounded-xl border bg-white/90 px-2.5 py-1.5 shadow-sm"
          style={{ borderColor: frame === 'platform' ? '#fcd34d' : '#c7d2fe' }}
        >
          <p className="text-[12px] sm:text-[13px] font-semibold" style={{ color: frame === 'platform' ? '#b45309' : COL.train }}>
            {t.chip(t.frames[frame].name)}
          </p>
          <p className="hidden sm:block text-[11px] text-slate-500">{t.chipSub}</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[12px] font-semibold tabular-nums text-slate-700 shadow-sm">
          <Timer size={14} className="text-cyan-600" aria-hidden="true" />t = {F(sim.t)} s
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-200 bg-slate-50 px-3 py-2 text-[11px] sm:text-[12px] text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: COL.platform }} /> {t.axisPlatform}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: COL.train }} /> {t.axisTrain}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: COL.person }} /> {t.passenger}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: COL.vel }} /> {t.legendV}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full border-2 bg-white" style={{ borderColor: COL.person }} /> {t.legendMarks}
        </span>
      </div>
    </div>
  );
}
