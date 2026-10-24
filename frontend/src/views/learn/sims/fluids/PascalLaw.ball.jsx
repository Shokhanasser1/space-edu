import { useId, useState } from 'react';
import { CloudFog, Droplets, Lightbulb, Timer } from 'lucide-react';

import { Explain, RangeField, Readout, Segmented, clamp, niceStep, useElementSize, useRafLoop, useSettled } from '../kit/ui';
import { makeView } from '../kit/scene';
import { COL, CapArrow, Chip, Formula, GroupLabel, LabScene, Label, Panel, PlayControls, ScaleChip, Tag, fmtP, pressureParts, sig } from './PascalLaw.parts';

/**
 * Tab 2 — Pascal's ball. A piston of area S is pushed with force F into a
 * cylinder joined to a glass sphere with 11 holes facing every way. The
 * piston adds the pressure Δp = F / S to the liquid (or gas), and the
 * liquid passes it on unchanged to every point and in every direction:
 * equal jets from all holes, equal Δp arrows on every wall.
 *   preset: F = 20 N, S = 10 cm² = 0.001 m²  →  Δp = 20 000 Pa = 20 kPa.
 * The piston's speed comes from the outflow: each hole (d = 1 mm, a = 0.785
 * mm²) lets out a jet of speed v = √(2Δp/ρ) (ideal fluid), so Q = 11·a·v and
 * u = Q / S. Water: 20 kPa → v ≈ 6.3 m/s, u ≈ 5.5 cm/s (shown 2× slower).
 * Air: v ≈ 180 m/s and the piston would be in within a tenth of a second,
 * so the gas run is shown 50× slower. Only the added pressure is drawn: the
 * water's own weight adds ρgΔh ≈ 1.2 kPa from the top to the bottom hole
 * (next lesson, p = ρgh), which the note under the bars mentions.
 */

const HOLES = Array.from({ length: 11 }, (_, i) => (i - 5) * 30); // degrees, 0 = right, CCW
const WALL_ARROWS = [-135, -105, -75, -45, -15, 15, 45, 75, 105, 135];
const HOLE_A = Math.PI * 0.0005 ** 2; // m², a 1 mm hole
const RHO = { water: 1000, gas: 1.2 };
const SLOW = { water: 2, gas: 50 };
const STROKE = 0.16; // m
const AREAS = [5, 10, 20]; // cm²
const R = 0.06; // m, sphere radius
const BC = 0.07; // m, sphere centre x
const CYL0 = -0.255; // m, cylinder bottom (left end, inside)
const CYL1 = -0.004; // m, cylinder mouth (neck starts)
const NECK_R = 0.009;
const XP0 = -0.212; // m, piston face at the start
const PISTON_T = 0.012;
const BOX = { x0: -0.405, x1: 0.245, y0: -0.138, y1: 0.138 };

const IDLE = { x: 0, t: 0, running: false, done: false };

export default function BallSim({ T }) {
  const Bt = T.ball;
  const dec = T.decimal;
  const [medium, setMedium] = useState('water');
  const [area, setArea] = useState(10);
  const [F, setF] = useState(20);
  const [sim, setSim] = useState(IDLE);
  const S = area * 1e-4;
  const dpSet = F / S;
  const pressing = sim.running && F > 0;
  const dp = pressing ? dpSet : 0;

  useRafLoop(sim.running, (dt) => {
    setSim((s) => {
      if (!s.running) return s;
      const v = Math.sqrt((2 * dpSet) / RHO[medium]);
      const u = (HOLES.length * HOLE_A * v) / S;
      const x = s.x + (u * dt) / SLOW[medium];
      if (x >= STROKE) return { ...s, x: STROKE, t: s.t + dt, running: false, done: true };
      return { ...s, x, t: s.t + dt };
    });
  });

  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((s) => ({ ...s, running: !s.running }));
  };
  const reset = () => setSim(IDLE);
  const pickMedium = (m) => {
    setMedium(m);
    setSim(IDLE);
  };
  const pickArea = (a) => {
    setArea(a);
    setSim(IDLE);
  };

  /* ---- words */
  const V = S * sim.x; // m³ pushed out
  const Vcm = V * 1e6;
  const dpT = fmtP(dpSet, T);
  let key = 'idle';
  if (sim.done) key = medium === 'water' ? 'doneWater' : 'doneGas';
  else if (sim.running) key = F <= 0 ? 'zero' : medium === 'water' ? 'runWater' : 'runGas';
  else if (sim.x > 0) key = 'paused';
  const settled = useSettled(`${key}|${F}|${area}`, key === 'idle' || key.startsWith('done') ? 0 : 280);
  const [sKey, sF, sA] = settled.split('|');
  const sDp = fmtP(Number(sF) / (Number(sA) * 1e-4), T);
  const ex = Bt.explain;
  const text = {
    idle: ex.idle,
    zero: ex.zero,
    runWater: ex.runWater(`${sF} ${T.N}`, `${sA} ${T.cm2}`, sDp),
    runGas: ex.runGas(sDp),
    paused: ex.paused,
    doneWater: ex.doneWater(sig(STROKE * Number(sA) * 100, 3, dec)),
    doneGas: ex.doneGas(sig(STROKE * Number(sA) * 100, 3, dec)),
  }[sKey];
  const tone = { idle: '#22d3ee', zero: '#94a3b8', runWater: '#60a5fa', runGas: '#cbd5e1', paused: '#fbbf24', doneWater: '#34d399', doneGas: '#34d399' }[sKey];
  const pp = pressureParts(dp, T);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
          <div>
            <GroupLabel>{Bt.mediumLabel}</GroupLabel>
            <Segmented
              label={Bt.mediumLabel}
              className="grid-cols-2"
              size="lg"
              value={medium}
              onChange={pickMedium}
              options={[
                { value: 'water', label: Bt.media.water.name, sub: Bt.media.water.sub, icon: Droplets },
                { value: 'gas', label: Bt.media.gas.name, sub: Bt.media.gas.sub, icon: CloudFog },
              ]}
            />
          </div>
          <div>
            <GroupLabel>{Bt.areaLabel}</GroupLabel>
            <Segmented
              label={Bt.areaLabel}
              className="grid-cols-3"
              size="lg"
              accent="#a78bfa"
              value={area}
              onChange={pickArea}
              options={AREAS.map((a) => ({ value: a, label: `${a} ${T.cm2}`, sub: `Δp = ${fmtP(F / (a * 1e-4), T)}` }))}
            />
          </div>
        </div>
        <PlayControls labels={Bt.controls} running={sim.running} done={sim.done} started={sim.x > 0 || sim.running} onToggle={toggle} onReset={reset} />
      </div>

      <BallScene T={T} medium={medium} area={area} F={F} dp={dp} sim={sim} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={Bt.readouts.F} symbol="F" value={sig(F, 3, dec)} unit={T.N} accent={COL.force} textColor={COL.forceText} sub={pressing ? Bt.readouts.Fon : Bt.readouts.Foff} active={pressing} />
        <Readout label={Bt.readouts.S} symbol="S" value={sig(area, 3, dec)} unit={T.cm2} accent={COL.area} textColor={COL.areaText} sub={`= ${sig(S, 3, dec)} ${T.m2}`} />
        <Readout
          label={Bt.readouts.dp}
          symbol="Δp"
          value={pp.v}
          unit={pp.u}
          accent={COL.press}
          textColor={COL.pressText}
          sub={pressing ? Bt.readouts.dpSub(pp.pa ?? `${pp.v} ${pp.u}`) : Bt.readouts.dpOff(dpT)}
          active={pressing}
        />
        <Readout label={Bt.readouts.V} symbol="V" value={sig(Vcm, 3, dec)} unit={T.cm3} accent={COL.depth} textColor={COL.depthText} sub={Bt.readouts.Vsub(sig(area, 3, dec), sig(sim.x * 100, 2, dec))} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField
            id="pl-ballF"
            label={Bt.Flabel}
            symbol="F"
            min={0}
            max={50}
            step={1}
            value={F}
            onChange={setF}
            accent={COL.force}
            display={`${F} ${T.N}`}
            hint={Bt.Fhint}
          />
          <Formula sym="Δp = F / S" nums={`= ${F} ${T.N} / ${sig(S, 3, dec)} ${T.m2} =`} result={dpT} note={Bt.formulaNote} />
          <p className="text-[11px] leading-snug text-gray-500">{Bt.law}</p>
        </Panel>
        <Panel className="lg:col-span-3">
          <HoleBars T={T} dp={dp} dpSet={dpSet} medium={medium} />
        </Panel>
      </div>
    </div>
  );
}

/* ================================================================= scene */

function BallScene({ T, medium, area, F, dp, sim }) {
  const Bt = T.ball;
  const water = medium === 'water';
  return (
    <LabScene
      legend={[
        { color: COL.force, label: Bt.legend.F, kind: 'arrow' },
        { color: COL.press, label: Bt.legend.dp, kind: 'arrow' },
        { color: water ? '#2563eb' : '#64748b', label: water ? Bt.legend.jet : Bt.legend.smoke, kind: 'jet' },
      ]}
      chips={(W, narrow, H) => {
        const view = ballView(W, H, narrow);
        const kp = (0.3 * R * view.k) / 20000;
        const step = niceStep(kp, 24);
        return (
          <>
            <Chip icon={Timer}>{Bt.chip(SLOW[medium])}</Chip>
            {!narrow && <ScaleChip px={step * kp} text={fmtP(step, T)} label={Bt.scale} />}
          </>
        );
      }}
      height={(W, narrow) => (narrow ? clamp(W * 0.62 + 40, 260, 340) : 452)}
      ariaLabel={Bt.sceneLabel(Bt.media[medium].name, F, area, fmtP(dp, T))}
    >
      {(W, H, narrow) => <BallDrawing T={T} W={W} H={H} narrow={narrow} medium={medium} area={area} F={F} dp={dp} sim={sim} />}
    </LabScene>
  );
}

function ballView(W, H, narrow) {
  return makeView(BOX, W, H, narrow ? { l: 6, r: 6, t: 44, b: 8 } : { l: 20, r: 20, t: 58, b: 16 });
}

function BallDrawing({ T, W, H, narrow, medium, area, F, dp, sim }) {
  const Bt = T.ball;
  const uid = useId().replace(/:/g, '');
  const view = ballView(W, H, narrow);
  const k = view.k;
  const water = medium === 'water';
  const rc = Math.sqrt((area * 1e-4) / Math.PI); // inner radius of the cylinder
  const wall = 0.0025;
  const xp = XP0 + sim.x; // piston face
  const cx = view.sx(BC);
  const cy = view.sy(0);
  const Rp = R * k;
  const fs = narrow ? 10.5 : 12;
  const box = { w: W, h: H };
  const fluid = water ? '#60a5fa' : '#cbd5e1';
  const fluidOp = water ? 0.42 : 0.55;
  const kp = (0.3 * Rp) / 20000;
  const Lp = dp * kp;
  const cap = Rp * 1.15;
  const t = sim.t;
  const strength = Math.sqrt(dp / 20000);
  const jetL = Math.min(Rp * 1.6, Rp * 0.85 * strength);

  /* jets or puffs from every hole */
  const jets = [];
  if (dp > 0) {
    HOLES.forEach((deg, i) => {
      const a = (deg * Math.PI) / 180;
      const ux = Math.cos(a);
      const uy = -Math.sin(a);
      const x0 = cx + ux * Rp;
      const y0 = cy + uy * Rp;
      const nx = -uy;
      const ny = ux;
      if (water) {
        const w0 = narrow ? 2 : 3;
        const x1 = x0 + ux * jetL;
        const y1 = y0 + uy * jetL;
        jets.push(
          <g key={deg}>
            <path d={`M${x0 + nx * w0},${y0 + ny * w0} L${x1 + nx * 1.2},${y1 + ny * 1.2} L${x1 - nx * 1.2},${y1 - ny * 1.2} L${x0 - nx * w0},${y0 - ny * w0} Z`} fill="#3b82f6" opacity="0.85" />
            <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="#bfdbfe" strokeWidth="1" strokeDasharray="4 7" strokeDashoffset={-((t * 60) % 11)} />
            {[0, 1, 2, 3].map((j) => {
              const ph = (t * 1.6 + j / 4 + i * 0.13) % 1;
              const d = jetL + ph * Rp * 0.55;
              const off = Math.sin((i * 7 + j * 3) * 1.7) * 3 * ph;
              return <circle key={j} cx={x0 + ux * d + nx * off} cy={y0 + uy * d + ny * off} r={(narrow ? 1.5 : 2.2) * (1 - ph * 0.4)} fill="#3b82f6" opacity={0.8 * (1 - ph)} />;
            })}
          </g>,
        );
      } else {
        jets.push(
          <g key={deg}>
            {[0, 1, 2, 3, 4].map((j) => {
              const ph = (t * 0.9 + j / 5 + i * 0.07) % 1;
              const d = 3 + ph * (jetL + Rp * 0.5);
              const r = (narrow ? 2 : 3) + ph * (narrow ? 6 : 9) * Math.max(0.6, strength);
              return <circle key={j} cx={x0 + ux * d} cy={y0 + uy * d} r={r} fill="#64748b" opacity={0.42 * (1 - ph)} />;
            })}
          </g>,
        );
      }
    });
  }

  /* Δp arrows on the outside of every wall, all the same length */
  const pArrows = [];
  if (dp > 0) {
    WALL_ARROWS.forEach((deg) => {
      const a = (deg * Math.PI) / 180;
      const ux = Math.cos(a);
      const uy = -Math.sin(a);
      pArrows.push(<CapArrow key={`s${deg}`} x={cx + ux * (Rp + 3)} y={cy + uy * (Rp + 3)} ux={ux} uy={uy} len={Lp} cap={cap} color={COL.press} width={narrow ? 1.8 : 2.4} head={narrow ? 7 : 9} />);
    });
    const xs = [xp + 0.035, (xp + 0.035 + CYL1 - 0.02) / 2, CYL1 - 0.02].filter((x, i, arr) => x > xp + 0.015 && (i === 0 || x - arr[i - 1] > 0.025));
    xs.forEach((x) => {
      [1, -1].forEach((s) => {
        pArrows.push(<CapArrow key={`c${x}${s}`} x={view.sx(x)} y={view.sy(s * (rc + wall)) - s * 3} ux={0} uy={-s} len={Lp} cap={cap} color={COL.press} width={narrow ? 1.8 : 2.4} head={narrow ? 7 : 9} />);
      });
    });
  }

  /* smoke blobs inside (gas) */
  const blobs = !water
    ? Array.from({ length: 18 }, (_, i) => {
        const inBall = i < 12;
        const ang = i * 2.4 + t * 0.4;
        const rr = inBall ? (0.25 + ((i * 37) % 10) / 14) * R * 0.85 : 0;
        const x = inBall ? BC + Math.cos(ang) * rr : xp + 0.02 + (((i - 12) * 0.031 + t * 0.004) % Math.max(0.02, CYL1 - xp - 0.03));
        const y = inBall ? Math.sin(ang) * rr : Math.sin(i * 1.9 + t) * rc * 0.5;
        return <circle key={i} cx={view.sx(x)} cy={view.sy(y)} r={(inBall ? 0.011 : rc * 0.5) * k} fill="#94a3b8" opacity="0.28" />;
      })
    : null;

  /* force arrow on the handle */
  const handleX = view.sx(xp - PISTON_T - 0.115);
  const LF = F > 0 ? clamp((F / 20) * (narrow ? 40 : 56), 10, narrow ? 80 : 120) : 0;
  const glass = '#64748b';

  return (
    <>
      <defs>
        <radialGradient id={`${uid}g`} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.75" />
          <stop offset="0.35" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* stand */}
      <rect x={view.sx(-0.2)} y={view.sy(-rc - wall)} width={0.02 * k} height={view.sy(-0.125) - view.sy(-rc - wall)} fill="#cbd5e1" />
      <rect x={view.sx(-0.06)} y={view.sy(-rc - wall)} width={0.02 * k} height={view.sy(-0.125) - view.sy(-rc - wall)} fill="#cbd5e1" />
      <rect x={view.sx(-0.26)} y={view.sy(-0.125)} width={0.3 * k} height={0.008 * k} rx={2} fill="#94a3b8" />

      {/* fluid: cylinder (right of the piston), neck, sphere */}
      <rect x={view.sx(xp)} y={view.sy(rc)} width={view.sx(CYL1) - view.sx(xp)} height={2 * rc * k} fill={fluid} opacity={fluidOp} />
      <rect x={view.sx(CYL1 - 0.002)} y={view.sy(NECK_R)} width={view.sx(BC - R + 0.004) - view.sx(CYL1 - 0.002)} height={2 * NECK_R * k} fill={fluid} opacity={fluidOp} />
      <circle cx={cx} cy={cy} r={Rp} fill={fluid} opacity={fluidOp} />
      {blobs}

      {/* glass: cylinder walls, neck, sphere with holes */}
      <rect x={view.sx(CYL0)} y={view.sy(rc + wall)} width={view.sx(CYL1) - view.sx(CYL0)} height={wall * k} fill={glass} />
      <rect x={view.sx(CYL0)} y={view.sy(-rc)} width={view.sx(CYL1) - view.sx(CYL0)} height={wall * k} fill={glass} />
      <line x1={view.sx(CYL1)} y1={view.sy(rc + wall)} x2={view.sx(CYL1)} y2={view.sy(NECK_R + wall)} stroke={glass} strokeWidth={wall * k} />
      <line x1={view.sx(CYL1)} y1={view.sy(-rc - wall)} x2={view.sx(CYL1)} y2={view.sy(-NECK_R - wall)} stroke={glass} strokeWidth={wall * k} />
      <line x1={view.sx(CYL1)} y1={view.sy(NECK_R + wall / 2)} x2={view.sx(BC - R + 0.003)} y2={view.sy(NECK_R + wall / 2)} stroke={glass} strokeWidth={wall * k} />
      <line x1={view.sx(CYL1)} y1={view.sy(-NECK_R - wall / 2)} x2={view.sx(BC - R + 0.003)} y2={view.sy(-NECK_R - wall / 2)} stroke={glass} strokeWidth={wall * k} />
      <circle cx={cx} cy={cy} r={Rp} fill={`url(#${uid}g)`} stroke={glass} strokeWidth={Math.max(2, wall * k)} />
      {HOLES.map((deg) => {
        const a = (deg * Math.PI) / 180;
        return <circle key={deg} cx={cx + Math.cos(a) * Rp} cy={cy - Math.sin(a) * Rp} r={narrow ? 2 : 3} fill="#0f172a" />;
      })}

      {/* piston, rod and handle */}
      <rect x={view.sx(xp - PISTON_T)} y={view.sy(rc)} width={PISTON_T * k} height={2 * rc * k} rx={2} fill="#334155" />
      <rect x={view.sx(xp - PISTON_T - 0.11)} y={view.sy(0.003)} width={0.11 * k} height={0.006 * k} fill="#94a3b8" stroke="#64748b" strokeWidth="0.8" />
      <rect x={handleX - 0.008 * k} y={view.sy(0.032)} width={0.009 * k} height={0.064 * k} rx={3} fill="#475569" />

      {pArrows}
      {jets}

      {F > 0 && (
        <>
          <CapArrow x={handleX - 0.01 * k - LF} y={cy} ux={1} uy={0} len={LF} color={COL.force} width={narrow ? 3 : 3.6} head={narrow ? 10 : 12} />
          <Label x={handleX - 0.01 * k - LF / 2} y={cy - (narrow ? 10 : 13)} color={COL.force} fs={fs + 1}>
            {`F = ${F} ${T.N}`}
          </Label>
        </>
      )}
      <Label x={view.sx(xp - PISTON_T / 2)} y={view.sy(-rc) + (narrow ? 14 : 18)} color={COL.area} fs={fs}>
        {`S = ${area} ${T.cm2}`}
      </Label>
      {dp > 0 && (
        <Tag x={cx} y={view.sy(-R) + Math.min(Lp, cap) + (narrow ? 16 : 22)} text={`Δp = ${fmtP(dp, T)}`} color={COL.press} fs={fs} box={box} />
      )}
      {dp <= 0 && !narrow && (
        <Label x={cx} y={view.sy(-R) + 22} color={COL.muted} fs={fs} weight={600}>
          {Bt.holes}
        </Label>
      )}
    </>
  );
}

/* ================================================================== bars */

/** One bar per hole: the added pressure at each, all equal. */
function HoleBars({ T, dp, dpSet, medium }) {
  const Bt = T.ball;
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 260);
  const H = 190;
  const pad = { l: 46, r: 12, t: 22, b: 34 };
  const yMax = niceCeil(Math.max(dpSet, 10000) * 1.2);
  const n = HOLES.length;
  const cw = (W - pad.l - pad.r) / n;
  const bw = Math.min(26, cw * 0.62);
  const gy = (v) => H - pad.b - (v / yMax) * (H - pad.t - pad.b);
  const ticks = [0, 0.5, 1].map((f) => f * yMax);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-sm font-semibold text-gray-200">{Bt.bars.title}</p>
        <span className="text-xs text-gray-400">{dp > 0 ? Bt.bars.all(fmtP(dp, T)) : Bt.bars.none}</span>
      </div>
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={Bt.bars.label(fmtP(dp, T))} className="block">
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={gy(v)} y2={gy(v)} stroke={v === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'} />
              <text x={pad.l - 6} y={gy(v) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                {sig(v / 1000, 3, T.decimal)}
              </text>
            </g>
          ))}
          <text x={pad.l + 4} y={pad.t - 8} fontSize="11" fill="#64748b">
            {Bt.bars.y}
          </text>
          {dp > 0 && <line x1={pad.l} x2={W - pad.r} y1={gy(dp)} y2={gy(dp)} stroke={COL.press} strokeDasharray="4 4" strokeWidth="1.2" />}
          {HOLES.map((deg, i) => {
            const x = pad.l + cw * (i + 0.5);
            const a = (deg * Math.PI) / 180;
            const ux = Math.cos(a);
            const uy = -Math.sin(a);
            const ay = H - pad.b + 16;
            return (
              <g key={deg}>
                <rect x={x - bw / 2} y={gy(dp)} width={bw} height={Math.max(0, gy(0) - gy(dp))} rx={3} fill={medium === 'water' ? '#3b82f6' : '#94a3b8'} opacity="0.85" />
                <line x1={x - ux * 7} y1={ay - uy * 7} x2={x + ux * 4} y2={ay + uy * 4} stroke="#cbd5e1" strokeWidth="1.6" />
                <path d={`M${x + ux * 8},${ay + uy * 8} L${x + ux * 3 - uy * 3.5},${ay + uy * 3 + ux * 3.5} L${x + ux * 3 + uy * 3.5},${ay + uy * 3 - ux * 3.5} Z`} fill="#cbd5e1" />
              </g>
            );
          })}
        </svg>
      </div>
      <p className="mt-1 text-xs text-gray-500">{medium === 'water' ? Bt.bars.noteWater : Bt.bars.noteGas}</p>
    </div>
  );
}

function niceCeil(v) {
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v - 1e-9) return m * p;
  return 10 * p;
}
