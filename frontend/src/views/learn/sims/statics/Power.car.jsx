import { useState } from 'react';
import { Lightbulb, Minus, Mountain, MountainSnow, TrendingUp, Timer, Zap } from 'lucide-react';

import { Explain, RangeField, Readout, Segmented, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { AxisNumbers, Grid } from '../kit/scene';
import { Chip, ForceArrow, Formula, G, GroupLabel, HP, LabScene, LiveGraph, PC, PlayControls, SidePill, niceAxis, smart, whole } from './Power.parts';
import PowerScale from './Power.scale';

/**
 * Tab 3 — N = F·v. A car whose engine delivers a fixed power N to the
 * wheels drives along an endless road; the reader tilts the road ahead
 * (flat, 3°, 6°, 10°) and changes the power or the mass while it drives.
 * Newton's 2nd law along the road:
 *   m·dv/dt = F − (μmg·cosα + k·v² + mg·sinα),  with the traction F = N/v.
 * The car settles where the traction equals the resistance, and there
 * N = F·v: a hill adds mg·sinα, so the steady speed drops and F grows.
 * μ = 0.015 (rolling), k = ½·ρ·C·S = 0.4 kg/m (air), g = 9.8 m/s².
 *
 * Preset: m = 1200 kg, N = 20 kW.
 * Flat: 0.4v³ + 176.4v = 20 000 → v ≈ 32.9 m/s (≈ 118 km/h), F = N/v ≈ 609 N.
 * 6° hill: mg·sin6° = 1229 N, rolling 175 N → 0.4v³ + 1404v = 20 000 →
 * v ≈ 13.5 m/s (≈ 49 km/h), F ≈ 1478 N. In both cases F·v = 20 kW.
 */

const MU = 0.015;
const K_AIR = 0.4;
const K_TIME = 2; // the road is long: time runs twice as fast on screen
const STEP = 0.01; // s, integration step
const WINDOW = 40; // s of history on the graphs
const SLOPES = [
  { deg: 0, icon: Minus },
  { deg: 3, icon: TrendingUp },
  { deg: 6, icon: Mountain },
  { deg: 10, icon: MountainSnow },
];
const rad = (d) => (d * Math.PI) / 180;
const FIRST_SEG = { s0: -1e5, X0: -1e5, Y0: 0, ang: 0, deg: 0 };

function segAt(segs, s) {
  let g = segs[0];
  for (const x of segs) {
    if (x.s0 <= s) g = x;
    else break;
  }
  return g;
}

function road(segs, s) {
  const g = segAt(segs, s);
  const d = s - g.s0;
  return { X: g.X0 + d * Math.cos(g.ang), Y: g.Y0 + d * Math.sin(g.ang), ang: g.ang, deg: g.deg };
}

function roadY(segs, X) {
  let g = segs[0];
  for (const x of segs) {
    if (x.X0 <= X) g = x;
    else break;
  }
  return g.Y0 + (X - g.X0) * Math.tan(g.ang);
}

function resistance(v, ang, m) {
  const roll = MU * m * G * Math.cos(ang);
  const air = K_AIR * v * v;
  const slope = m * G * Math.sin(ang);
  return { roll, air, slope, total: roll + air + slope };
}

/** The speed at which N/v equals the resistance (bisection). */
function steadySpeed(N, ang, m) {
  let lo = 0.05;
  let hi = 200;
  for (let i = 0; i < 70; i += 1) {
    const mid = (lo + hi) / 2;
    if (N / mid > resistance(mid, ang, m).total) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

const traction = (N, v, m) => Math.min(N / v, 0.8 * m * G); // the tyres' grip caps it at low speed

function freshSim() {
  return { running: false, started: false, t: 0, s: 0, v: 0, segs: [FIRST_SEG], hist: [] };
}

export default function CarSim({ T }) {
  const Cr = T.car;
  const dec = T.decimal;
  const [Nkw, setNkw] = useState(20);
  const [m, setM] = useState(1200);
  const [sim, setSim] = useState(freshSim);
  const N = Nkw * 1000;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const total = dt * K_TIME;
      const n = Math.max(1, Math.ceil(total / STEP));
      const h = total / n;
      let { t, s, v } = p;
      let hist = p.hist;
      for (let i = 0; i < n; i += 1) {
        const ang = road(p.segs, s).ang;
        const F = traction(N, v, m);
        const acc = (F - resistance(v, ang, m).total) / m;
        v = Math.max(0.3, v + acc * h);
        s += v * h;
        t += h;
        if (!hist.length || t - hist[hist.length - 1].t >= 0.1) {
          hist = [...hist.filter((q) => q.t >= t - WINDOW - 12), { t, v, F: traction(N, v, m) }];
        }
      }
      const segs = p.segs.filter((g, i, arr) => i === arr.length - 1 || arr[i + 1].s0 > s - 900);
      return { ...p, t, s, v, hist, segs };
    });
  });

  /* ---- the current state (before Start the car waits at its steady speed) */
  const pos = road(sim.segs, sim.s);
  const v = sim.started ? sim.v : steadySpeed(N, pos.ang, m);
  const F = traction(N, v, m);
  const R = resistance(v, pos.ang, m);
  const acc = (F - R.total) / m;
  const vFlat = steadySpeed(N, 0, m);
  const vHere = steadySpeed(N, pos.ang, m);
  const kmh = (x) => fmt(x * 3.6, 0, dec);

  const toggle = () =>
    setSim((p) => {
      if (p.running) return { ...p, running: false };
      if (!p.started) {
        const v0 = steadySpeed(N, road(p.segs, p.s).ang, m);
        return { ...p, running: true, started: true, v: v0, hist: [{ t: 0, v: v0, F: traction(N, v0, m) }] };
      }
      return { ...p, running: true };
    });
  const reset = () => setSim(freshSim());
  /** Tilt the road a few metres ahead of the car (or right here before the start). */
  const pickSlope = (deg) =>
    setSim((p) => {
      const sNew = p.started ? p.s + 9 : p.s;
      const base = p.segs.filter((g) => g.s0 < sNew);
      const last = base[base.length - 1];
      if (last.deg === deg) return { ...p, segs: base };
      const d = sNew - last.s0;
      const seg = { s0: sNew, X0: last.X0 + d * Math.cos(last.ang), Y0: last.Y0 + d * Math.sin(last.ang), ang: rad(deg), deg };
      return { ...p, segs: [...base, seg] };
    });
  const aheadDeg = sim.segs[sim.segs.length - 1].deg;

  /* ---- explanation */
  let key = 'idle';
  if (sim.started) {
    if (Math.abs(acc) < 0.025) key = pos.ang > 0 ? 'hillSteady' : 'flat';
    else if (acc < 0) key = pos.ang > 0 ? 'hillSlow' : 'slowDown';
    else key = 'speedUp';
  }
  const settled = useSettled(key, key === 'idle' ? 0 : 450);
  const vals = {
    N: smart(Nkw, dec),
    v: fmt(v, 1, dec),
    k: kmh(v),
    F: whole(F, dec),
    vF: fmt(vFlat, 1, dec),
    kF: kmh(vFlat),
    FF: whole(N / vFlat, dec),
    kT: kmh(vHere),
    deg: fmt(pos.deg, 0, dec),
    ratio: smart(vFlat / v, dec, 1),
    mgs: whole(R.slope, dec),
  };
  const text = Cr.explain[settled](vals);
  const tone = { idle: '#22d3ee', flat: '#34d399', hillSteady: '#fbbf24', hillSlow: '#fb923c', slowDown: '#fb923c', speedUp: '#60a5fa' }[settled] ?? '#22d3ee';

  /* ---- graphs: the last 30–40 s */
  const t0 = Math.max(0, Math.ceil((sim.t - WINDOW) / 10) * 10);
  const shown = sim.hist.filter((q) => q.t >= t0);
  const vPts = sim.started ? [...shown.map((q) => ({ x: q.t - t0, y: q.v })), { x: sim.t - t0, y: v }] : [{ x: 0, y: v }];
  const fPts = sim.started ? [...shown.map((q) => ({ x: q.t - t0, y: q.F })), { x: sim.t - t0, y: F }] : [{ x: 0, y: F }];
  const vAx = niceAxis(Math.max(vFlat, ...shown.map((q) => q.v), v) * 1.08);
  const fAx = niceAxis(Math.max(N / vHere, ...shown.map((q) => q.F), F) * 1.1);
  const vSeries = [
    { id: 'vs', label: Cr.graph.steady, color: 'rgba(110,231,183,0.5)', points: [{ x: 0, y: vHere }, { x: WINDOW, y: vHere }], dash: '5 5', dot: false, width: 1.6 },
    { id: 'v', label: Cr.graph.v, color: '#34d399', points: vPts },
  ];
  const fSeries = [
    { id: 'fs', label: Cr.graph.steady, color: 'rgba(252,165,165,0.5)', points: [{ x: 0, y: N / vHere }, { x: WINDOW, y: N / vHere }], dash: '5 5', dot: false, width: 1.6 },
    { id: 'f', label: Cr.graph.F, color: '#f87171', points: fPts },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{Cr.slopesLabel}</GroupLabel>
          <Segmented
            label={Cr.slopesLabel}
            className="grid-cols-2 md:grid-cols-4"
            size="lg"
            value={aheadDeg}
            onChange={pickSlope}
            options={SLOPES.map((x) => ({
              value: x.deg,
              label: Cr.slopes[x.deg],
              sub: Cr.slopeSub(fmt(x.deg, 0, dec), whole(m * G * Math.sin(rad(x.deg)), dec)),
              icon: x.icon,
            }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={false} started={sim.started} onToggle={toggle} onReset={reset} />
      </div>

      <CarScene T={T} sim={sim} pos={pos} v={v} F={F} R={R} m={m} N={N} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={Cr.readouts.v}
          symbol="v"
          value={fmt(v, 1, dec)}
          unit={T.ms}
          accent={PC.v}
          textColor={PC.vText}
          sub={
            <>
              {Cr.readouts.kmh(kmh(v))}
              <br />
              <span className="text-gray-500">{Cr.readouts.target(kmh(vHere))}</span>
            </>
          }
        />
        <Readout
          label={Cr.readouts.F}
          symbol="F"
          value={whole(F, dec)}
          unit={T.N}
          accent={PC.F}
          textColor={PC.FText}
          active={sim.started && Math.abs(acc) > 0.04}
          sub={
            <>
              {Cr.readouts.Fsub(whole(R.total, dec))}
              <br />
              <span className="text-gray-500">{Cr.readouts.acc(fmt(acc, 2, dec))}</span>
            </>
          }
        />
        <Readout
          label={Cr.readouts.N}
          symbol="N"
          value={smart(Nkw, dec)}
          unit={T.kW}
          accent={PC.N}
          textColor={PC.NText}
          sub={
            <>
              {Cr.readouts.Nsub(smart(N / HP, dec, 0))}
              <br />
              <span className="text-gray-500">{Cr.readouts.Nconst}</span>
            </>
          }
        />
        <Readout label={Cr.readouts.formula} accent="#e2e8f0">
          <div className="mt-1.5 space-y-1 text-[13px] leading-snug">
            <p className="text-[15px] text-gray-100">
              <Formula text="N = F·v" />
            </p>
            <p className="tabular-nums text-gray-400">
              {whole(F, dec)} {T.N} · {fmt(v, 1, dec)} {T.ms} = <b style={{ color: PC.NText }}>{smart((F * v) / 1000, dec, 1)}</b> {T.kW}
            </p>
            <p className="text-xs text-gray-500">{Cr.formulaNote}</p>
          </div>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="pw-car-n"
            label={Cr.power}
            symbol="N"
            min={10}
            max={100}
            step={1}
            value={Nkw}
            onChange={setNkw}
            accent={PC.N}
            display={`${smart(Nkw, dec)} ${T.kW}`}
            hint={Cr.powerHint(smart(N / HP, dec, 0))}
          />
          <RangeField
            id="pw-car-m"
            label={Cr.mass}
            symbol="m"
            min={800}
            max={2400}
            step={50}
            value={m}
            onChange={setM}
            accent="#94a3b8"
            display={`${fmt(m, 0, dec)} ${T.kg}`}
            hint={Cr.massHint}
          />
          <div className="rounded-xl bg-black/25 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{Cr.forces.title}</p>
            <dl className="mt-1.5 space-y-0.5 text-[13px] tabular-nums">
              {[
                [Cr.forces.roll, R.roll, PC.RText],
                [Cr.forces.air, R.air, PC.RText],
                [Cr.forces.slope, R.slope, PC.mgText],
              ].map(([name, val, col]) => (
                <div key={name} className="flex justify-between gap-3 px-1">
                  <dt className="text-gray-400">{name}</dt>
                  <dd style={{ color: col }}>
                    {whole(val, dec)} {T.N}
                  </dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 border-t border-white/10 px-1 pt-1">
                <dt className="text-gray-300">{Cr.forces.total}</dt>
                <dd className="font-semibold text-white">
                  {whole(R.total, dec)} {T.N}
                </dd>
              </div>
              <div className="flex justify-between gap-3 px-1">
                <dt className="text-gray-300">{Cr.forces.F}</dt>
                <dd className="font-semibold" style={{ color: PC.FText }}>
                  {whole(F, dec)} {T.N}
                </dd>
              </div>
            </dl>
            <p className="mt-1.5 text-xs text-gray-500">{Cr.forces.note}</p>
          </div>
          <div className="rounded-xl bg-black/25 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{Cr.table.title(smart(Nkw, dec))}</p>
            <table className="mt-1.5 w-full text-[13px] tabular-nums">
              <thead>
                <tr className="text-left text-[11px] text-gray-500">
                  <th className="px-1 font-medium">α</th>
                  <th className="px-1 font-medium">v</th>
                  <th className="px-1 font-medium">F</th>
                  <th className="px-1 text-right font-medium">F·v</th>
                </tr>
              </thead>
              <tbody>
                {SLOPES.map((x) => {
                  const vs = steadySpeed(N, rad(x.deg), m);
                  const on = pos.deg === x.deg;
                  return (
                    <tr key={x.deg} className={on ? 'bg-white/10 text-white' : 'text-gray-400'}>
                      <td className="rounded-l-lg px-1 py-0.5">{fmt(x.deg, 0, dec)}°</td>
                      <td className="px-1 py-0.5" style={{ color: on ? PC.vText : undefined }}>
                        {kmh(vs)} {Cr.kmhUnit}
                      </td>
                      <td className="px-1 py-0.5" style={{ color: on ? PC.FText : undefined }}>
                        {whole(N / vs, dec)} {T.N}
                      </td>
                      <td className="rounded-r-lg px-1 py-0.5 text-right" style={{ color: on ? PC.NText : undefined }}>
                        {smart(Nkw, dec)} {T.kW}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-1.5 text-xs text-gray-500">{Cr.table.note}</p>
          </div>
        </div>
        <div className="lg:col-span-3 space-y-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <LiveGraph
            title={Cr.graph.vTitle}
            series={vSeries}
            xMax={WINDOW}
            xOffset={t0}
            yMax={vAx.max}
            yDigits={vAx.digits}
            xLabel={Cr.graph.t}
            yLabel={Cr.graph.vy}
            marker={sim.t - t0}
            decimal={dec}
            ariaLabel={Cr.graph.vLabel}
            height={200}
          />
          <LiveGraph
            title={Cr.graph.fTitle}
            series={fSeries}
            xMax={WINDOW}
            xOffset={t0}
            yMax={fAx.max}
            yDigits={fAx.digits}
            xLabel={Cr.graph.t}
            yLabel={Cr.graph.fy}
            marker={sim.t - t0}
            decimal={dec}
            ariaLabel={Cr.graph.fLabel}
            height={200}
            note={Cr.graph.note}
          />
        </div>
      </div>

      <PowerScale T={T} carW={N} />
    </div>
  );
}

/* ================================================================ scene */

const CAR_BODY = [
  ['M', -2.1, 0.3],
  ['L', -2.1, 0.95],
  ['Q', -2.06, 1.07, -1.82, 1.1],
  ['L', -1.12, 1.43],
  ['L', 0.32, 1.43],
  ['L', 1.12, 0.94],
  ['L', 1.92, 0.86],
  ['Q', 2.16, 0.8, 2.13, 0.56],
  ['L', 2.1, 0.3],
  ['Z'],
];
const CAR_WIN = [
  [-1.0, 1.06],
  [-0.92, 1.34],
  [0.28, 1.34],
  [0.92, 0.98],
];

function CarScene({ T, sim, pos, v, F, R, m, N }) {
  const Cr = T.car;
  const dec = T.decimal;
  const segs = sim.segs;
  // one force scale for every setting: the largest resistance on the steepest hill at this power
  const vMin = steadySpeed(N, rad(10), m);
  const fRef = Math.max(N / vMin, resistance(steadySpeed(N, 0, m), rad(10), m).total);

  return (
    <LabScene
      legend={[
        { color: PC.F, label: Cr.legend.F, kind: 'arrow' },
        { color: PC.R, label: Cr.legend.R, kind: 'arrow' },
        { color: PC.mg, label: Cr.legend.mgs, kind: 'arrow' },
        { color: PC.v, label: Cr.legend.v, kind: 'arrow' },
      ]}
      chips={
        <>
          <Chip icon={Timer}>
            {Cr.chipFast(K_TIME)} · t = {fmt(sim.t, 1, dec)} {T.s}
          </Chip>
          <Chip icon={Zap} color={PC.N} strong>
            {Cr.chipPower(smart(N / 1000, dec))}
          </Chip>
        </>
      }
      height={(W, narrow) => (narrow ? 400 : 470)}
      ariaLabel={Cr.sceneLabel(fmt(sim.s, 0, dec), fmt(v * 3.6, 0, dec), whole(F, dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 10.5 : 12;
        const box = { w: W, h: H };
        const mmH = narrow ? 40 : 46;
        const mmY = H - mmH - 8;
        const kk = W / (narrow ? 19 : 36);
        const camX = pos.X;
        const camY = pos.Y;
        const cx = W * (narrow ? 0.42 : 0.38);
        const cy = H * (narrow ? 0.6 : 0.62);
        const sx = (X) => cx + (X - camX) * kk;
        const sy = (Y) => cy - (Y - camY) * kk;
        const view = { k: kk, sx, sy, wx: (px) => camX + (px - cx) / kk, wy: (py) => camY - (py - cy) / kk };
        const Xl = view.wx(-20);
        const Xr = view.wx(W + 20);
        const kinks = segs.filter((g, i) => i > 0 && g.X0 > Xl && g.X0 < Xr);
        const xs = [Xl, ...kinks.map((g) => g.X0), Xr];
        const roadPts = xs.map((X) => `${sx(X).toFixed(1)},${sy(roadY(segs, X)).toFixed(1)}`).join(' ');
        const ground = `${sx(Xl).toFixed(1)},${H} ${roadPts} ${sx(Xr).toFixed(1)},${H}`;

        /* car pose from the two wheels on the road */
        const rear = road(segs, sim.s - 1.3);
        const front = road(segs, sim.s + 1.3);
        const th = Math.atan2(front.Y - rear.Y, front.X - rear.X);
        const mX = (rear.X + front.X) / 2;
        const mY = (rear.Y + front.Y) / 2;
        const c = Math.cos(th);
        const sn = Math.sin(th);
        const P = (x, y) => [sx(mX + x * c - y * sn), sy(mY + x * sn + y * c)];
        const pathOf = (cmds) =>
          cmds
            .map((cmd) => {
              if (cmd[0] === 'Z') return 'Z';
              const pts = [];
              for (let i = 1; i < cmd.length; i += 2) pts.push(P(cmd[i], cmd[i + 1]).map((n) => n.toFixed(1)).join(','));
              return `${cmd[0]}${pts.join(' ')}`;
            })
            .join(' ');
        const wheelR = 0.31;
        const wheels = [-1.3, 1.3].map((wx) => P(wx, wheelR));
        const spin = (sim.s / wheelR) * (180 / Math.PI);

        /* forces */
        const kF = Math.min(narrow ? 0.05 : 0.075, (narrow ? 110 : 170) / Math.max(fRef, 1));
        const ux = c;
        const uy = -sn; // screen direction "forward along the road"
        const cm = P(0.1, 0.62);
        const back = P(-2.1, 0.5);
        const top = P(-0.6, 1.2);
        const roof = P(-0.5, 1.95);
        const lenF = F * kF;
        const lenR = (R.roll + R.air) * kF;
        const lenS = R.slope * kF;
        const lenV = Math.min(narrow ? 80 : 160, v * (narrow ? 2 : 3));

        /* scenery: trees and distance posts along the road */
        const trees = [];
        const gap = 17;
        for (let X = Math.ceil(Xl / gap) * gap; X < Xr; X += gap) {
          const big = Math.round(X / gap) % 3 === 0;
          const y0 = sy(roadY(segs, X) + 0.4);
          const hT = Math.min((big ? 6.5 : 4.5) * kk, H * 0.3);
          trees.push(
            <g key={`tr${X}`} opacity="0.75">
              <line x1={sx(X) + 6} x2={sx(X) + 6} y1={y0} y2={y0 - hT * 0.45} stroke="#a16207" strokeWidth={Math.max(2, 0.3 * kk)} />
              <ellipse cx={sx(X) + 6} cy={y0 - hT * 0.68} rx={hT * 0.28} ry={hT * 0.35} fill={big ? '#86efac' : '#bbf7d0'} stroke="#4ade80" strokeWidth="1" />
            </g>,
          );
        }
        const posts = [];
        for (let s = Math.max(0, Math.ceil((sim.s - 40) / 25) * 25); s < sim.s + 50; s += 25) {
          const p = road(segs, s);
          if (sx(p.X) < -40 || sx(p.X) > W + 40) continue;
          // distance marks on the verge, below the road surface
          const yb = sy(p.Y) + Math.max(4, 0.16 * kk);
          posts.push(
            <g key={`ps${s}`}>
              <line x1={sx(p.X)} x2={sx(p.X)} y1={yb} y2={yb + 8} stroke="#64748b" strokeWidth="1.6" />
              <rect x={sx(p.X) - 23} y={yb + 8} width={46} height={16} rx={3} fill="#fff" stroke="#94a3b8" />
              <text x={sx(p.X)} y={yb + 20} textAnchor="middle" fontSize={fs - 1.5} fontWeight="700" fill="#475569">
                {`${s} ${T.m}`}
              </text>
            </g>,
          );
        }

        return (
          <>
            <rect x={0} y={0} width={W} height={H} fill="#fbfcfe" />
            <Grid view={view} W={W} H={H} minPx={narrow ? 70 : 100} />
            <polygon points={ground} fill="#eef2e6" />
            {trees}
            {/* the road */}
            <polyline points={roadPts} fill="none" stroke="#475569" strokeWidth={Math.max(6, 0.3 * kk)} strokeLinejoin="round" />
            <polyline points={roadPts} fill="none" stroke="#fff" strokeWidth="1.4" strokeDasharray="14 16" strokeLinejoin="round" />
            {posts}

            {/* the angle of each new, steeper stretch of road */}
            {kinks.map((g, i) => {
              const prev = segs[segs.indexOf(g) - 1];
              if (!(g.ang > prev.ang)) return <g key={`k${i}`} />;
              const r = Math.min(80, 9 * kk);
              const x0 = sx(g.X0);
              const y0 = sy(g.Y0);
              return (
                <g key={`k${i}`} aria-hidden="true">
                  <line x1={x0} x2={x0 + r * 1.35} y1={y0} y2={y0} stroke="#64748b" strokeDasharray="4 4" />
                  <path d={`M${x0 + r},${y0} A${r},${r} 0 0 0 ${x0 + r * Math.cos(g.ang)},${y0 - r * Math.sin(g.ang)}`} fill="none" stroke="#334155" strokeWidth="1.6" />
                  <SidePill x={x0 + r * 1.35} y={y0 - r * Math.sin(g.ang / 2) - 2} side={1} gap={4} text={`α = ${fmt(g.deg, 0, dec)}°`} bg="#334155" fs={fs} box={box} />
                </g>
              );
            })}

            {/* car */}
            <g aria-hidden="true">
              <path d={pathOf(CAR_BODY)} fill="#0284c7" stroke="#0c4a6e" strokeWidth="1.4" strokeLinejoin="round" />
              <polygon points={CAR_WIN.map(([x, y]) => P(x, y).map((n) => n.toFixed(1)).join(',')).join(' ')} fill="#e0f2fe" stroke="#0c4a6e" strokeWidth="1" />
              <line x1={P(-0.3, 1.34)[0]} y1={P(-0.3, 1.34)[1]} x2={P(-0.3, 1.02)[0]} y2={P(-0.3, 1.02)[1]} stroke="#0c4a6e" strokeWidth="1.6" />
              <line x1={P(-1.7, 0.62)[0]} y1={P(-1.7, 0.62)[1]} x2={P(1.7, 0.62)[0]} y2={P(1.7, 0.62)[1]} stroke="#0369a1" strokeWidth="1" />
              <circle cx={P(2.02, 0.68)[0]} cy={P(2.02, 0.68)[1]} r={Math.max(2, 0.09 * kk)} fill="#fde047" stroke="#a16207" strokeWidth="0.8" />
              <circle cx={P(-2.04, 0.78)[0]} cy={P(-2.04, 0.78)[1]} r={Math.max(2, 0.08 * kk)} fill="#f87171" />
              {wheels.map(([wx, wy], i) => (
                <g key={`wh${i}`}>
                  <circle cx={wx} cy={wy} r={wheelR * kk} fill="#1e293b" />
                  <circle cx={wx} cy={wy} r={wheelR * 0.55 * kk} fill="#cbd5e1" />
                  <g transform={`rotate(${spin.toFixed(1)} ${wx.toFixed(1)} ${wy.toFixed(1)})`}>
                    <line x1={wx - wheelR * 0.55 * kk} x2={wx + wheelR * 0.55 * kk} y1={wy} y2={wy} stroke="#475569" strokeWidth="1.6" />
                    <line x1={wx} x2={wx} y1={wy - wheelR * 0.55 * kk} y2={wy + wheelR * 0.55 * kk} stroke="#475569" strokeWidth="1.6" />
                  </g>
                </g>
              ))}
            </g>

            {/* forces along the road and the velocity */}
            <ForceArrow x1={cm[0]} y1={cm[1]} x2={cm[0] + ux * lenF} y2={cm[1] + uy * lenF} color={PC.F} width={narrow ? 3 : 3.6} head={narrow ? 10 : 13} />
            <ForceArrow x1={back[0]} y1={back[1]} x2={back[0] - ux * lenR} y2={back[1] - uy * lenR} color={PC.R} width={narrow ? 3 : 3.4} head={narrow ? 10 : 12} />
            {lenS > 2 && <ForceArrow x1={top[0]} y1={top[1]} x2={top[0] - ux * lenS} y2={top[1] - uy * lenS} color={PC.mg} width={narrow ? 2.6 : 3} head={narrow ? 9 : 11} />}
            {sim.running && <ForceArrow x1={roof[0]} y1={roof[1]} x2={roof[0] + ux * lenV} y2={roof[1] + uy * lenV} color={PC.v} width={2.8} head={10} dot={false} />}
            <SidePill x={cm[0] + ux * lenF + 6} y={cm[1] + uy * lenF + (narrow ? 15 : 18)} side={0} text={narrow ? Cr.tag.Fs(whole(F, dec)) : Cr.tag.F(whole(F, dec))} bg={PC.F} fs={fs} box={box} />
            <SidePill x={back[0] - ux * lenR - 6} y={back[1] - uy * lenR + (narrow ? 15 : 18)} side={0} text={narrow ? Cr.tag.Rs(whole(R.roll + R.air, dec)) : Cr.tag.R(whole(R.roll + R.air, dec))} bg={PC.R} fs={fs} box={box} />
            {lenS > 2 && (
              <SidePill x={top[0] - ux * lenS - 6} y={top[1] - uy * lenS - (narrow ? 13 : 16)} side={0} text={narrow ? Cr.tag.Ss(whole(R.slope, dec)) : Cr.tag.S(whole(R.slope, dec))} bg={PC.mg} fs={fs} box={box} />
            )}
            {sim.running && <SidePill x={roof[0] + ux * lenV} y={roof[1] + uy * lenV - (narrow ? 13 : 15)} side={0} text={Cr.tag.v(fmt(v, 1, dec))} bg={PC.v} fs={fs} box={box} />}

            <AxisNumbers view={view} W={W} H={mmY - 4} minPx={narrow ? 70 : 100} xUnit={Cr.axisX} showY={false} decimal={dec} />

            <Speedometer x={W - (narrow ? 50 : 70)} y={mmY - (narrow ? 50 : 62)} r={narrow ? 34 : 44} v={v} T={T} fs={fs} />
            <ProfileStrip x={10} y={mmY} w={W - 20} h={mmH} segs={segs} s={sim.s} T={T} fs={fs} />
          </>
        );
      }}
    </LabScene>
  );
}

function Speedometer({ x, y, r, v, T, fs }) {
  const Cr = T.car;
  const dec = T.decimal;
  const kmh = v * 3.6;
  const frac = clamp(kmh / 200, 0, 1);
  const ang = Math.PI * (1 - frac);
  return (
    <g aria-hidden="true">
      <path d={`M${x - r - 9},${y} A${r + 9},${r + 9} 0 0 1 ${x + r + 9},${y} L${x + r + 9},${y + 34} L${x - r - 9},${y + 34} Z`} fill="#ffffff" stroke="#cbd5e1" />
      <path d={`M${x - r},${y} A${r},${r} 0 0 1 ${x + r},${y}`} fill="none" stroke="#e2e8f0" strokeWidth="7" />
      <path d={`M${x - r},${y} A${r},${r} 0 0 1 ${x + r * Math.cos(ang)},${y - r * Math.sin(ang)}`} fill="none" stroke={PC.v} strokeWidth="7" />
      {[0, 50, 100, 150, 200].map((s) => {
        const a = Math.PI * (1 - s / 200);
        return <line key={`t${s}`} x1={x + (r - 10) * Math.cos(a)} y1={y - (r - 10) * Math.sin(a)} x2={x + (r - 4) * Math.cos(a)} y2={y - (r - 4) * Math.sin(a)} stroke="#64748b" strokeWidth="1.4" />;
      })}
      <line x1={x} y1={y} x2={x + (r - 9) * Math.cos(ang)} y2={y - (r - 9) * Math.sin(ang)} stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx={x} cy={y} r={3.5} fill="#0f172a" />
      <text x={x} y={y + 18} textAnchor="middle" fontSize={fs + 3} fontWeight="800" fill="#065f46">
        {fmt(kmh, 0, dec)}
      </text>
      <text x={x} y={y + 30} textAnchor="middle" fontSize={fs - 2.5} fill="#475569">
        {Cr.kmhUnit}
      </text>
    </g>
  );
}

/** The road's height profile from 500 m behind the car to 100 m ahead. */
function ProfileStrip({ x, y, w, h, segs, s, T, fs }) {
  const Cr = T.car;
  const dec = T.decimal;
  const sA = Math.max(0, s - 500);
  const sB = sA + 600;
  const pts = [];
  const marks = [sA, ...segs.filter((g) => g.s0 > sA && g.s0 < sB).map((g) => g.s0), sB];
  for (const q of marks) pts.push(road(segs, q));
  const X0 = pts[0].X;
  const Xs = pts[pts.length - 1].X - X0;
  const Ys = pts.map((p) => p.Y);
  const yLo = Math.min(...Ys);
  const yHi = Math.max(...Ys);
  const innerW = w - 110;
  const sc = Math.min(innerW / Math.max(Xs, 1), (h - 14) / Math.max(yHi - yLo, 1e-6));
  const ox = x + 56 + (innerW - Xs * sc) / 2;
  const oy = y + h - 7;
  const mx = (X) => ox + (X - X0) * sc;
  const my = (Y) => oy - (Y - yLo) * sc;
  const car = road(segs, s);
  return (
    <g aria-hidden="true">
      <rect x={x} y={y} width={w} height={h} rx={10} fill="#ffffff" fillOpacity="0.94" stroke="#cbd5e1" />
      <text x={x + 10} y={y + h / 2 + 4} fontSize={fs - 2} fontWeight="700" fill="#64748b">
        {Cr.profile}
      </text>
      <polyline points={pts.map((p) => `${mx(p.X).toFixed(1)},${my(p.Y).toFixed(1)}`).join(' ')} fill="none" stroke="#475569" strokeWidth="2.4" strokeLinejoin="round" />
      <circle cx={mx(car.X)} cy={my(car.Y)} r={5} fill="#0284c7" stroke="#fff" strokeWidth="1.5" />
      <text x={x + w - 10} y={y + h / 2 + 4} textAnchor="end" fontSize={fs - 2} fontWeight="700" fill="#64748b">
        {`s = ${fmt(s, 0, dec)} ${T.m}`}
      </text>
    </g>
  );
}
