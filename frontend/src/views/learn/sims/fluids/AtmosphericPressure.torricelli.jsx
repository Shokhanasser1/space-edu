import { useState } from 'react';
import { Check, Droplet, Droplets, Gauge, Lightbulb, Timer } from 'lucide-react';

import { Explain, Pill, RangeField, Readout, Segmented, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import {
  Chip,
  ForceArrow,
  SidePill,
  Formula,
  G,
  GroupLabel,
  H_SCALE,
  HaloText,
  LIQUIDS,
  LabScene,
  LiquidDefs,
  MMHG,
  P0_MM,
  PC,
  PaperGrid,
  PlayControls,
  pa100,
  seeded,
  smart,
  whole,
} from './AtmosphericPressure.parts';

/**
 * Tab 1 — Torricelli's experiment. A tube closed at one end is filled with
 * a liquid, closed with a finger, turned over into a dish of the same liquid
 * and opened: the column drops until its pressure at the level of the dish
 * surface equals the atmospheric pressure, p₀ = ρ·g·h, leaving a vacuum on
 * top. Tilting the tube makes the column longer along the tube
 * (l = h / cos α) but keeps its vertical height; a wider tube holds more
 * liquid, yet the column's weight ρ·S·h·g grows exactly as the air's force
 * p₀·S, so h stays. Water or oil need a tube over 10 m long.
 *
 * Preset: mercury, p₀ = 760 mm Hg. 1 mm Hg = 13 600 · 9.8 · 0.001 =
 * 133.28 Pa, so p₀ = 760 · 133.28 = 101 293 ≈ 101 300 Pa and
 * h = p₀ / (ρg) = 0.760 m. Water: h = 101 293 / (1000 · 9.8) = 10.34 m;
 * vegetable oil (900 kg/m³): 11.48 m. Tube of d = 10 mm: S = 0.785 cm²,
 * column mass ρSh = 0.811 kg (the same for every liquid), weight 7.96 N =
 * p₀·S. Tilted by 30°: l = 760 / cos 30° = 878 mm. Past ≈ 37° the 1 m tube
 * (mouth 35 mm under the surface) cannot hold an 878+ mm column and fills
 * to the top.
 */

const TUBE = { hg: 1, water: 13, oil: 13 }; // m, tube length per liquid
const DM = 0.035; // mouth depth under the dish surface, in tube lengths
const SURF = 0.07; // dish surface above the table, in tube lengths
const DISH_W = 0.46;
const DISH_H = 0.105;
const T_FILL = 1.5;
const T_CLOSE = 2.0;
const T_INV = 3.9;
const T_REL = 4.4;
const IDLE = { tau: 0, running: false, done: false, settling: false, y: 0, v: 0, phi: 0 };
const STEP_KEYS = ['fill', 'close', 'invert', 'release'];
const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);

export default function TorricelliSim({ T }) {
  const C = T.torr;
  const dec = T.decimal;
  const [liquid, setLiquid] = useState('hg');
  const [p0mm, setP0mm] = useState(P0_MM);
  const [alpha, setAlpha] = useState(0);
  const [dmm, setDmm] = useState(10);
  const [last, setLast] = useState(null);
  const [sim, setSim] = useState(IDLE);

  const L = LIQUIDS[liquid];
  const Lm = TUBE[liquid];
  const p0 = p0mm * MMHG;
  const hM = p0 / (L.rho * G); // m, column that balances the air
  const hN = hM / Lm; // in tube lengths
  const live = sim.tau >= T_REL;

  useRafLoop(sim.running || sim.settling, (dt) => {
    setSim((p) => {
      let { tau, y, v, phi, running, done, settling } = p;
      if (running && tau < T_REL) {
        tau = Math.min(T_REL, tau + dt);
        if (tau >= T_REL) {
          y = 1 - DM;
          v = 0;
          phi = 0;
        }
      }
      if (tau >= T_REL) {
        const target = (alpha * Math.PI) / 180;
        phi += (target - phi) * (1 - Math.exp(-dt * 3.2));
        const yEnd = Math.cos(phi) - DM;
        const yT = Math.min(hN, yEnd);
        const w = 2 * Math.PI * 0.8;
        const z = 0.45;
        const n = Math.max(1, Math.ceil(dt / (1 / 240)));
        const h = dt / n;
        for (let i = 0; i < n; i += 1) {
          v += (-w * w * (y - hN) - 2 * z * w * v) * h;
          y += v * h;
          if (y >= yEnd) {
            y = yEnd;
            if (v > 0) v = 0;
          }
        }
        const still = Math.abs(y - yT) < 5e-4 && Math.abs(v) < 4e-3 && Math.abs(phi - target) < 5e-4;
        if (still) {
          y = yT;
          v = 0;
          phi = target;
          if (running) {
            running = false;
            done = true;
          }
          settling = false;
        }
      }
      return { tau, y, v, phi, running, done, settling };
    });
  });

  const wake = () => setSim((p) => (p.tau >= T_REL ? { ...p, settling: true } : p));
  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
    setLast(null);
  };
  const reset = () => {
    setSim(IDLE);
    setLast(null);
  };
  const pickLiquid = (id) => {
    setLiquid(id);
    setSim(IDLE);
    setLast(null);
  };
  const onTilt = (a) => {
    setAlpha(a);
    setLast('tilt');
    wake();
  };
  const onWidth = (d) => {
    setDmm(d);
    setLast('width');
    wake();
  };
  const onP0 = (mm) => {
    setP0mm(mm);
    setLast('p0');
    wake();
  };

  /* ---- phase */
  const started = sim.tau > 0 || sim.running;
  let phase = 'idle';
  if (started) {
    if (sim.tau < T_FILL) phase = 'fill';
    else if (sim.tau < T_CLOSE) phase = 'close';
    else if (sim.tau < T_INV) phase = 'invert';
    else if (sim.tau < T_REL) phase = 'release';
    else phase = sim.done ? 'done' : 'drop';
  }
  const stepIndex = { idle: -1, fill: 0, close: 1, invert: 2, release: 3, drop: 3, done: 4 }[phase];

  /* ---- live numbers */
  const yEnd = Math.cos(sim.phi) - DM; // closed end above the dish surface, tube lengths
  const full = live && hN >= yEnd - 1e-6;
  const yNow = live ? sim.y : null; // column top above the dish surface
  const colV = yNow === null ? null : yNow * Lm; // m, vertical column now
  const colL = yNow === null ? null : (Math.min(1, (yNow + DM) / Math.cos(sim.phi)) - DM / Math.cos(sim.phi)) * Lm; // m, along the tube above the surface level
  const S = (Math.PI * (dmm / 1000) ** 2) / 4; // m²
  const hShown = colV ?? hM;
  const mass = L.rho * S * hShown;
  const weight = mass * G;
  const p0S = p0 * S;
  const pTop = full ? (p0 - L.rho * G * yEnd * Lm) / 1000 : 0; // kPa on the closed end

  const lenText = (m) => (liquid === 'hg' ? `${whole(m * 1000, dec)} ${T.mm}` : `${fmt(m, 2, dec)} ${T.m}`);

  /* ---- explanation */
  let key = phase;
  if (phase === 'done') {
    if (full) key = 'full';
    else if (last === 'tilt' && alpha > 0) key = 'tilt';
    else if (last === 'width') key = 'width';
    else if (last === 'p0') key = 'p0';
    else key = liquid === 'hg' ? 'doneHg' : 'doneLight';
  }
  const settled = useSettled(`${key}`, key === 'tilt' || key === 'width' || key === 'p0' ? 260 : 0);
  const names = C.liquids[liquid];
  const vals = {
    L: `${smart(Lm, dec)} ${T.m}`,
    liq: names.nom,
    Liq: names.Nom,
    ins: names.ins,
    dat: names.dat,
    h: lenText(hM),
    hm: fmt(hM, 3, dec),
    rho: whole(L.rho, dec),
    g: smart(G, dec),
    p: pa100(p0, dec),
    ratio: fmt(13600 / L.rho, 1, dec),
    a: whole(alpha, dec),
    l: lenText(hM / Math.cos((alpha * Math.PI) / 180)),
    y: lenText(Math.max(0, yEnd * Lm)),
    pt: fmt(pTop, 1, dec),
    d: whole(dmm, dec),
    m: `${fmt(L.rho * S * hM, 3, dec)} ${T.kg}`,
    W: fmt(p0S, 2, dec),
    mm: whole(p0mm, dec),
    kpa: fmt(p0 / 1000, 1, dec),
  };
  const text = C.explain[settled] ? C.explain[settled](vals) : '';
  const tone = settled === 'full' ? '#f472b6' : settled.startsWith('done') ? '#34d399' : settled === 'drop' ? '#fbbf24' : '#22d3ee';

  /* ---- p₀ hint: weather at sea level, or the height where this is the mean pressure */
  const altEq = -H_SCALE * Math.log(p0mm / P0_MM);
  const p0Hint = p0mm >= 770 ? C.p0Hint.high : p0mm >= 750 ? C.p0Hint.normal : C.p0Hint.alt(whole(Math.round(altEq / 10) * 10, dec));

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{C.liquidLabel}</GroupLabel>
          <Segmented
            label={C.liquidLabel}
            className="grid-cols-1 sm:grid-cols-3"
            size="lg"
            value={liquid}
            onChange={pickLiquid}
            accent="#94a3b8"
            options={['hg', 'water', 'oil'].map((id) => ({
              value: id,
              label: C.liquids[id].Nom,
              sub: C.liquidSub(whole(LIQUIDS[id].rho, dec), lenTextFor(id, p0 / (LIQUIDS[id].rho * G), T, dec)),
              icon: id === 'hg' ? Gauge : id === 'water' ? Droplets : Droplet,
            }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={started} onToggle={toggle} onReset={reset} />
      </div>

      <TorricelliScene
        T={T}
        liquid={liquid}
        Lm={Lm}
        hN={hN}
        hM={hM}
        p0mm={p0mm}
        dmm={dmm}
        sim={sim}
        phase={phase}
        full={full}
        pTop={pTop}
        lenText={lenText}
      />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={C.readouts.h}
          symbol="h"
          value={colV === null ? '—' : liquid === 'hg' ? whole(colV * 1000, dec) : fmt(colV, 2, dec)}
          unit={colV === null ? undefined : liquid === 'hg' ? T.mm : T.m}
          accent={PC.h}
          textColor={PC.hText}
          active={phase === 'done'}
          sub={colV === null ? C.readouts.hWait(smart(Lm, dec)) : full ? C.readouts.hFull : C.readouts.hAlong(lenText(Math.max(0, colL)))}
        />
        <Readout
          label={C.readouts.p0}
          symbol="p₀"
          value={fmt(p0 / 1000, 1, dec)}
          unit={T.kPa}
          accent={PC.atm}
          textColor={PC.atmText}
          sub={C.readouts.p0Sub(whole(p0mm, dec), pa100(p0, dec))}
        />
        <Readout label={C.readouts.formula} accent={PC.col}>
          <div className="mt-1.5 space-y-1 text-[13px] leading-snug">
            <p className="text-[15px] text-gray-100">
              <Formula text="p₀ = ρ·g·h" />
            </p>
            <p className="tabular-nums text-gray-400">
              {whole(L.rho, dec)}·{smart(G, dec)}·{fmt(hM, liquid === 'hg' ? 3 : 2, dec)} ≈ <b style={{ color: PC.atmText }}>{pa100(p0, dec)}</b> {T.Pa}
            </p>
            <p className="text-xs text-gray-500">{C.readouts.mmNote(fmt(MMHG, 1, dec))}</p>
          </div>
        </Readout>
        <Readout
          label={C.readouts.weight}
          symbol="mg"
          value={fmt(weight, 2, dec)}
          unit={T.N}
          accent={PC.T}
          textColor={PC.TText}
          sub={
            <>
              {C.readouts.weightSub(fmt(S * 1e4, 3, dec), fmt(mass, 3, dec))}
              <br />
              <span className="text-gray-500">{full ? C.readouts.p0SFull(fmt(p0S, 2, dec)) : C.readouts.p0S(fmt(p0S, 2, dec))}</span>
            </>
          }
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="atm-to-tilt"
            label={C.tilt}
            symbol="α"
            min={0}
            max={60}
            step={1}
            value={alpha}
            onChange={onTilt}
            accent={PC.h}
            display={`${whole(alpha, dec)}°`}
            hint={C.tiltHint(lenText(hM / Math.cos((alpha * Math.PI) / 180)))}
          />
          <RangeField
            id="atm-to-d"
            label={C.width}
            symbol="d"
            min={4}
            max={20}
            step={1}
            value={dmm}
            onChange={onWidth}
            accent={PC.T}
            display={`${whole(dmm, dec)} ${T.mm}`}
            hint={C.widthHint(fmt(S * 1e4, 3, dec))}
          />
          <RangeField
            id="atm-to-p0"
            label={C.p0}
            symbol="p₀"
            min={600}
            max={800}
            step={1}
            value={p0mm}
            onChange={onP0}
            accent={PC.atm}
            display={`${whole(p0mm, dec)} ${T.mmHg}`}
            hint={p0Hint}
          />
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <p className="text-sm font-semibold text-gray-200">{C.steps.title}</p>
          <ol className="mt-2 space-y-1.5">
            {STEP_KEYS.map((k, i) => {
              const doneStep = stepIndex > i;
              const on = stepIndex === i;
              return (
                <li
                  key={k}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-2 text-[13.5px] leading-snug transition-colors ${
                    on ? 'border-cyan-300/50 bg-cyan-400/10 text-white' : doneStep ? 'border-emerald-400/25 bg-emerald-400/[0.06] text-gray-200' : 'border-white/10 text-gray-400'
                  }`}
                >
                  <span
                    className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                      doneStep ? 'bg-emerald-400 text-slate-950' : on ? 'bg-cyan-300 text-slate-950' : 'bg-white/10 text-gray-300'
                    }`}
                    aria-hidden="true"
                  >
                    {doneStep ? <Check size={14} strokeWidth={3} /> : i + 1}
                  </span>
                  <span>{C.steps[k]({ liq: names.nom, ins: names.ins, dat: names.dat, h: lenText(hM) })}</span>
                </li>
              );
            })}
          </ol>
          <p className="mt-2.5 text-xs leading-relaxed text-gray-500">{C.steps.note}</p>
        </div>
      </div>
    </div>
  );
}

function lenTextFor(id, m, T, dec) {
  return id === 'hg' ? `${whole(m * 1000, dec)} ${T.mm}` : `${fmt(m, 1, dec)} ${T.m}`;
}

/* ================================================================ scene */

function TorricelliScene({ T, liquid, Lm, hN, hM, p0mm, dmm, sim, phase, full, pTop, lenText }) {
  const C = T.torr;
  const dec = T.decimal;
  const Lq = LIQUIDS[liquid];
  const gradId = `atm-to-liq-${liquid}`;
  const live = phase === 'drop' || phase === 'done';

  return (
    <LabScene
      legend={[
        { color: PC.atm, label: C.legend.atm, kind: 'arrow' },
        { color: PC.col, label: C.legend.col, kind: 'arrow' },
        { color: '#f8fafc', label: C.legend.vac, kind: 'block' },
        { color: PC.h, label: C.legend.h, kind: 'dash' },
      ]}
      chips={
        <>
          {(sim.running || (sim.tau > 0 && !sim.done)) && (
            <Chip icon={Timer}>{C.chipSlow}</Chip>
          )}
          <Chip icon={Gauge} color={PC.atm} strong>
            {C.chipP0(whole(p0mm, dec))}
            <span className="hidden sm:inline">{C.chipKpa(fmt((p0mm * MMHG) / 1000, 1, dec))}</span>
          </Chip>
        </>
      }
      height={(W, narrow) => (narrow ? clamp(W * 1.02, 330, 420) : clamp(W * 0.47, 470, 560))}
      ariaLabel={C.sceneLabel(C.liquids[liquid].nom, live ? lenText(sim.y * Lm) : '—', whole(p0mm, dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 10.5 : 12;
        const box = { w: W, h: H };
        const topPad = narrow ? 62 : 74;
        const groundY = H - (narrow ? 28 : 34);
        const panelW = narrow || W < 760 ? 0 : clamp(W * 0.42, 330, 520);
        const areaW = W - panelW;
        const k = Math.min((groundY - topPad) / 1.045, (areaW - (narrow ? 44 : 70)) / 1.27);
        const xd = (narrow ? 44 : 64) + 0.36 * k + Math.max(0, (areaW - (narrow ? 44 : 70) - 1.27 * k) / 2);
        const yS = groundY - SURF * k; // dish surface
        const mouthFinal = { x: xd, y: yS + DM * k };
        const xs = xd + 0.62 * k; // where the empty tube stands at first
        const w = clamp((7 + (dmm - 4) * 1.15) * (k / 400), 6, 30); // inner width, drawn wider than true scale
        const t = 2.2; // glass wall
        const cell = k / (liquid === 'hg' ? 10 : 13);

        /* tube pose for the current phase */
        let mouth = mouthFinal;
        let phi = 0; // deg, 0 = mouth down, 180 = mouth up
        let fillA = 0; // liquid from s = fillA to s = fillB (tube lengths from the mouth)
        let fillB = 0;
        let thumb = null;
        let funnel = 0;
        let surfaceDir = 1; // free surface faces the closed end (+1) or the mouth (−1)
        const tau = sim.tau;
        const at = (cx, cy, deg) => {
          const r = (deg * Math.PI) / 180;
          return { x: cx - Math.sin(r) * (k / 2), y: cy + Math.cos(r) * (k / 2) };
        };
        if (phase === 'idle' || phase === 'fill' || phase === 'close') {
          phi = 180;
          mouth = { x: xs, y: groundY - k };
          if (phase === 'fill') {
            const f = ease(clamp(tau / T_FILL, 0, 1));
            fillA = 1 - f;
            fillB = 1;
            surfaceDir = -1;
            funnel = 1;
          } else if (phase === 'close') {
            fillA = 0;
            fillB = 1;
            thumb = { o: clamp((tau - T_FILL) / 0.3, 0, 1), slide: 0 };
          }
        } else if (phase === 'invert') {
          const u = (tau - T_CLOSE) / (T_INV - T_CLOSE);
          const c0 = { x: xs, y: groundY - 0.5 * k };
          const c1 = { x: xs, y: groundY - 0.8 * k };
          const c2 = { x: xd, y: groundY - 0.8 * k };
          const c3 = { x: xd, y: mouthFinal.y - 0.5 * k };
          let c;
          if (u < 0.22) {
            const q = ease(u / 0.22);
            c = { x: c0.x, y: c0.y + (c1.y - c0.y) * q };
            phi = 180;
          } else if (u < 0.8) {
            const q = ease((u - 0.22) / 0.58);
            c = { x: c1.x + (c2.x - c1.x) * q, y: c1.y };
            phi = 180 * (1 - q);
          } else {
            const q = ease((u - 0.8) / 0.2);
            c = { x: c2.x, y: c2.y + (c3.y - c2.y) * q };
            phi = 0;
          }
          mouth = at(c.x, c.y, phi);
          fillA = 0;
          fillB = 1;
          thumb = { o: 1, slide: 0 };
        } else if (phase === 'release') {
          fillA = 0;
          fillB = 1;
          thumb = { o: 1, slide: clamp((tau - T_INV) / (T_REL - T_INV), 0, 1) };
        } else {
          phi = (sim.phi * 180) / Math.PI;
          fillA = 0;
          fillB = Math.min(1, (sim.y + DM) / Math.cos(sim.phi));
        }

        const phiR = (phi * Math.PI) / 180;
        const topEnd = { x: mouth.x + Math.sin(phiR) * k, y: mouth.y - Math.cos(phiR) * k };
        const hY = yS - hN * k; // the level the column settles at
        const xR = xd - 0.34 * k; // ruler
        const rW = Math.max(12, 0.04 * k);
        const xRightEnd = areaW - (narrow ? 10 : 16);
        const sVac = (Math.min(fillB, 1) + 0.97) / 2; // middle of the vacuum, tube lengths from the mouth
        const vacMid = { x: mouth.x + Math.sin(phiR) * sVac * k, y: mouth.y - Math.cos(phiR) * sVac * k };
        const vacPx = (0.97 - fillB) * k;

        /* scattered air dots above the dish (stay put between renders) */
        const rnd = seeded(liquid === 'hg' ? 7 : 11);
        const air = Array.from({ length: narrow ? 26 : 44 }, () => ({ x: 14 + rnd() * (areaW - 28), y: topPad + 20 + rnd() * (yS - topPad - 34) }));

        /* atmospheric arrows on the free surface (right ones only while the tube stands straight) */
        const arrowLen = Math.max(34, 0.12 * k);
        const leftArrows = [xd - 0.19 * k, xd - 0.105 * k];
        const rightArrows = phase === 'invert' || Math.abs(phi) > 6 ? [] : [xd + 0.105 * k, xd + 0.19 * k];
        const colX = mouth.x + Math.tan(phiR) * DM * k; // tube axis where it crosses the surface

        return (
          <>
            <LiquidDefs id={gradId} liquid={liquid} />
            <defs>
              <pattern id="atm-to-vac" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="6" stroke="#cbd5e1" strokeWidth="1.4" />
              </pattern>
            </defs>
            <rect x={0} y={0} width={W} height={H} fill="#fbfcfe" />
            <PaperGrid x0={0} y0={0} x1={areaW} y1={groundY} cell={cell} ax={xR} ay={yS} />

            {/* air */}
            <g aria-hidden="true">
              {air.map((d, i) => (
                <circle key={`a${i}`} cx={d.x} cy={d.y} r={narrow ? 1.6 : 2} fill={PC.air} opacity="0.35" />
              ))}
            </g>

            {/* ruler, its zero at the dish surface */}
            <Ruler x={xR} w={rW} y0={yS} k={k} Lm={Lm} liquid={liquid} fs={fs} T={T} dec={dec} groundY={groundY} />
            <line x1={xR + rW} x2={xd - (DISH_W / 2) * k} y1={yS} y2={yS} stroke="#94a3b8" strokeDasharray="3 3" />

            {/* the level of the balancing column */}
            {live && (
              <g aria-hidden="true">
                <line x1={xR + rW} x2={xRightEnd} y1={hY} y2={hY} stroke={PC.h} strokeWidth="1.4" strokeDasharray="6 5" opacity={full ? 0.55 : 0.9} />
                <ForceArrow x1={xR + rW + 10} y1={yS - 2} x2={xR + rW + 10} y2={hY + 1} color={PC.h} width={2} head={8} />
                <ForceArrow x1={xR + rW + 10} y1={hY + 1} x2={xR + rW + 10} y2={yS - 2} color={PC.h} width={2} head={8} />
                <HaloText x={xR + rW + 16} y={(yS + hY) / 2 + 5} anchor="start" color={PC.h} fs={fs + 2} italic>
                  h
                </HaloText>
                <Pill x={xRightEnd - 60} y={hY + (narrow ? 13 : -13)} text={C.hTag(lenText(hM))} bg={PC.h} size={fs} box={{ w: areaW, h: H }} />
              </g>
            )}

            {/* table */}
            <rect x={0} y={groundY} width={areaW} height={H - groundY} fill="#f1f5f9" />
            <line x1={0} x2={areaW} y1={groundY} y2={groundY} stroke="#475569" strokeWidth="1.6" />

            {/* dish with the liquid */}
            <Dish xd={xd} k={k} groundY={groundY} yS={yS} grad={gradId} Lq={Lq} />

            {/* atmosphere pressing on the open surface */}
            {[...leftArrows, ...rightArrows].map((x) => (
              <ForceArrow key={`p${x.toFixed(1)}`} x1={x} y1={yS - arrowLen - 3} x2={x} y2={yS - 2} color={PC.atm} width={narrow ? 2.6 : 3} head={narrow ? 9 : 11} />
            ))}
            <Pill x={leftArrows[0] - (narrow ? 4 : 10)} y={yS - arrowLen - 16} text={C.tag.p0} bg={PC.atm} size={fs} box={box} />

            {/* the tube */}
            <Tube
              mouth={mouth}
              phi={phi}
              k={k}
              w={w}
              t={t}
              fillA={fillA}
              fillB={fillB}
              surfaceDir={surfaceDir}
              grad={gradId}
              Lq={Lq}
              thumb={thumb}
              funnel={funnel}
              vacuum={live && !full}
            />

            {/* the empty space above the column */}
            {live && !full && vacPx > 22 && (
              <g>
                <line x1={vacMid.x + w / 2 + 3} y1={vacMid.y} x2={vacMid.x + w / 2 + (narrow ? 18 : 26)} y2={vacMid.y} stroke="#64748b" strokeWidth="1.2" />
                <SidePill x={vacMid.x + w / 2 + (narrow ? 18 : 26)} y={vacMid.y} side={1} gap={0} text={C.tag.vac} bg="#64748b" fs={fs} box={{ w: areaW, h: H }} />
              </g>
            )}

            {/* column pressure at the surface level, equal to p₀ */}
            {live && !full && Math.abs(sim.y - hN) < 0.03 && Math.abs(phi) < 12 && (
              <g>
                <ForceArrow x1={colX} y1={yS - arrowLen - 3} x2={colX} y2={yS - 2} color={PC.col} width={narrow ? 2.4 : 2.8} head={narrow ? 8 : 10} />
                <line x1={colX + 3} y1={yS - arrowLen * 0.6} x2={xd + 0.27 * k} y2={yS - arrowLen - (narrow ? 30 : 18)} stroke={PC.col} strokeWidth="1.2" />
                <SidePill x={xd + 0.27 * k} y={yS - arrowLen - (narrow ? 30 : 18)} side={1} gap={0} text={C.tag.col} bg={PC.col} fs={fs} box={{ w: areaW, h: H }} />
              </g>
            )}

            {/* the tube full when tilted far */}
            {full && (
              <Pill x={topEnd.x} y={topEnd.y - 18} text={C.tag.full(fmt(pTop, 1, dec))} bg="#db2777" size={fs} box={{ w: areaW, h: H }} />
            )}

            {/* tube length before the experiment */}
            {(phase === 'idle' || phase === 'fill') && (
              <g aria-hidden="true">
                <line x1={xs + w / 2 + 16} x2={xs + w / 2 + 16} y1={groundY - k} y2={groundY} stroke="#64748b" strokeWidth="1.2" />
                <line x1={xs + w / 2 + 11} x2={xs + w / 2 + 21} y1={groundY - k} y2={groundY - k} stroke="#64748b" strokeWidth="1.2" />
                <line x1={xs + w / 2 + 11} x2={xs + w / 2 + 21} y1={groundY} y2={groundY} stroke="#64748b" strokeWidth="1.2" />
                <Pill x={xs + w / 2 + 16} y={groundY - k / 2} text={`L = ${smart(Lm, dec)} ${T.m}`} bg="#475569" size={fs} box={{ w: areaW, h: H }} />
              </g>
            )}

            {liquid !== 'hg' && <Person x={xd + 0.36 * k} ground={groundY} hPx={(1.7 / Lm) * k} />}

            {panelW > 0 && <ColumnsPanel T={T} x0={areaW + 6} x1={W - 16} top={topPad + 32} base={groundY - 32} p0mm={p0mm} liquid={liquid} fs={fs} />}
          </>
        );
      }}
    </LabScene>
  );
}

/** Vertical scale with its zero at the dish surface: mm for mercury, m for water and oil. */
function Ruler({ x, w, y0, k, Lm, liquid, fs, T, dec, groundY }) {
  const hg = liquid === 'hg';
  const major = hg ? 0.1 : 1; // m
  const minor = hg ? 0.05 : 0.5;
  const top = 1 - DM; // tube lengths above the surface
  const ticks = [];
  const labelEvery = !hg && k / Lm < 22 ? 2 : 1;
  for (let m = 0; m <= top * Lm + 1e-9; m += minor) {
    const y = y0 - (m / Lm) * k;
    const isMajor = Math.abs(m / major - Math.round(m / major)) < 1e-6;
    const idx = Math.round(m / major);
    ticks.push(
      <g key={`r${m.toFixed(2)}`}>
        <line x1={x + w} x2={x + w - (isMajor ? w * 0.7 : w * 0.38)} y1={y} y2={y} stroke="#334155" strokeWidth={isMajor ? 1.3 : 0.9} />
        {isMajor && idx % labelEvery === 0 && (
          <text x={x - 4} y={y + 4} textAnchor="end" fontSize={fs - 1.5} fill="#475569">
            {hg ? whole(m * 1000, dec) : whole(m, dec)}
          </text>
        )}
      </g>,
    );
  }
  return (
    <g aria-hidden="true">
      <line x1={x + w / 2} x2={x + w / 2} y1={y0} y2={groundY} stroke="#94a3b8" strokeWidth="2" />
      <rect x={x + w / 2 - 9} y={groundY - 4} width={18} height={4} rx={1} fill="#94a3b8" />
      <rect x={x} y={y0 - top * k - 6} width={w} height={top * k + 6} rx={2} fill="#fef9c3" stroke="#a16207" strokeWidth="1" />
      {ticks}
      <text x={x + w / 2} y={y0 - top * k - 12} textAnchor="middle" fontSize={fs - 1} fontWeight="700" fill="#475569">
        {hg ? T.mm : T.m}
      </text>
    </g>
  );
}

/** A glass dish with the liquid in it. */
function Dish({ xd, k, groundY, yS, grad, Lq }) {
  const x0 = xd - (DISH_W / 2) * k;
  const x1 = xd + (DISH_W / 2) * k;
  const top = groundY - DISH_H * k;
  return (
    <g aria-hidden="true">
      <rect x={x0 + 2} y={yS} width={x1 - x0 - 4} height={groundY - yS - 2} fill={`url(#${grad}-v)`} />
      <line x1={x0 + 2} x2={x1 - 2} y1={yS} y2={yS} stroke={Lq.stroke} strokeWidth="1.4" />
      <path d={`M${x0},${top} L${x0},${groundY - 3} Q${x0},${groundY} ${x0 + 3},${groundY} L${x1 - 3},${groundY} Q${x1},${groundY} ${x1},${groundY - 3} L${x1},${top}`} fill="rgba(226,232,240,0.25)" stroke="#64748b" strokeWidth="2" />
      <line x1={x0 + 4} x2={x0 + 4} y1={top + 4} y2={groundY - 6} stroke="#fff" strokeWidth="1.5" opacity="0.8" />
    </g>
  );
}

/**
 * The tube in its own frame: the mouth at the origin, the closed end at
 * (0, −k), turned by `phi` degrees about the mouth. The liquid fills from
 * s = fillA to s = fillB (in tube lengths); its free surface stays level on
 * screen, so in the tube's frame it is slanted by the tilt.
 */
function Tube({ mouth, phi, k, w, t, fillA, fillB, surfaceDir, grad, Lq, thumb, funnel, vacuum }) {
  const ow = w / 2 + t;
  const inTop = k - t - w * 0.25; // usable inner length
  const yA = -Math.min(fillA * k, inTop);
  const yB = -Math.min(fillB * k, inTop);
  const tanP = Math.tan((phi * Math.PI) / 180);
  const slant = Math.abs(phi) < 89 || Math.abs(phi) > 91 ? clamp(tanP, -3, 3) : 0;
  const hw = w / 2;
  const bulge = (Lq.convex ? 1 : -1) * Math.min(4, w * 0.22);

  let liquidPath = null;
  if (fillB > fillA + 1e-4) {
    if (surfaceDir > 0) {
      // from the mouth up to a level surface at s = fillB
      const full = fillB * k >= inTop - 0.5;
      if (full) {
        liquidPath = `M${-hw},${yA} L${-hw},${-inTop} A${hw},${hw * 0.6} 0 0 1 ${hw},${-inTop} L${hw},${yA} Z`;
      } else {
        const yl = yB + hw * slant;
        const yr = yB - hw * slant;
        liquidPath = `M${-hw},${yA} L${-hw},${yl} Q0,${(yl + yr) / 2 - bulge * 2} ${hw},${yr} L${hw},${yA} Z`;
      }
    } else {
      // tube upside down: liquid from the closed end down to the surface at s = fillA
      const ys = yA;
      liquidPath = `M${-hw},${-inTop} L${-hw},${ys} Q0,${ys + bulge * 2} ${hw},${ys} L${hw},${-inTop} A${hw},${hw * 0.6} 0 0 0 ${-hw},${-inTop} Z`;
    }
  }
  const showVac = vacuum && inTop + yB > 6;

  return (
    <g transform={`translate(${mouth.x.toFixed(2)} ${mouth.y.toFixed(2)}) rotate(${phi.toFixed(2)})`}>
      {/* glass */}
      <path d={`M${-ow},0 L${-ow},${-k + ow} A${ow},${ow} 0 0 1 ${ow},${-k + ow} L${ow},0`} fill="#fbfdff" stroke="#7b8794" strokeWidth="1.5" />
      {showVac && <rect x={-hw + 0.5} y={-inTop} width={w - 1} height={inTop + yB + hw} fill="url(#atm-to-vac)" opacity="0.9" />}
      {liquidPath && <path d={liquidPath} fill={`url(#${grad})`} stroke={Lq.stroke} strokeWidth="0.9" />}
      {/* glass shine */}
      <line x1={-hw + 1.5} x2={-hw + 1.5} y1={-6} y2={-k + ow + 4} stroke="#ffffff" strokeWidth="1.4" opacity="0.9" />
      {/* funnel while pouring (tube upside down: +y is screen-up) */}
      {funnel > 0 && (
        <g>
          <path d={`M${-ow},-2 L${-ow - 14},${-26} L${ow + 14},${-26} L${ow},-2 Z`} transform="scale(1,-1)" fill="rgba(226,232,240,0.7)" stroke="#64748b" strokeWidth="1.3" />
          <line x1={0} x2={0} y1={44} y2={yA + 2} stroke={Lq.stroke} strokeWidth={Math.max(2, w * 0.25)} opacity="0.8" strokeLinecap="round" />
        </g>
      )}
      {thumb && (
        <g transform={`translate(${thumb.slide * (ow + 46)} 0)`} opacity={thumb.o * (1 - thumb.slide * 0.9)}>
          <rect x={-ow - 4} y={-1} width={ow * 2 + 48} height={14} rx={7} fill="#f2c6a0" stroke="#b9805a" strokeWidth="1.2" />
          <path d={`M${-ow + 1},${3} q4,-3 9,0`} fill="none" stroke="#d29b73" strokeWidth="1.1" />
        </g>
      )}
    </g>
  );
}

/** A person 1.7 m tall, for scale beside the long tube of water or oil. */
function Person({ x, ground, hPx }) {
  if (hPx < 14) return null;
  const u = hPx / 100;
  return (
    <g aria-hidden="true" opacity="0.85">
      <circle cx={x} cy={ground - 92 * u} r={8 * u} fill="#94a3b8" />
      <path d={`M${x - 9 * u},${ground - 80 * u} L${x + 9 * u},${ground - 80 * u} L${x + 7 * u},${ground - 45 * u} L${x - 7 * u},${ground - 45 * u} Z`} fill="#94a3b8" />
      <line x1={x - 4 * u} x2={x - 5 * u} y1={ground - 46 * u} y2={ground} stroke="#94a3b8" strokeWidth={6 * u} strokeLinecap="round" />
      <line x1={x + 4 * u} x2={x + 5 * u} y1={ground - 46 * u} y2={ground} stroke="#94a3b8" strokeWidth={6 * u} strokeLinecap="round" />
    </g>
  );
}

/** The same p₀ balanced by columns of mercury, water and oil, drawn to one scale with a person and a house. */
function ColumnsPanel({ T, x0, x1, top, base, p0mm, liquid, fs }) {
  const C = T.torr;
  const dec = T.decimal;
  const p0 = p0mm * MMHG;
  const maxM = 13;
  const kM = (base - top - 30) / maxM;
  const sy = (m) => base - m * kM;
  const width = x1 - x0;
  const cols = [
    { id: 'hg', x: x0 + width * 0.22 },
    { id: 'water', x: x0 + width * 0.38 },
    { id: 'oil', x: x0 + width * 0.54 },
  ];
  const bw = clamp(width * 0.05, 18, 26);
  const houseX = x0 + width * 0.68;
  const houseW = width * 0.22;
  const personX = x0 + width * 0.1;
  return (
    <g aria-hidden="true">
      <line x1={x0} x2={x0} y1={top - 24} y2={base + 20} stroke="#e2e8f0" strokeWidth="1.5" />
      <text x={(x0 + x1) / 2} y={top - 6} textAnchor="middle" fontSize={fs + 1} fontWeight="700" fill="#334155">
        {C.panel.title}
      </text>
      {/* metre lines */}
      {[0, 2, 4, 6, 8, 10, 12].map((m) => (
        <g key={`m${m}`}>
          <line x1={x0 + 30} x2={x1} y1={sy(m)} y2={sy(m)} stroke={m === 0 ? '#475569' : '#eef2f7'} strokeWidth={m === 0 ? 1.4 : 1} />
          <text x={x0 + 26} y={sy(m) + 4} textAnchor="end" fontSize={fs - 1.5} fill="#64748b">
            {m}
          </text>
        </g>
      ))}
      <text x={x0 + 26} y={sy(13) + 2} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill="#475569">
        {T.m}
      </text>
      {/* house of three storeys (≈ 3 m each) */}
      <rect x={houseX} y={sy(9)} width={houseW} height={9 * kM} fill="#f1f5f9" stroke="#cbd5e1" />
      <path d={`M${houseX - 4},${sy(9)} L${houseX + houseW / 2},${sy(11)} L${houseX + houseW + 4},${sy(9)} Z`} fill="#e2e8f0" stroke="#cbd5e1" />
      {[0, 1, 2].map((f) =>
        [0.2, 0.6].map((fx) => <rect key={`w${f}${fx}`} x={houseX + houseW * fx} y={sy(f * 3 + 2.2)} width={houseW * 0.22} height={1.3 * kM} fill="#dbeafe" stroke="#cbd5e1" />),
      )}
      <text x={houseX + houseW / 2} y={base + 16} textAnchor="middle" fontSize={fs - 1.5} fill="#64748b">
        {C.panel.house}
      </text>
      <Person x={personX} ground={base} hPx={1.7 * kM} />
      <text x={personX} y={base + 16} textAnchor="middle" fontSize={fs - 1.5} fill="#64748b">
        {C.panel.person}
      </text>
      {cols.map((c) => {
        const Lq = LIQUIDS[c.id];
        const hM = p0 / (Lq.rho * G);
        const on = c.id === liquid;
        const yTop = sy(hM);
        return (
          <g key={c.id}>
            <rect x={c.x - bw / 2 - 2} y={sy(Math.min(12.6, hM + 0.9)) - 2} width={bw + 4} height={base - sy(Math.min(12.6, hM + 0.9)) + 2} rx={bw / 2} fill="rgba(248,250,252,0.9)" stroke={on ? '#0f172a' : '#94a3b8'} strokeWidth={on ? 1.8 : 1.1} />
            <rect x={c.x - bw / 2} y={yTop} width={bw} height={base - yTop} fill={Lq.deep} opacity={c.id === 'hg' ? 1 : 0.75} />
            <Pill x={c.x} y={yTop - (c.id === 'hg' ? 20 : 30)} text={c.id === 'hg' ? `${whole(hM * 1000, dec)} ${T.mm}` : `${fmt(hM, 1, dec)} ${T.m}`} bg={on ? '#0f172a' : '#64748b'} size={fs - 1} />
            <text x={c.x} y={base + 16} textAnchor="middle" fontSize={fs - 1} fontWeight={on ? 800 : 600} fill={on ? '#0f172a' : '#64748b'}>
              {C.liquids[c.id].short}
            </text>
          </g>
        );
      })}
      <text x={(x0 + x1) / 2} y={base + 36} textAnchor="middle" fontSize={fs - 1} fill="#334155">
        {C.panel.note}
      </text>
    </g>
  );
}
