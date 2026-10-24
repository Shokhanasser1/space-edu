import { useState } from 'react';
import { Lightbulb, Wind } from 'lucide-react';
import { Explain, RangeField, Readout, Segmented, clamp, fmt, useElementSize, useRafLoop, useSettled } from '../kit/ui';
import { COL, Calc, G, Panel, PlayButtons, RichPill, SimScene, Tag, TimeChip, airDensity, intText, rich, ForceArrow } from './Archimedes.parts';

/**
 * A hot-air balloon. Air heated inside the envelope is lighter than the
 * air around it, so the lifting force is F = (ρ_cold − ρ_hot)·g·V - the
 * push of the outside air on the whole balloon minus the weight of the hot
 * air in it. With ρ = 1.29 kg/m³ · 273/(273 + t): at 20 °C outside and
 * 100 °C inside a 2000 m³ envelope lifts 5053 N; the balloon, basket and
 * burner (250 kg) and two people (80 kg each) weigh 4018 N, so it rises.
 *
 * Higher up the air gets thinner (an isothermal atmosphere: ρ ∝ e^(−h/H),
 * H = RT/(Mg) ≈ 8.6 km), the lift falls in proportion and the balloon stops
 * where F = mg: h* = H·ln(F₀/mg) ≈ 1965 m. It needs at least 80 °C inside to
 * leave the ground. A 2000 m³ envelope of helium would lift about 20 300 N.
 * Time is sped up 60×; the balloon is not drawn to scale.
 */

const V = 2000; // m³
const SHELL = 250; // kg: envelope, basket, burner and fuel
const PERSON = 80; // kg
const R_GAS = 8.314; // J/(mol·K)
const M_AIR = 0.029; // kg/mol
const SPEED = 60;
const RADIUS = Math.cbrt((3 * V) / (4 * Math.PI)); // 7.8 m
const AREA = Math.PI * RADIUS * RADIUS;
const RHO_HE0 = 0.18; // kg/m³ at 0 °C

function air(h, tIn, tOut, m) {
  const Hs = (R_GAS * (273 + tOut)) / (M_AIR * G);
  const rhoOut = airDensity(tOut) * Math.exp(-h / Hs);
  const rhoIn = (rhoOut * (273 + tOut)) / (273 + tIn);
  return { Hs, rhoOut, rhoIn, F: (rhoOut - rhoIn) * G * V, W: m * G };
}

function eqHeight(tIn, tOut, m) {
  const a = air(0, tIn, tOut, m);
  return a.F > a.W ? a.Hs * Math.log(a.F / a.W) : 0;
}

/** Lowest inside temperature (°C) that lifts the load off the ground. */
function minTemp(tOut, m) {
  const share = m / (airDensity(tOut) * V);
  return share >= 1 ? Infinity : (273 + tOut) / (1 - share) - 273;
}

const START = { h: 0, v: 0, flying: false, running: false, still: false, t: 0 };

function step(p, dt, tIn, tOut, m) {
  if (!p.running) return p;
  const T = dt * SPEED;
  const n = Math.max(1, Math.ceil(T / 0.05));
  const hh = T / n;
  let { h, v } = p;
  for (let i = 0; i < n; i += 1) {
    const a = air(h, tIn, tOut, m);
    const mEff = m + a.rhoIn * V + 0.5 * a.rhoOut * V;
    // quadratic air drag, plus a little linear damping so it settles at h*
    const drag = 0.5 * a.rhoOut * 0.5 * AREA * Math.abs(v) * v + 2 * Math.sqrt((a.W / a.Hs) * mEff) * v;
    v += ((a.F - a.W - drag) / mEff) * hh;
    h += v * hh;
    if (h <= 0) {
      h = 0;
      if (v < 0) v = 0;
    }
  }
  const a = air(h, tIn, tOut, m);
  const still = Math.abs(v) < 0.02 && (Math.abs(a.F - a.W) < 2 || (h <= 0 && a.F <= a.W));
  return { ...p, h, v: still ? 0 : v, still, t: p.t + T };
}

export default function BalloonSim({ T }) {
  const tx = T.ships.balloon;
  const U = T.u;
  const dec = T.decimal;
  const [tIn, setTIn] = useState(100);
  const [tOut, setTOut] = useState(20);
  const [people, setPeople] = useState(2);
  const [sim, setSim] = useState(START);
  const m = SHELL + PERSON * people;
  useRafLoop(sim.running && !sim.still, (dt) => setSim((p) => step(p, dt, tIn, tOut, m)));

  const wake = (p) => ({ ...p, still: false });
  const toggle = () => setSim((p) => ({ ...p, running: !p.running, flying: true, still: false }));
  const reset = () => setSim(START);
  const changeIn = (v) => {
    setTIn(v);
    setSim(wake);
  };
  const changeOut = (v) => {
    setTOut(v);
    setSim(wake);
  };
  const changePeople = (v) => {
    setPeople(v);
    setSim(wake);
  };

  const now = air(sim.h, tIn, tOut, m);
  const ground = air(0, tIn, tOut, m);
  const hEq = eqHeight(tIn, tOut, m);
  const tMin = minTemp(tOut, m);
  const lifts = ground.F > ground.W;
  const rhoHe = (RHO_HE0 * 273) / (273 + tOut);
  const FHe = (ground.rhoOut - rhoHe) * G * V;
  const n0 = (v) => intText(v);
  const r3 = (v) => fmt(v, 3, dec);

  /* words */
  let key;
  if (!sim.flying) key = lifts ? 'tetherUp' : 'tetherLow';
  else if (!sim.running) key = 'paused';
  else if (sim.h <= 0 && now.F <= now.W) key = 'ground';
  else if (Math.abs(now.F - now.W) < 0.01 * now.W) key = 'float';
  else key = now.F > now.W ? 'rise' : 'fall';
  const settled = useSettled(`${key}-${tIn}-${tOut}-${people}`, key === 'rise' || key === 'fall' ? 300 : 200);
  const sKey = settled.split('-')[0];
  const ex = tx.explain;
  let text;
  if (sKey === 'tetherUp') text = ex.tetherUp(tIn, r3(ground.rhoIn), r3(ground.rhoOut), n0(ground.F), n0(ground.W));
  else if (sKey === 'tetherLow') text = ex.tetherLow(n0(ground.F), n0(ground.W), Number.isFinite(tMin) ? fmt(tMin, 0, dec) : '—');
  else if (sKey === 'rise') text = ex.rise(n0(sim.h), n0(now.F), n0(now.W));
  else if (sKey === 'fall') text = ex.fall(n0(sim.h), n0(now.F), n0(now.W));
  else if (sKey === 'ground') text = ex.ground(n0(now.F), n0(now.W), Number.isFinite(tMin) ? fmt(tMin, 0, dec) : '—');
  else if (sKey === 'paused') text = ex.paused(n0(sim.h));
  else text = ex.float(n0(Math.round(sim.h / 5) * 5), n0(now.F));
  if (sKey === 'tetherUp' || sKey === 'float') text = `${text} ${ex.helium(n0(Math.round(FHe / 100) * 100), fmt(rhoHe, 2, dec))}`;
  const tone = { tetherUp: '#22d3ee', tetherLow: '#fbbf24', rise: '#34d399', fall: '#fb923c', ground: '#fbbf24', float: '#34d399', paused: '#94a3b8' }[sKey] ?? '#22d3ee';

  const legend = [
    { label: tx.legend.f, color: COL.fa, kind: 'arrow' },
    { label: tx.legend.mg, color: COL.mg, kind: 'arrow' },
    { label: tx.legend.eq, color: '#7c3aed', kind: 'dash' },
  ];

  const rows = [
    { sym: tx.sym.cold, color: '#93c5fd', formula: `1.29 · 273 / (273 + ${tOut})`, result: `${fmt(ground.rhoOut, 4, dec)} ${U.kgm3}` },
    { sym: tx.sym.hot, color: COL.pText, formula: `1.29 · 273 / (273 + ${tIn})`, result: `${fmt(ground.rhoIn, 4, dec)} ${U.kgm3}` },
    {
      sym: 'F',
      color: COL.faText,
      formula: `(${tx.sym.cold} − ${tx.sym.hot}) g V`,
      subst: `${fmt(ground.rhoOut - ground.rhoIn, 4, dec)} · 9.8 · ${V}`,
      result: `${n0(ground.F)} ${U.n}`,
    },
    { sym: 'mg', color: COL.mgText, formula: `(${SHELL} + ${people} · ${PERSON}) ${U.kg} · 9.8`, result: `${n0(ground.W)} ${U.n}` },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{tx.peopleLabel}</p>
          <Segmented
            label={tx.peopleLabel}
            className="grid-cols-2 sm:grid-cols-4"
            size="lg"
            value={people}
            onChange={changePeople}
            accent="#f472b6"
            options={[1, 2, 3, 4].map((k) => ({ value: k, label: tx.people(k), sub: `m = ${SHELL + PERSON * k} ${U.kg}` }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 xl:flex">
          <PlayButtons
            common={T.common}
            running={sim.running}
            label={sim.flying ? T.common.resume : tx.launch}
            icon={Wind}
            onToggle={toggle}
            onReset={reset}
            resetDisabled={!sim.flying}
          />
        </div>
      </div>

      <SimScene
        legend={legend}
        chip={<TimeChip text={T.common.faster(SPEED)} extra={tx.notToScale} />}
        ariaLabel={tx.sceneLabel(n0(sim.h), n0(now.F), n0(now.W), tIn, tOut)}
        height={(W, narrow) => (narrow ? clamp(W * 1.05, 340, 420) : clamp(W * 0.42, 400, 480))}
      >
        {(W, H, narrow) => <BalloonDrawing W={W} H={H} narrow={narrow} sim={sim} tIn={tIn} tOut={tOut} m={m} hEq={hEq} T={T} />}
      </SimScene>

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {rich(text)}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={tx.readouts.h}
          symbol="h"
          value={n0(sim.h)}
          unit={T.m}
          accent="#7c3aed"
          textColor="#c4b5fd"
          sub={lifts ? rich(tx.readouts.hSub(n0(Math.round(hEq / 5) * 5))) : tx.readouts.noLift}
        />
        <Readout label={tx.readouts.f} symbol="F" value={n0(now.F)} unit={U.n} accent={COL.fa} textColor={COL.faText} sub={rich(tx.readouts.fSub)} />
        <Readout label={tx.readouts.mg} symbol="mg" value={n0(now.W)} unit={U.n} accent={COL.mg} textColor={COL.mgText} sub={tx.readouts.mgSub(m, people)} />
        <Readout
          label={tx.readouts.rho}
          symbol={rich(tx.sym.cold)}
          value={r3(now.rhoOut)}
          unit={U.kgm3}
          accent="#38bdf8"
          textColor="#93c5fd"
          sub={rich(tx.readouts.rhoSub(r3(now.rhoIn)))}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="space-y-3 lg:col-span-2">
          <RangeField
            id="arx-tin"
            label={tx.tIn}
            symbol={rich('t_' + tx.sym.inSub)}
            min={0}
            max={120}
            step={1}
            value={tIn}
            onChange={changeIn}
            accent="#f97316"
            display={`${tIn} ${U.c}`}
            hint={Number.isFinite(tMin) ? tx.tInHint(fmt(tMin, 0, dec)) : ''}
          />
          <RangeField
            id="arx-tout"
            label={tx.tOut}
            symbol={rich('t_' + tx.sym.outSub)}
            min={-10}
            max={35}
            step={1}
            value={tOut}
            onChange={changeOut}
            accent="#38bdf8"
            display={`${tOut} ${U.c}`}
            hint={tx.tOutHint}
          />
          <Calc title={tx.calcTitle} rows={rows} />
        </Panel>
        <Panel className="lg:col-span-3">
          <LiftGraph T={T} tIn={tIn} tOut={tOut} m={m} h={sim.h} hEq={hEq} />
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ scene */

function niceTop(hEq) {
  return Math.max(3000, Math.ceil((hEq * 1.5) / 1000) * 1000);
}

function BalloonDrawing({ W, H, narrow, sim, tIn, tOut, m, hEq, T }) {
  const tx = T.ships.balloon;
  const U = T.u;
  const dec = T.decimal;
  const top = niceTop(hEq);
  const padT = narrow ? 44 : 70;
  const groundY = H - (narrow ? 30 : 38);
  const Y = (h) => groundY - (h / top) * (groundY - padT);
  const axX = narrow ? 34 : 54;
  const fs = narrow ? 10 : 11.5;
  const box = { w: W, h: H };
  const envH = narrow ? 56 : 80;
  const envW = envH * 0.84;
  const bx = narrow ? W * 0.58 : W * 0.52;
  const basketY = Y(sim.h); // bottom of the basket
  const basketH = envH * 0.17;
  const throatY = basketY - basketH - envH * 0.2;
  const envTop = throatY - envH;
  const envCy = throatY - envH * 0.55;
  const heat = clamp((tIn - tOut) / 100, 0, 1);
  const a = air(sim.h, tIn, tOut, m);
  const a0 = air(0, tIn, tOut, m);
  const fpx = (narrow ? 44 : 70) / Math.max(a0.F, a0.W, 1);
  const lenF = Math.max(0, a.F) * fpx;
  const lenW = a.W * fpx;
  const step = top / 6;
  const ticks = [];
  for (let h = 0; h <= top + 1e-6; h += step) {
    ticks.push(
      <g key={h}>
        <line x1={axX} x2={axX + 6} y1={Y(h)} y2={Y(h)} stroke="#64748b" />
        <text x={axX - 4} y={Y(h) + 3.5} textAnchor="end" fontSize={narrow ? 9 : 10.5} fill="#475569">
          {intText(h)}
        </text>
      </g>,
    );
  }
  const clouds = [0.38, 0.72].map((f, i) => {
    const cy = Y(top * f);
    const cx = i ? W * 0.25 : W * 0.82;
    const s = narrow ? 0.65 : 1;
    return (
      <g key={i} opacity="0.85">
        <ellipse cx={cx} cy={cy} rx={46 * s} ry={13 * s} fill="#fff" />
        <ellipse cx={cx - 18 * s} cy={cy - 8 * s} rx={22 * s} ry={13 * s} fill="#fff" />
        <ellipse cx={cx + 14 * s} cy={cy - 10 * s} rx={26 * s} ry={15 * s} fill="#fff" />
      </g>
    );
  });
  const gores = [-0.75, -0.38, 0, 0.38, 0.75];
  const envPath = `M${bx - envW * 0.18},${throatY} C${bx - envW * 0.62},${throatY - envH * 0.35} ${bx - envW * 0.58},${envTop} ${bx},${envTop} C${bx + envW * 0.58},${envTop} ${bx + envW * 0.62},${throatY - envH * 0.35} ${bx + envW * 0.18},${throatY} Z`;
  const flameH = sim.running || !sim.flying ? (narrow ? 10 : 16) * (0.4 + heat) * (1 + 0.15 * Math.sin(sim.t * 0.9)) : 0;

  return (
    <g>
      <defs>
        <linearGradient id="arx-bal-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfdbfe" />
          <stop offset="1" stopColor="#f0f9ff" />
        </linearGradient>
        <linearGradient id="arx-bal-env" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#b91c1c" />
          <stop offset="0.5" stopColor={heat > 0.5 ? '#f97316' : '#ef4444'} />
          <stop offset="1" stopColor="#991b1b" />
        </linearGradient>
        <radialGradient id="arx-bal-flame" cx="0.5" cy="0.8" r="0.7">
          <stop offset="0" stopColor="#fef08a" />
          <stop offset="0.5" stopColor="#fb923c" />
          <stop offset="1" stopColor="#dc2626" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="url(#arx-bal-sky)" />
      {ticks.map((t, i) => (
        <line key={`g${i}`} x1={axX + 8} x2={W} y1={Y(i * step)} y2={Y(i * step)} stroke="#fff" strokeOpacity="0.55" />
      ))}
      {clouds}

      {/* ground */}
      <path d={`M0,${groundY} Q${W * 0.18},${groundY - 16} ${W * 0.36},${groundY - 4} T${W * 0.72},${groundY - 6} T${W},${groundY - 2} L${W},${H} L0,${H} Z`} fill="#86c06c" />
      <rect x={0} y={groundY} width={W} height={H - groundY} fill="#65a30d" />
      <rect x={0} y={groundY + (H - groundY) * 0.45} width={W} height={(H - groundY) * 0.55} fill="#4d7c0f" opacity="0.6" />

      {/* equilibrium height */}
      {hEq > 0 && (
        <g>
          <line x1={axX + 8} x2={W - 10} y1={Y(hEq)} y2={Y(hEq)} stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="7 5" />
          <RichPill x={W - 14} y={Y(hEq) - 14} anchor="end" text={tx.tags.eq(intText(Math.round(hEq / 5) * 5))} bg="#7c3aed" size={fs} box={box} />
        </g>
      )}

      {/* tether */}
      {!sim.flying && (
        <g>
          <line x1={bx - basketH * 0.6} y1={basketY - 2} x2={bx - envW * 0.9} y2={groundY + 4} stroke="#78350f" strokeWidth="1.5" />
          <rect x={bx - envW * 0.9 - 3} y={groundY} width={6} height={9} fill="#57534e" />
        </g>
      )}

      {/* balloon */}
      <g>
        <path d={envPath} fill="url(#arx-bal-env)" stroke="#7f1d1d" strokeWidth="1.2" />
        {gores.map((g) => (
          <path
            key={g}
            d={`M${bx + g * envW * 0.13},${throatY} C${bx + g * envW * 0.55},${throatY - envH * 0.4} ${bx + g * envW * 0.42},${envTop + envH * 0.05} ${bx},${envTop}`}
            fill="none"
            stroke={Math.abs(g) < 0.1 ? '#fde047' : '#fecaca'}
            strokeOpacity="0.75"
            strokeWidth={Math.abs(g) < 0.1 ? 3 : 1.4}
          />
        ))}
        <rect x={bx - envW * 0.18} y={throatY} width={envW * 0.36} height={envH * 0.05} fill="#7f1d1d" />
        {[-1, 1].map((sgn) => (
          <line key={sgn} x1={bx + sgn * envW * 0.18} y1={throatY + envH * 0.05} x2={bx + sgn * basketH * 0.55} y2={basketY - basketH} stroke="#44403c" strokeWidth="1.2" />
        ))}
        {flameH > 0 && <ellipse cx={bx} cy={throatY + envH * 0.05 + flameH * 0.1} rx={flameH * 0.32} ry={flameH * 0.6} fill="url(#arx-bal-flame)" />}
        <rect x={bx - basketH * 0.62} y={basketY - basketH} width={basketH * 1.24} height={basketH} rx={2} fill="#a16207" stroke="#713f12" />
        <line x1={bx - basketH * 0.62} x2={bx + basketH * 0.62} y1={basketY - basketH * 0.55} y2={basketY - basketH * 0.55} stroke="#713f12" />
      </g>

      {/* forces */}
      {lenF > 2 && <ForceArrow x1={bx + envW * 0.62} y1={envCy} x2={bx + envW * 0.62} y2={envCy - lenF} color={COL.fa} width={3.2} head={10} />}
      {lenF > 2 && <Tag x={bx + envW * 0.62 + 7} y={envCy - lenF + 10} text="F" color={COL.fa} anchor="start" size={narrow ? 12 : 14} />}
      <ForceArrow x1={bx + basketH * 1.1} y1={basketY - basketH / 2} x2={bx + basketH * 1.1} y2={basketY - basketH / 2 + lenW} color={COL.mg} width={3.2} head={10} />
      <Tag x={bx + basketH * 1.1 + 7} y={basketY - basketH / 2 + lenW} text="mg" color={COL.mg} anchor="start" size={narrow ? 12 : 14} />
      {!narrow && (
        <g>
          <RichPill x={bx - envW * 0.62 - 10} y={envCy - 12} anchor="end" text={`F = ${intText(a.F)} ${U.n}`} bg={COL.fa} size={fs} box={box} />
          <RichPill x={bx - envW * 0.62 - 10} y={envCy + 14} anchor="end" text={`mg = ${intText(a.W)} ${U.n}`} bg={COL.mg} size={fs} box={box} />
          <RichPill x={bx - envW * 0.62 - 10} y={envCy + 40} anchor="end" text={tx.tags.inside(tIn, fmt(a.rhoIn, 3, dec))} bg="#fff" color="#c2410c" border="#fed7aa" size={fs} box={box} />
        </g>
      )}

      {/* altitude axis */}
      <line x1={axX + 3} x2={axX + 3} y1={padT - 6} y2={groundY} stroke="#64748b" />
      {ticks}
      <text x={axX - 4} y={padT - 12} textAnchor="end" fontSize={narrow ? 9.5 : 10.5} fontWeight="700" fill="#475569">
        {tx.axis}
      </text>
      <path d={`M${axX + 3},${basketY} l8,-5 l0,10 Z`} fill="#7c3aed" />
    </g>
  );
}

/* --------------------------------------------- lift and weight vs altitude */

function LiftGraph({ T, tIn, tOut, m, h, hEq }) {
  const tx = T.ships.balloon.graph;
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 240);
  const H = 250;
  const pad = { l: 52, r: 16, t: 22, b: 30 };
  const top = niceTop(hEq);
  const a0 = air(0, tIn, tOut, m);
  const fMax = Math.max(a0.F, a0.W) * 1.15;
  const yMax = Math.max(1000, Math.ceil(fMax / 1000) * 1000);
  const gx = (x) => pad.l + (x / top) * (W - pad.l - pad.r);
  const gy = (y) => H - pad.b - (Math.max(0, y) / yMax) * (H - pad.t - pad.b);
  const pts = [];
  for (let i = 0; i <= 60; i += 1) {
    const x = (top * i) / 60;
    pts.push(`${gx(x).toFixed(1)},${gy(air(x, tIn, tOut, m).F).toFixed(1)}`);
  }
  const yStep = yMax / 4;
  const cur = air(h, tIn, tOut, m);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-sm font-semibold text-gray-200">{tx.title}</p>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="h-0.5 w-4 rounded" style={{ background: COL.faText }} /> {tx.f}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="h-0.5 w-4 rounded" style={{ background: COL.mgText }} /> {tx.mg}
        </span>
      </div>
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={tx.label} className="block overflow-visible">
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <line x1={pad.l} x2={W - pad.r} y1={gy(i * yStep)} y2={gy(i * yStep)} stroke={i === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'} />
              <text x={pad.l - 6} y={gy(i * yStep) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                {intText(i * yStep)}
              </text>
            </g>
          ))}
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <text key={i} x={gx((top * i) / 6)} y={H - 10} textAnchor="middle" fontSize="11" fill="#94a3b8">
              {intText((top * i) / 6)}
            </text>
          ))}
          <text x={W - pad.r} y={H - pad.b - 6} textAnchor="end" fontSize="11" fill="#64748b">
            {tx.x}
          </text>
          <text x={pad.l + 6} y={pad.t - 8} fontSize="11" fill="#64748b">
            {tx.y}
          </text>
          <line x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.2)" />
          <line x1={gx(0)} x2={gx(top)} y1={gy(a0.W)} y2={gy(a0.W)} stroke={COL.mgText} strokeWidth="2.5" />
          <polyline points={pts.join(' ')} fill="none" stroke={COL.faText} strokeWidth="2.5" strokeLinejoin="round" />
          {hEq > 0 && (
            <g>
              <line x1={gx(hEq)} x2={gx(hEq)} y1={pad.t} y2={H - pad.b} stroke="rgba(196,181,253,0.6)" strokeDasharray="4 4" />
              <circle cx={gx(hEq)} cy={gy(a0.W)} r="5" fill="#c4b5fd" stroke="#0b0b16" strokeWidth="1.5" />
              <text x={gx(hEq) + (gx(hEq) > W - 120 ? -6 : 6)} y={pad.t + 10} textAnchor={gx(hEq) > W - 120 ? 'end' : 'start'} fontSize="11" fontWeight="600" fill="#c4b5fd">
                {tx.eq(intText(Math.round(hEq / 5) * 5))}
              </text>
            </g>
          )}
          <line x1={gx(h)} x2={gx(h)} y1={pad.t} y2={H - pad.b} stroke="rgba(34,211,238,0.45)" strokeDasharray="3 4" />
          <circle cx={gx(h)} cy={gy(cur.F)} r="5" fill={COL.faText} stroke="#0b0b16" strokeWidth="1.5" />
        </svg>
      </div>
      <p className="mt-1 text-xs leading-snug text-gray-500">{tx.note}</p>
    </div>
  );
}
