import { useState } from 'react';
import { Gauge, Lightbulb } from 'lucide-react';

import { Explain, Pill, RangeField, Readout, Segmented, fmt, groupThousands, textWidth, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE } from '../kit/scene';
import {
  BalanceLine,
  Chip,
  ENERGY,
  ENERGY_INK,
  ENERGY_TEXT,
  EqBand,
  EnergyBars,
  EnergyGraph,
  EnergyPanel,
  FORCE,
  FormulaTile,
  GroupLabel,
  InfoBox,
  LabScene,
  PaperGrid,
  PlayControls,
  Rich,
  Ruler,
  SvgSym,
  Thermometer,
  eDigits,
  hash01,
  lineView,
  mix,
  niceMax,
  round,
  rulerStep,
  tickDigits,
  trim,
} from './FrictionWorkHeat.parts';

/**
 * Tab 3 — a car brakes to a stop. The pads squeeze the spinning discs; the
 * friction between them does negative work and the whole kinetic energy
 * mv₀²/2 becomes heat in the discs: Q = −A_ishq = mv₀²/2. With c ≈ 460
 * J/(kg·K) for steel and 10 kg of discs the temperature rise is
 * ΔT = Q/(c·m_d). The heat that goes to the air and tyres during the short
 * stop is neglected. Steady braking at a = 5 m/s².
 * Preset: 1500 kg from 72 km/h (20 m/s) → E_k = 300 kJ, t = 4 s, s = 40 m,
 * ΔT = 300 000 / (460 · 10) ≈ 65.2 K → about 85 °C from 20 °C.
 * Strings come from T.brake.
 */

const DECEL = 5;
const C_STEEL = 460;
const M_DISC = 10;
const T_AIR = 20;
const SPEEDS = [36, 72, 108, 144];
const IDLE = { t: 0, running: false, done: false };

/** False-colour palette of a thermal camera, 20 °C … 400 °C. */
const IRON = [
  [0, '#1e1b4b'],
  [0.15, '#5b21b6'],
  [0.3, '#be185d'],
  [0.5, '#ea580c'],
  [0.7, '#f59e0b'],
  [0.85, '#fde047'],
  [1, '#fefce8'],
];
const T_LO = 20;
const T_HI = 400;
function thermal(T) {
  const f = Math.min(1, Math.max(0, (T - T_LO) / (T_HI - T_LO)));
  for (let i = 1; i < IRON.length; i += 1) {
    if (f <= IRON[i][0]) return mix(IRON[i - 1][1], IRON[i][1], (f - IRON[i - 1][0]) / (IRON[i][0] - IRON[i - 1][0]));
  }
  return IRON[IRON.length - 1][1];
}

export default function BrakeSim({ T }) {
  const L = T.brake;
  const dec = T.decimal;
  const fr = T.sym.fr;
  const k = T.sym.k;
  const [kmh, setKmh] = useState(72);
  const [m, setM] = useState(1500);
  const [sim, setSim] = useState(IDLE);

  const v0 = kmh / 3.6;
  const tStop = v0 / DECEL;
  const sStop = (v0 * v0) / (2 * DECEL);
  const E0 = (m * v0 * v0) / 2;
  const dTEnd = E0 / (C_STEEL * M_DISC);

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(tStop, p.t + dt);
      const done = t >= tStop - 1e-9;
      return { t, running: !done, done };
    });
  });

  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);
  const change = (setter) => (n) => {
    setter(n);
    setSim(IDLE);
  };

  const t = sim.t;
  const braking = t > 0 && !sim.done;
  const v = sim.done ? 0 : Math.max(0, v0 - DECEL * t);
  const x = sim.done ? sStop : Math.min(sStop, v0 * t - 0.5 * DECEL * t * t);
  const Ek = (m * v * v) / 2;
  const Q = E0 - Ek;
  const dT = Q / (C_STEEL * M_DISC);
  const Tdisc = T_AIR + dT;
  const kd = eDigits(E0 / 1000);
  const KJ = (n) => round(n / 1000, kd, dec);
  const D = (n) => trim(n, dec);

  /* explanation */
  let key = 'idle';
  if (sim.done) key = 'done';
  else if (t > 0) key = t < 0.45 * tStop ? 'braking' : 'heating';
  const settled = useSettled(key, key === 'braking' || key === 'heating' ? 300 : 0);
  const ex = L.explain;
  const TEnd = T_AIR + dTEnd;
  const text = {
    idle: ex.idle(fmt(kmh, 0, dec), KJ(E0)),
    braking: ex.braking(fr),
    heating: ex.heating,
    done: `${ex.done(KJ(E0), round(dTEnd, 1, dec), fmt(TEnd, 0, dec))}${TEnd > 250 ? ex.hot : ex.square}`,
  }[settled];
  const tone = { idle: '#22d3ee', braking: '#f87171', heating: '#fb923c', done: '#34d399' }[settled];

  /* energy–time curves, kJ */
  const N = 40;
  const ekAt = (tt) => (m * (v0 - DECEL * tt) ** 2) / 2 / 1000;
  const plan = Array.from({ length: N + 1 }, (_, i) => (i / N) * tStop);
  const live = plan.filter((tt) => tt < t);
  if (t > 0) live.push(t);
  const xTop = niceMax(tStop);
  const yTop = niceMax((E0 / 1000) * 1.04);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.presetsLabel}</GroupLabel>
          <Segmented
            label={L.presetsLabel}
            className="grid-cols-2 md:grid-cols-4"
            size="lg"
            value={kmh}
            onChange={change(setKmh)}
            options={SPEEDS.map((s) => ({
              value: s,
              label: `${s} ${T.kmh}`,
              sub: L.presetSub(round((m * (s / 3.6) ** 2) / 2000, 0, dec)),
              icon: Gauge,
            }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <BrakeScene
          T={T}
          kmh={kmh}
          t={t}
          x={x}
          v={v}
          sStop={sStop}
          Tdisc={Tdisc}
          braking={braking}
          footer={
            <EqBand
              title={L.band}
              terms={[
                { sym: `E_{${k}0}`, value: `${KJ(E0)} ${T.kJ}`, color: ENERGY_INK.tot },
                { op: '=' },
                { sym: `E_{${k}}`, value: KJ(Ek), color: ENERGY_INK.k },
                { op: '+' },
                { sym: 'Q', value: KJ(Q), color: ENERGY_INK.q },
              ]}
              extra={`ΔT = Q / (c · m_{d}) = ${round(dT, 1, dec)} ${T.K}`}
            />
          }
        />
        <EnergyPanel title={L.panel.title} unit={T.kJ}>
          <EnergyBars
            items={[
              { id: 'k', label: `E_{${k}}`, value: Ek / 1000, color: ENERGY.k, text: ENERGY_TEXT.k },
              { id: 'q', label: 'Q', value: Q / 1000, color: ENERGY.q, text: ENERGY_TEXT.q },
            ]}
            stack={['k', 'q']}
            total={E0 / 1000}
            max={(E0 / 1000) * 1.2}
            digits={kd}
            decimal={dec}
            stackLabel={`E_{${k}} + Q`}
            ariaLabel={L.panel.aria(KJ(Ek), KJ(Q), KJ(E0))}
          />
          <BalanceLine>
            <Rich>{`E_{${k}} + Q = ${KJ(Ek)} + ${KJ(Q)} = ${KJ(E0)} ${T.kJ}`}</Rich>
            <span className="text-gray-500"> · {L.panel.constant}</span>
          </BalanceLine>
          <InfoBox
            title={L.panel.discs}
            items={[
              ['m_{d}', `${M_DISC} ${T.kg}`, '#e2e8f0'],
              ['c', `${C_STEEL} ${T.cUnit}`, '#e2e8f0'],
              ['ΔT', `${round(dT, 1, dec)} ${T.K}`, ENERGY_TEXT.q],
            ]}
          />
          <p className="text-[12px] leading-snug tabular-nums text-gray-400">
            <Rich>{L.panel.law(fr, k)}</Rich>
          </p>
        </EnergyPanel>
      </div>

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        <Rich>{text}</Rich>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.v} symbol="v" value={fmt(v * 3.6, 0, dec)} unit={T.kmh} accent={PALETTE.vel} textColor={PALETTE.velText} sub={L.vSub(fmt(v, 1, dec))}>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${(v / v0) * 100}%` }} />
          </div>
        </Readout>
        <Readout label={L.readouts.Ek} symbol={<Rich>{`E_{${k}}`}</Rich>} value={KJ(Ek)} unit={T.kJ} accent={ENERGY.k} textColor={ENERGY_TEXT.k} sub={L.EkSub(groupThousands(m), T.kg)} />
        <Readout label={L.readouts.Q} symbol="Q" value={KJ(Q)} unit={T.kJ} accent={ENERGY.q} textColor={ENERGY_TEXT.q} sub={<Rich>{L.QSub(fr)}</Rich>} active={sim.done} />
        <Readout label={L.readouts.T} symbol="T" value={fmt(Tdisc, 1, dec)} unit="°C" accent="#ef4444" textColor="#fca5a5" sub={L.TSub(round(dT, 1, dec))}>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, (Tdisc / T_HI) * 100)}%`, background: thermal(Tdisc) }} />
          </div>
        </Readout>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-200">{L.formulasTitle}</p>
          {sim.done && <p className="text-xs font-semibold text-emerald-300">✓ {L.allHeat}</p>}
        </div>
        <div className="mt-2.5 grid gap-2 md:grid-cols-3">
          <FormulaTile
            tag={L.f1}
            color={ENERGY_TEXT.k}
            general={`E_{${k}} = mv₀² / 2`}
            filled={`= ${groupThousands(m)} · ${D(v0)}² / 2`}
            result={`E_{${k}} = ${groupThousands(E0)} ${T.J}`}
          />
          <FormulaTile
            tag={L.f2}
            color={ENERGY_TEXT.q}
            general={`Q = −A_{${fr}} = E_{${k}0} − E_{${k}}`}
            filled={`= ${KJ(E0)} − ${KJ(Ek)}`}
            result={`Q = ${KJ(Q)} ${T.kJ}`}
            note={L.f2note}
          />
          <FormulaTile
            tag={L.f3}
            color="#fca5a5"
            general="ΔT = Q / (c · m_{d})"
            filled={`= ${groupThousands(Q)} / (${C_STEEL} · ${M_DISC})`}
            result={`ΔT = ${round(dT, 1, dec)} ${T.K} → ${fmt(Tdisc, 0, dec)} °C`}
            ok={sim.done}
          />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="fwh-kmh"
            label={L.v0}
            symbol={<Rich>v₀</Rich>}
            min={18}
            max={144}
            step={9}
            value={kmh}
            onChange={change(setKmh)}
            accent={PALETTE.vel}
            display={`${fmt(kmh, 0, dec)} ${T.kmh}`}
            hint={L.v0Hint(trim(v0, dec, 2))}
          />
          <RangeField
            id="fwh-mcar"
            label={L.m}
            symbol="m"
            min={800}
            max={2000}
            step={100}
            value={m}
            onChange={change(setM)}
            accent="#a5b4fc"
            display={`${groupThousands(m)} ${T.kg}`}
            hint={L.mHint}
          />
          <InfoBox
            title={L.info.title}
            items={[
              ['a', `${DECEL} ${T.ms2}`, PALETTE.accText],
              [L.info.t, `${round(tStop, 1, dec)} ${T.s}`, '#a5f3fc'],
              [L.info.s, `${round(sStop, 1, dec)} ${T.m}`, PALETTE.dispText],
            ]}
          />
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <EnergyGraph
            title={L.graph.title}
            series={[
              { id: 'k', label: `E_{${k}}`, color: ENERGY_TEXT.k, plan: plan.map((tt) => ({ x: tt, y: ekAt(tt) })), live: live.map((tt) => ({ x: tt, y: ekAt(tt) })) },
              {
                id: 'q',
                label: 'Q',
                color: ENERGY_TEXT.q,
                plan: plan.map((tt) => ({ x: tt, y: E0 / 1000 - ekAt(tt) })),
                live: live.map((tt) => ({ x: tt, y: E0 / 1000 - ekAt(tt) })),
              },
              { id: 'tot', label: `E_{${k}} + Q`, color: ENERGY_TEXT.tot, dash: true, plan: [{ x: 0, y: E0 / 1000 }, { x: xTop, y: E0 / 1000 }] },
            ]}
            xMax={xTop}
            yMax={yTop}
            xLabel={L.graph.x}
            yLabel={L.graph.y}
            marker={t}
            note={L.graph.note}
            decimal={dec}
            xDigits={tickDigits(xTop)}
            yDigits={tickDigits(yTop)}
            height={220}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

/** A wheel with its brake disc showing through the rim; `rot` in degrees, `discColor` from the thermal palette. */
function CarWheel({ cx, cy, r, rot, discColor }) {
  return (
    <g transform={`translate(${cx.toFixed(1)} ${cy.toFixed(1)})`}>
      <circle r={r} fill="#111827" />
      <circle r={r * 0.66} fill="#cbd5e1" />
      <circle r={r * 0.48} fill={discColor} />
      <g transform={`rotate(${rot.toFixed(1)})`}>
        {[0, 72, 144, 216, 288].map((a) => (
          <line key={a} x1={0} y1={0} x2={r * 0.62 * Math.cos((a * Math.PI) / 180)} y2={r * 0.62 * Math.sin((a * Math.PI) / 180)} stroke="#64748b" strokeWidth={Math.max(1.2, r * 0.14)} strokeLinecap="round" />
        ))}
      </g>
      <circle r={r * 0.14} fill="#334155" />
    </g>
  );
}

/** The car, side view, facing right; (x, y) is the front bumper at road level, `len` its length in px. */
function Car({ x, y, len, rot, braking, discColor }) {
  const s = len / 120;
  const P = (px, py) => `${(x + px * s).toFixed(1)},${(y + py * s).toFixed(1)}`;
  const body = `M${P(-118, -12)} L${P(-118, -27)} Q${P(-117, -33)} ${P(-110, -34)} L${P(-86, -36)} L${P(-68, -50)} Q${P(-64, -53)} ${P(-58, -53)} L${P(-34, -53)} Q${P(-28, -53)} ${P(-24, -49)} L${P(-12, -37)} L${P(-3, -35)} Q${P(2, -33)} ${P(2, -27)} L${P(2, -12)} Z`;
  const win1 = `M${P(-83, -37)} L${P(-67, -49)} L${P(-48, -49)} L${P(-48, -37)} Z`;
  const win2 = `M${P(-45, -37)} L${P(-45, -49)} L${P(-34, -49)} Q${P(-30, -49)} ${P(-27, -46)} L${P(-18, -37)} Z`;
  const wr = 11 * s;
  return (
    <g>
      <ellipse cx={x - 58 * s} cy={y + 1} rx={62 * s} ry={3} fill="#0f172a" opacity="0.18" />
      <path d={body} fill="#cbd5e1" stroke="#475569" strokeWidth={1.3} strokeLinejoin="round" />
      <path d={win1} fill="#dbeafe" stroke="#64748b" strokeWidth={1} />
      <path d={win2} fill="#dbeafe" stroke="#64748b" strokeWidth={1} />
      <line x1={x - 116 * s} x2={x} y1={y - 22 * s} y2={y - 22 * s} stroke="#94a3b8" strokeWidth={1} />
      <circle cx={x - 96 * s} cy={y - 11 * s} r={wr + 2.5 * s} fill="#475569" />
      <circle cx={x - 24 * s} cy={y - 11 * s} r={wr + 2.5 * s} fill="#475569" />
      <rect x={x - 3 * s} y={y - 31 * s} width={4 * s} height={5 * s} rx={1} fill="#fde68a" />
      {braking && <circle cx={x - 117 * s} cy={y - 28 * s} r={9 * s} fill="#ef4444" opacity="0.35" />}
      <rect x={x - 119 * s} y={y - 31 * s} width={4 * s} height={6 * s} rx={1} fill={braking ? '#ef4444' : '#991b1b'} />
      <CarWheel cx={x - 96 * s} cy={y - 11 * s} r={wr} rot={rot} discColor={discColor} />
      <CarWheel cx={x - 24 * s} cy={y - 11 * s} r={wr} rot={rot} discColor={discColor} />
    </g>
  );
}

/**
 * The front brake "through a thermal camera": the drilled disc in false
 * colour (dark = cool, yellow-white = hot), the caliper with the pads on top
 * and, while braking, the friction force on the disc rim against its spin.
 */
function ThermalDisc({ cx, cy, r, T, rot, braking, title, fs, fr, showLabel }) {
  const col = thermal(T);
  const rd = r * 0.8;
  const holes = Array.from({ length: 10 }, (_, i) => {
    const a = ((rot + i * 36) * Math.PI) / 180;
    return <circle key={i} cx={cx + Math.cos(a) * r * 0.58} cy={cy + Math.sin(a) * r * 0.58} r={r * 0.055} fill="#0b1020" opacity="0.75" />;
  });
  const arcBand = (r1, r2, a1, a2) => {
    const p = (rr, a) => `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
    return `M${p(r1, a1)} A${r1},${r1} 0 0 1 ${p(r1, a2)} L${p(r2, a2)} A${r2},${r2} 0 0 0 ${p(r2, a1)} Z`;
  };
  const a1 = (-90 - 30) * (Math.PI / 180);
  const a2 = (-90 + 30) * (Math.PI / 180);
  return (
    <g>
      <defs>
        <clipPath id="fwh-thermal-clip">
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>
      <circle cx={cx} cy={cy} r={r + 5} fill="#fff" stroke="#cbd5e1" strokeWidth={1} />
      <g clipPath="url(#fwh-thermal-clip)">
        <rect x={cx - r} y={cy - r} width={2 * r} height={2 * r} fill="#0f172a" />
        <circle cx={cx} cy={cy} r={rd + r * 0.1} fill={mix('#0f172a', col, 0.28)} />
        <circle cx={cx} cy={cy} r={rd} fill={col} />
        {holes}
        <circle cx={cx} cy={cy} r={r * 0.34} fill={mix('#1e1b4b', col, 0.45)} stroke="#0b1020" strokeOpacity="0.5" />
        {[0, 72, 144, 216, 288].map((a) => {
          const aa = ((rot + a) * Math.PI) / 180;
          return <circle key={a} cx={cx + Math.cos(aa) * r * 0.2} cy={cy + Math.sin(aa) * r * 0.2} r={r * 0.04} fill="#0b1020" />;
        })}
        <path d={arcBand(rd * 0.62, rd * 1.12, a1, a2)} fill={mix('#334155', col, 0.4)} stroke="#0b1020" strokeWidth={1.2} />
      </g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#334155" strokeWidth={2} />
      {braking && (
        <g>
          <line x1={cx + r * 0.22} y1={cy - rd * 0.5} x2={cx - r * 0.12} y2={cy - rd * 0.5} stroke={FORCE.fr} strokeWidth={2.4} />
          <path d={`M${cx - r * 0.24},${cy - rd * 0.5} l${r * 0.13},${-r * 0.07} l0,${r * 0.14} Z`} fill={FORCE.fr} />
          {showLabel && <SvgSym x={cx - r * 0.27} y={cy - rd * 0.5 + fs * 0.35} main="F" sub={fr} color={FORCE.fr} fs={fs} anchor="end" />}
        </g>
      )}
      <text x={cx} y={cy - r - 10} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#334155" stroke="#fbfcfe" strokeWidth={3} paintOrder="stroke">
        {title}
      </text>
    </g>
  );
}

function layout(narrow) {
  const carL = narrow ? 80 : 128;
  const yR = narrow ? 196 : 262;
  const roadD = narrow ? 14 : 20;
  const rulerY = yR + roadD + (narrow ? 14 : 18);
  return { carL, yR, roadD, rulerY, H: rulerY + 30 };
}

function BrakeScene({ T, kmh, t, x, v, sStop, Tdisc, braking, footer }) {
  const L = T.brake;
  const dec = T.decimal;
  return (
    <LabScene
      legend={[
        { color: PALETTE.vel, label: L.legend.v, kind: 'arrow' },
        { color: '#334155', label: L.legend.line, kind: 'dash' },
        { color: '#ea580c', label: L.legend.thermal, kind: 'box' },
      ]}
      chips={
        <Chip>
          {L.chipReal} · t = {fmt(t, 1, dec)} {T.s}
        </Chip>
      }
      height={(W, narrow) => layout(narrow).H}
      footer={footer}
      ariaLabel={L.sceneLabel(fmt(kmh, 0, dec), fmt(v * 3.6, 0, dec), fmt(x, 1, dec), fmt(Tdisc, 0, dec))}
    >
      {(W, H, narrow) => {
        const { carL, yR, roadD, rulerY } = layout(narrow);
        const fs = narrow ? 10 : 12;
        const padL = carL + (narrow ? 10 : 16);
        const padR = narrow ? 14 : 22;
        const view = lineView(0, sStop * 1.14, W, padL, padR);
        const step = rulerStep(view, narrow ? 46 : 64);
        const front = view.sx(x);
        const ox = view.sx(0);
        const stopX = view.sx(sStop);
        const box = { w: W, h: H };
        const s = carL / 120;
        const wheelR = 11 * s;
        const rot = (((front - ox) / wheelR) * 180) / Math.PI;
        const r = narrow ? 38 : 50;
        const mcx = narrow ? 16 + r : W - 150;
        const mcy = narrow ? 30 + r : 152;
        const thX = narrow ? mcx + r + 22 : W - 62;
        const thTop = narrow ? 34 : mcy - r + 4;
        const thH = narrow ? 64 : 2 * r - 12;
        const wheelX = front - 24 * s;
        const wheelY = yR - 11 * s;
        const dxC = wheelX - mcx;
        const dyC = wheelY - mcy;
        const dC = Math.hypot(dxC, dyC);
        const stopText = L.distTag(round(sStop, 1, dec));
        const stopW = textWidth(stopText, fs, 600) + 16;
        const kv = narrow ? 1.8 : 3;
        const strip = [];
        for (let i = 0; i < 24; i += 1) {
          const T0 = 0 + (i / 24) * 400;
          strip.push(<rect key={i} x={thX - (narrow ? 13 : 16)} y={thTop + thH - ((i + 1) / 24) * thH} width={4} height={thH / 24 + 0.5} fill={thermal(Math.max(T_LO, T0))} />);
        }
        return (
          <>
            <rect width={W} height={H} fill="#fbfcfe" />
            <PaperGrid view={view} W={W} top={0} bottom={rulerY - 4} step={step} rowPx={narrow ? 24 : 28} />
            {/* road */}
            <rect x={0} y={yR} width={W} height={roadD} fill="#4b5563" />
            {Array.from({ length: Math.floor(W / 7) }, (_, i) => (
              <circle key={i} cx={hash01(i * 1.3) * W} cy={yR + 3 + hash01(i * 2.7 + 1) * (roadD - 6)} r={0.9} fill="#9ca3af" />
            ))}
            <line x1={0} x2={W} y1={yR} y2={yR} stroke="#1f2937" strokeWidth={1.8} />
            {/* brake point and stopping point */}
            <line x1={ox} x2={ox} y1={yR - (narrow ? 50 : 76)} y2={rulerY} stroke="#334155" strokeWidth={1.6} strokeDasharray="4 4" />
            <text x={ox + 5} y={yR - (narrow ? 42 : 66)} fontSize={fs} fontWeight="700" fill="#334155" stroke="#fbfcfe" strokeWidth={3} paintOrder="stroke">
              {L.brakeLine}
            </text>
            <line x1={stopX} x2={stopX} y1={yR - (narrow ? 50 : 72)} y2={rulerY} stroke={PALETTE.disp} strokeWidth={1.8} strokeDasharray="6 4" />
            <Pill
              x={stopX + 8 + stopW < W - 4 ? stopX + 8 + stopW / 2 : stopX - 8 - stopW / 2}
              y={stopX + 8 + stopW < W - 4 ? yR - (narrow ? 12 : 16) : yR - (narrow ? 50 : 72)}
              text={stopText}
              bg={PALETTE.disp}
              size={fs}
              box={box}
            />
            <Car x={front} y={yR} len={carL} rot={rot} braking={braking} discColor={thermal(Tdisc)} />
            {v > 0.05 && (
              <g>
                <line x1={front + 4} x2={front + 4 + v * kv} y1={yR - 26 * s} y2={yR - 26 * s} stroke={PALETTE.vel} strokeWidth={2.8} strokeLinecap="round" />
                <path d={`M${front + 10 + v * kv},${yR - 26 * s} l-9,-5 l0,10 Z`} fill={PALETTE.vel} />
                <SvgSym x={front + 14 + v * kv} y={yR - 26 * s + 4} main="v" color={PALETTE.vel} fs={fs + 1} />
              </g>
            )}
            {/* thermal camera on the front brake, and a thermometer */}
            {dC > r + 12 && (
              <line
                x1={mcx + (dxC / dC) * (r + 5)}
                y1={mcy + (dyC / dC) * (r + 5)}
                x2={wheelX}
                y2={wheelY}
                stroke="#334155"
                strokeOpacity={0.45}
                strokeWidth={1.2}
                strokeDasharray="3 3"
              />
            )}
            <ThermalDisc cx={mcx} cy={mcy} r={r} T={Tdisc} rot={rot * 0.5} braking={braking} title={L.thermal} fs={fs} fr={T.sym.fr} showLabel={!narrow} />
            {strip}
            <Thermometer x={thX} top={thTop} h={thH} value={Tdisc} min={0} max={400} step={100} unit="°C" decimal={dec} fs={narrow ? 9 : 10} tubeW={narrow ? 8 : 10} />
            {/* ruler */}
            <rect x={0} y={rulerY - 1} width={W} height={H - rulerY + 1} fill="#f8fafc" />
            <Ruler view={view} W={W} y={rulerY} step={step} unit={L.axisX} decimal={dec} fs={narrow ? 10 : 11} />
            {x > 0.001 && <line x1={ox} x2={front} y1={rulerY - 4} y2={rulerY - 4} stroke={PALETTE.disp} strokeWidth={3} strokeLinecap="round" />}
            <path d={`M${front},${rulerY - 1} l-5,-8 l10,0 Z`} fill={PALETTE.disp} />
          </>
        );
      }}
    </LabScene>
  );
}
