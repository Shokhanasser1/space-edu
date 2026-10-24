import { useState } from 'react';
import { ArrowDownToLine, ArrowUpToLine, CircleSlash, Crosshair, Lightbulb } from 'lucide-react';

import { Explain, Pill, RangeField, Readout, Segmented, fmt, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE, TimeGraph } from '../kit/scene';
import {
  Ball,
  BallDefs,
  Building as Tower,
  COL,
  Chip,
  FormulaTile,
  G,
  GroupLabel,
  LabScene,
  LaunchPad,
  PlayControls,
  Rich,
  SLOW,
  VArrow,
  VerticalPaper,
  ceilTo,
  curvePoints,
  makeVView,
  num,
} from './VerticalMotion.parts';

/**
 * Tab 3 — two bodies at once: A is dropped from a tower of height H, B is
 * thrown straight up from the ground under it with v₀. Both fall with the
 * same g, so the gap between them shrinks evenly, d = H − v₀·t, and they
 * meet at t = H/v₀, at the height h = H − g·t²/2 — in the air only if
 * v₀ ≥ √(gH/2). Preset H = 20 m, v₀ = 20 m/s → t = 1.00 s, h = 15.1 m.
 */

const PRESETS = [
  { id: 'base', H: 20, v0: 20, icon: Crosshair },
  { id: 'top', H: 40, v0: 20, icon: ArrowUpToLine },
  { id: 'low', H: 45, v0: 15, icon: ArrowDownToLine },
  { id: 'miss', H: 45, v0: 10, icon: CircleSlash },
];
const IDLE = { t: 0, running: false, done: false, metPaused: false };

/** Everything about one setting (H, v₀) that does not depend on time. */
function plan(H, v0) {
  const tA = Math.sqrt((2 * H) / G);
  const tB = (2 * v0) / G;
  const tMeet = H / v0;
  const canMeet = tMeet <= Math.min(tA, tB) + 1e-9;
  return {
    tA,
    tB,
    tEnd: Math.max(tA, tB),
    tMeet,
    canMeet,
    hMeet: H - 0.5 * G * tMeet * tMeet,
    vMin: Math.sqrt((G * H) / 2),
    hA: (t) => (t >= tA ? 0 : H - 0.5 * G * t * t),
    hB: (t) => (t >= tB ? 0 : Math.max(0, v0 * t - 0.5 * G * t * t)),
    vA: (t) => (t >= tA ? 0 : -G * t),
    vB: (t) => (t >= tB ? 0 : v0 - G * t),
  };
}

export default function MeetSim({ T }) {
  const L = T.meet;
  const dec = T.decimal;
  const [H, setH] = useState(20);
  const [v0, setV0] = useState(20);
  const [sim, setSim] = useState(IDLE);
  const P = plan(H, v0);

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(P.tEnd, p.t + dt * SLOW);
      if (P.canMeet && !p.metPaused && p.t < P.tMeet && t >= P.tMeet) return { ...p, t: P.tMeet, running: false, metPaused: true };
      const done = t >= P.tEnd - 1e-9;
      return { ...p, t, running: !done, done };
    });
  });

  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);
  const pick = (id) => {
    const p = PRESETS.find((x) => x.id === id);
    setH(p.H);
    setV0(p.v0);
    setSim(IDLE);
  };
  const pickH = (value) => {
    setH(value);
    setSim(IDLE);
  };
  const pickV0 = (value) => {
    setV0(value);
    setSim(IDLE);
  };
  const tAir = Math.min(P.tA, P.tB);
  const scrub = (x) => {
    const t = Math.min(P.tEnd, Math.max(0, x));
    setSim({ t, running: false, done: t >= P.tEnd - 1e-9, metPaused: t >= P.tMeet });
  };

  const t = sim.t;
  const hA = P.hA(t);
  const hB = P.hB(t);
  const d = hA - hB;
  const met = P.canMeet && t >= P.tMeet - 1e-9;
  const F = (n, k = 1) => num(n, k, dec);

  /* ---- explanation */
  let key = 'idle';
  if (met) key = 'met';
  else if (sim.done) key = 'nomeet';
  else if (t > 0) key = 'approach';
  const settled = useSettled(key, 0);
  const ex = L.explain;
  let text = ex.idle;
  if (settled === 'approach') text = ex.approach(F(v0, 0));
  else if (settled === 'met') {
    const vB = P.vB(P.tMeet);
    text = ex.met(F(P.tMeet, 2), F(P.hMeet), F(G * P.tMeet), F(Math.abs(vB)), vB >= 0 ? ex.dirs.up : ex.dirs.down);
  } else if (settled === 'nomeet') text = ex.nomeet(F(P.tB, 2), F(P.tA, 2), F(P.vMin));
  const tone = { idle: '#22d3ee', approach: '#a78bfa', met: '#34d399', nomeet: '#f87171' }[settled] ?? '#22d3ee';
  const preset = PRESETS.find((p) => p.H === H && p.v0 === v0)?.id ?? null;

  /* ---- d(t) graph: straight while both bodies are in the air */
  const span = Math.max(H, Math.abs(H - v0 * tAir));
  const yMax = ceilTo(span, span > 40 ? 20 : 10);
  const dPlan = [
    { x: 0, y: H },
    { x: tAir, y: H - v0 * tAir },
  ];
  const tc = Math.min(t, tAir);
  const vSpan = ceilTo(Math.max(v0, G * tAir), 10);
  const dNow = [
    { x: 0, y: H },
    { x: tc, y: H - v0 * tc },
  ];

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
            options={PRESETS.map((p) => ({ value: p.id, label: L.presets[p.id].name, sub: L.presets[p.id].sub, icon: p.icon }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <MeetScene T={T} H={H} v0={v0} P={P} t={t} running={sim.running} met={met} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.t} symbol="t" value={fmt(t, 2, dec)} unit={T.s} accent={PALETTE.time} textColor="#a5f3fc" sub={T.chipSlow} />
        <Readout label={L.readouts.hA} symbol="A" value={F(hA)} unit={T.m} accent={COL.ballA} textColor={PALETTE.secondText} sub={L.vSub(F(P.vA(t)))} />
        <Readout label={L.readouts.hB} symbol="B" value={F(hB)} unit={T.m} accent={COL.ballB} textColor={PALETTE.dispText} sub={L.vSub(F(P.vB(t)))} />
        <Readout label={L.readouts.d} symbol="d" value={F(d)} unit={T.m} accent="#a78bfa" textColor="#c4b5fd" sub={L.dSub(F(v0, 0))} active={met && Math.abs(t - P.tMeet) < 1e-6} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="vm-meet-h"
            label={L.H}
            symbol="H"
            min={10}
            max={60}
            step={1}
            value={H}
            onChange={pickH}
            accent={COL.ballA}
            display={`${fmt(H, 0, dec)} ${T.m}`}
          />
          <RangeField
            id="vm-meet-v0"
            label={L.v0}
            symbol={<Rich>v₀</Rich>}
            min={5}
            max={30}
            step={1}
            value={v0}
            onChange={pickV0}
            accent={COL.ballB}
            display={`${fmt(v0, 0, dec)} ${T.ms}`}
            valueText={`${fmt(v0, 0, dec)} ${T.ms}`}
          />
          <FormulaTile tag={L.f.t} color="#a5f3fc" general="t = H / v₀" filled={`t = ${fmt(H, 0, dec)} / ${fmt(v0, 0, dec)} = ${F(P.tMeet, 2)} ${T.s}`} ok={met} />
          <FormulaTile
            tag={L.f.h}
            color={PALETTE.secondText}
            general="h = H − g·t²/2"
            filled={P.canMeet ? `h = ${fmt(H, 0, dec)} − ${F(G)} · ${F(P.tMeet, 2)}² / 2 = ${F(P.hMeet)} ${T.m}` : L.f.none}
            ok={met}
          />
          <FormulaTile
            tag={L.f.cond}
            color="#c4b5fd"
            general="v₀ ≥ √(gH/2)"
            filled={`√(${F(G)} · ${fmt(H, 0, dec)} / 2) = ${F(P.vMin)} ${T.ms} — ${P.canMeet ? L.f.yes : L.f.no}`}
          />
        </div>
        <div className="lg:col-span-3 space-y-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <TimeGraph
            title={L.graph.title}
            series={[
              { id: 'plan', label: L.graph.plan, color: 'rgba(196,181,253,0.4)', dash: '5 6', dot: false, points: dPlan },
              { id: 'd', label: 'd(t)', color: '#c4b5fd', points: dNow },
            ]}
            xMax={tAir}
            yMax={yMax}
            yMin={-yMax}
            xDigits={2}
            yDigits={0}
            xLabel={L.graph.x}
            yLabel={L.graph.y}
            marker={t}
            decimal={dec}
            height={180}
            ariaLabel={L.graph.label}
            onScrub={scrub}
            note={L.graph.note}
          />
          <TimeGraph
            title={L.vgraph.title}
            series={[
              { id: 'vA', label: L.vgraph.a, color: PALETTE.secondText, points: [{ x: 0, y: 0 }, { x: tc, y: -G * tc }] },
              { id: 'vB', label: L.vgraph.b, color: PALETTE.dispText, points: [{ x: 0, y: v0 }, { x: tc, y: v0 - G * tc }] },
            ]}
            xMax={tAir}
            yMax={vSpan}
            yMin={-vSpan}
            xDigits={2}
            yDigits={0}
            xLabel={L.graph.x}
            yLabel={L.vgraph.y}
            marker={t}
            decimal={dec}
            height={160}
            ariaLabel={L.vgraph.label}
            onScrub={scrub}
            note={L.vgraph.note(F(v0, 0))}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

function MeetScene({ T, H, v0, P, t, running, met }) {
  const L = T.meet;
  const S = T.scene;
  const dec = T.decimal;
  const HB = (v0 * v0) / (2 * G);
  const tMax = ceilTo(P.tEnd + 0.08, 0.5);
  const hA = P.hA(t);
  const hB = P.hB(t);

  return (
    <LabScene
      legend={[
        { color: COL.ballA, label: L.legendA, kind: 'dot' },
        { color: COL.ballB, label: L.legendB, kind: 'dot' },
        { color: PALETTE.vel, label: S.legend.v, kind: 'arrow' },
        { color: PALETTE.acc, label: S.legend.g, kind: 'arrow' },
      ]}
      chips={
        <Chip>
          <span className="hidden sm:inline">{T.chipSlow}</span>
          <span className="sm:hidden">{T.chipSlowShort}</span> · t = {fmt(t, 2, dec)} {T.s}
        </Chip>
      }
      height={(W, narrow) => (narrow ? 440 : 500)}
      ariaLabel={L.sceneLabel(fmt(t, 2, dec), num(hA, 1, dec), num(hB, 1, dec))}
    >
      {(W, H2, narrow) => {
        const fs = narrow ? 11 : 12;
        const r = narrow ? 8 : 10;
        const ruler = narrow ? 30 : 50;
        const towerX0 = ruler + (narrow ? 10 : 18);
        const towerW = narrow ? 36 : 70;
        const towerX1 = towerX0 + towerW;
        const xA = towerX1 + (narrow ? 26 : 38);
        const xB = xA + (narrow ? 34 : 48);
        const view = makeVView({ W, H: H2, narrow, hTop: Math.max(H, HB) * 1.12 + 0.4, tMax, ruler, plot0: xB + (narrow ? 44 : 96) });
        const { gy, gx, groundY, padT } = view;
        const box = { w: W, h: H2 };
        const vMax = Math.max(v0, G * P.tA);
        const vk = Math.min((groundY - padT) * 0.26, 100) / vMax;
        const gLen = narrow ? 24 : 30;
        const yA = gy(hA);
        const yB = gy(hB);
        const airA = t > 0 && t < P.tA;
        const airB = t > 0 && t < P.tB;
        const vA = P.vA(t);
        const vB = P.vB(t);
        const cA = curvePoints(P.hA, 0, Math.min(t, P.tA), view);
        const cB = curvePoints(P.hB, 0, Math.min(t, P.tB), view);
        // highest point B has reached so far, for its trail
        const tTopB = Math.min(t, v0 / G);
        const hBmax = P.hB(tTopB);
        const mY = gy(P.hMeet);

        return (
          <>
            <BallDefs />
            <VerticalPaper view={view} W={W} H={H2} fs={fs} decimal={dec} labels={{ ...S, plot: L.plot }} />
            <Tower x0={towerX0} w={towerW} topY={gy(H)} groundY={groundY} floors={Math.max(2, Math.round(H / 3.2))} />
            <rect x={towerX1 - 2} y={gy(H)} width={xA - towerX1 + r + 4} height={5} rx={2} fill="#64748b" />
            {!narrow && <Pill x={towerX0 + towerW / 2} y={(gy(H) + groundY) / 2} text={L.HTag(fmt(H, 0, dec))} bg={PALETTE.ink} size={fs} box={box} />}
            <LaunchPad x={xB} y={groundY} r={r} />
            {/* trails */}
            <line x1={xA} x2={xA} y1={gy(H)} y2={yA} stroke={COL.ballA} strokeOpacity="0.3" strokeWidth={4} strokeLinecap="round" />
            {t > 0 && <line x1={xB} x2={xB} y1={groundY} y2={gy(hBmax)} stroke={COL.ballB} strokeOpacity="0.3" strokeWidth={4} strokeLinecap="round" />}

            {/* h(t) of both bodies */}
            <polyline points={curvePoints(P.hA, 0, P.tA, view)} fill="none" stroke={COL.ballA} strokeOpacity="0.3" strokeWidth={2} strokeDasharray="5 6" />
            <polyline points={curvePoints(P.hB, 0, P.tB, view)} fill="none" stroke={COL.ballB} strokeOpacity="0.3" strokeWidth={2} strokeDasharray="5 6" />
            {cA && <polyline points={cA} fill="none" stroke={COL.ballA} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />}
            {cB && <polyline points={cB} fill="none" stroke={COL.ballB} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />}
            <line x1={xA + r + 2} x2={gx(Math.min(t, P.tA))} y1={yA} y2={yA} stroke={COL.ballA} strokeOpacity="0.45" strokeWidth={1} strokeDasharray="3 4" />
            <line x1={xB + r + 2} x2={gx(Math.min(t, P.tB))} y1={yB} y2={yB} stroke={COL.ballB} strokeOpacity="0.45" strokeWidth={1} strokeDasharray="3 4" />
            <circle cx={gx(Math.min(t, P.tA))} cy={yA} r={4.5} fill={COL.ballA} stroke="#fff" strokeWidth={2} />
            <circle cx={gx(Math.min(t, P.tB))} cy={yB} r={4.5} fill={COL.ballB} stroke="#fff" strokeWidth={2} />

            {/* the meeting */}
            {met && (
              <g>
                <line x1={xA - r - 4} x2={gx(P.tMeet)} y1={mY} y2={mY} stroke="#059669" strokeWidth={1.5} strokeDasharray="6 4" />
                <line x1={gx(P.tMeet)} x2={gx(P.tMeet)} y1={mY} y2={groundY} stroke="#059669" strokeOpacity="0.6" strokeWidth={1} strokeDasharray="3 4" />
                <circle cx={gx(P.tMeet)} cy={mY} r={8} fill="none" stroke="#059669" strokeWidth={2} />
                {narrow ? (
                  <Pill
                    x={(view.plotX0 + view.plotX1) / 2}
                    y={mY + 24 < groundY - 14 ? mY + 24 : mY - 24}
                    text={L.meetTagShort(num(P.tMeet, 2, dec), num(P.hMeet, 1, dec))}
                    bg="#059669"
                    size={fs - 1}
                    box={box}
                  />
                ) : (
                  <Pill x={gx(P.tMeet)} y={mY - 22} text={L.meetTag(num(P.tMeet, 2, dec), num(P.hMeet, 1, dec))} bg="#059669" size={fs} box={box} />
                )}
              </g>
            )}

            {/* bodies and vectors */}
            <Ball cx={xA} y={yA} r={r} tone="pink" pulse={running && airA} letter="A" />
            <Ball cx={xB} y={yB} r={r} tone="blue" pulse={running && airB} letter="B" />
            {airA && (
              <>
                <VArrow x={xA - r - 8} y1={yA - r - gLen / 2} y2={yA - r + gLen / 2} color={PALETTE.acc} label="g" side={-1} fs={fs} width={2.4} head={8} />
                <VArrow x={xA} y1={yA} y2={yA - vA * vk} color={PALETTE.vel} label="v" side={-1} fs={fs} width={2.8} />
              </>
            )}
            {airB && (
              <>
                <VArrow x={xB + r + 8} y1={yB - r - gLen / 2} y2={yB - r + gLen / 2} color={PALETTE.acc} label="g" fs={fs} width={2.4} head={8} />
                <VArrow x={xB} y1={vB >= 0 ? yB - 2 * r : yB} y2={(vB >= 0 ? yB - 2 * r : yB) - vB * vk} color={PALETTE.vel} label="v" fs={fs} width={2.8} />
              </>
            )}
            {t === 0 && (
              <VArrow
                x={xB}
                y1={yB - 2 * r}
                y2={yB - 2 * r - v0 * vk}
                color={PALETTE.vel}
                label={
                  <>
                    v<tspan dy="4" fontSize={fs - 2}>0</tspan>
                  </>
                }
                fs={fs}
                width={2.8}
              />
            )}
          </>
        );
      }}
    </LabScene>
  );
}
