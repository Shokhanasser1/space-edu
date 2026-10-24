import { useMemo, useState } from 'react';
import { Footprints, Gauge as GaugeIcon, Lightbulb, RotateCcw } from 'lucide-react';

import { Btn, Explain, RangeField, Readout, Segmented, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { TimeGraph } from '../kit/scene';
import {
  Chip,
  Eq,
  FC,
  FlowDashes,
  ForceArrow,
  Gauge,
  GroupLabel,
  LabScene,
  Panel,
  SceneRow,
  Step,
  StepsPanel,
  SvgSym,
  Sym,
  big,
  m2,
  useSmooth,
} from './HydraulicPress.parts';

/**
 * Tab 3 — hydraulic brakes of a car. The pedal is a lever: the push rod gets
 * F_rod = i·F. In the master cylinder (diameter d₁, S₁ = πd₁²/4) this makes
 * p = F_rod / S₁; by Pascal's law the same p reaches the four wheel
 * cylinders through the brake lines, and each piston (S = πd²/4) presses
 * its pad onto the disc with F = p·S = F_rod·(d/d₁)². Front pistons are
 * usually bigger than the rear ones. To close the gaps each wheel piston
 * moves ≈ 1 mm (stated as an assumption), so the master piston moves
 * x = ΣS·1 mm / S₁ and the pedal i·x — the golden rule again: F·s_pedal =
 * ΣF·1 mm.
 * Preset F = 200 N, i = 4, d₁ = 20 mm, d_front = 50 mm, d_rear = 40 mm:
 *   F_rod = 800 N, S₁ = 314.16 mm², p = 2.546 MPa,
 *   F_front = 800·(50/20)² = 5000 N, F_rear = 800·(40/20)² = 3200 N,
 *   total 16 400 N; x = 6440.3 / 314.16 = 20.5 mm, pedal 82 mm,
 *   A = 200 N · 0.082 m = 16.4 J = 16 400 N · 0.001 m.
 * The drawing is a schematic (not to scale): the pedal and the master
 * cylinder in side view, the four wheels from above with the caliper cut
 * open. The wheels spin while the car rolls and stop faster when the
 * clamping force is larger (only a qualitative picture, no numbers).
 */

const PAD_TRAVEL = 1; // mm each wheel piston moves to press its pads
const P_SCALE = 10; // MPa at the dark end of the colour scale
const TOTAL_REF = 16400; // N — total clamping force of the preset: stops the wheels in ≈ 1.3 s
const LONG_PEDAL = 150; // mm — a pedal travel beyond this is uncomfortable
const PRESETS = {
  base: { F: 200, i: 4, dm: 20, df: 50, dr: 40 },
  strong: { F: 400, i: 4, dm: 20, df: 50, dr: 40 },
  small: { F: 200, i: 4, dm: 15, df: 50, dr: 40 },
  lever: { F: 200, i: 6, dm: 20, df: 50, dr: 40 },
};

function brakePhysics(F, i, dm, df, dr) {
  const Frod = F * i;
  const Sm = (Math.PI * dm * dm) / 4; // mm²
  const Sf = (Math.PI * df * df) / 4;
  const Sr = (Math.PI * dr * dr) / 4;
  const p = Frod / Sm; // N/mm² = MPa
  const Ff = p * Sf;
  const Fr = p * Sr;
  const total = 2 * Ff + 2 * Fr;
  const xm = ((2 * Sf + 2 * Sr) * PAD_TRAVEL) / Sm; // mm
  const pedal = i * xm; // mm
  return { Frod, Sm, Sf, Sr, p, Ff, Fr, total, xm, pedal, work: (F * pedal) / 1000 };
}

/** Brake fluid coloured by its pressure: pale amber at 0 → orange → dark red at P_SCALE. */
export function pColor(pMPa) {
  const t = clamp(pMPa / P_SCALE, 0, 1);
  const A = [253, 230, 138];
  const B = [251, 146, 60];
  const C = [185, 28, 28];
  const mix = (a, b, u) => a.map((v, j) => Math.round(v + (b[j] - v) * u));
  const c = t < 0.5 ? mix(A, B, t / 0.5) : mix(B, C, (t - 0.5) / 0.5);
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/* layouts in design units, scaled to the scene */
const WIDE = {
  DW: 680,
  DH: 470,
  P: { x: 112, y: 70 },
  LP: 250,
  yM: 205,
  mX0: 186,
  mX1: 330,
  pist0: 208,
  res: { x0: 236, x1: 288 },
  gauge: { x: 300, y: 112, r: 30 },
  trunk: 'M330,205 L520,205',
  junction: { x: 520, y: 205 },
  bus: { x: 520, y0: 115, y1: 360 },
  car: { x0: 380, x1: 660, y0: 26, y1: 452 },
  units: [
    { id: 'fl', x: 420, y: 115, side: -1, axle: 'front' },
    { id: 'fr', x: 620, y: 115, side: 1, axle: 'front' },
    { id: 'rl', x: 420, y: 360, side: -1, axle: 'rear' },
    { id: 'rr', x: 620, y: 360, side: 1, axle: 'rear' },
  ],
  fs: 12,
};
const NARROW = {
  DW: 360,
  DH: 646,
  P: { x: 70, y: 16 },
  LP: 190,
  yM: 112,
  mX0: 104,
  mX1: 236,
  pist0: 124,
  res: { x0: 150, x1: 186 },
  gauge: { x: 214, y: 46, r: 23 },
  trunk: 'M236,112 L262,112 L262,262 L180,262',
  junction: { x: 180, y: 262 },
  bus: { x: 180, y0: 262, y1: 566 },
  car: { x0: 38, x1: 322, y0: 282, y1: 640 },
  units: [
    { id: 'fl', x: 82, y: 366, side: -1, axle: 'front' },
    { id: 'fr', x: 278, y: 366, side: 1, axle: 'front' },
    { id: 'rl', x: 82, y: 566, side: -1, axle: 'rear' },
    { id: 'rr', x: 278, y: 566, side: 1, axle: 'rear' },
  ],
  fs: 11,
};

/* ==================================================================== sim */

export default function BrakeSim({ T }) {
  const L = T.brakes;
  const dec = T.decimal;
  const [preset, setPreset] = useState('base');
  const [F, setF] = useState(PRESETS.base.F);
  const [i, setI] = useState(PRESETS.base.i);
  const [dm, setDm] = useState(PRESETS.base.dm);
  const [df, setDf] = useState(PRESETS.base.df);
  const [dr, setDr] = useState(PRESETS.base.dr);
  const [sim, setSim] = useState({ braking: false, w: 1, spin: 0, used: false });
  const [touched, setTouched] = useState(false);

  const ph = useMemo(() => brakePhysics(F, i, dm, df, dr), [F, i, dm, df, dr]);
  const pNow = useSmooth(sim.braking ? ph.p : 0, 0.18, 1e-3);
  const gap = useSmooth(sim.braking ? 0 : 1, 0.09, 1e-3);
  const share = ph.p > 0 ? pNow / ph.p : 0;

  useRafLoop(sim.w > 0, (dt) => {
    setSim((s) => {
      let w = s.w;
      if (s.braking) w = Math.max(0, w - dt * 0.75 * ((share * ph.total) / TOTAL_REF) * (1 - gap));
      return { ...s, w, spin: s.spin + w * dt * 150 };
    });
  });

  const pick = (id) => {
    const ps = PRESETS[id];
    setPreset(id);
    setF(ps.F);
    setI(ps.i);
    setDm(ps.dm);
    setDf(ps.df);
    setDr(ps.dr);
    setTouched(true);
  };
  const change = (fn) => (v) => {
    fn(v);
    setPreset(null);
    setTouched(true);
  };
  const toggle = () => {
    setTouched(true);
    setSim((s) => ({ ...s, braking: !s.braking, used: true }));
  };
  const reset = () => setSim({ braking: false, w: 1, spin: 0, used: false });

  const B = (v) => big(v, 0, dec);
  const P2 = (v) => fmt(v, 2, dec);
  const sm = (v) => (Math.abs(v - Math.round(v)) < 0.05 ? B(Math.round(v)) : big(v, 1, dec));

  /* ---- explanation */
  let key;
  if (sim.braking) key = sim.w <= 0 ? 'stopped' : 'braking';
  else if (ph.pedal > LONG_PEDAL) key = 'longPedal';
  else if (sim.used) key = 'released';
  else key = touched ? 'preview' : 'intro';
  const settled = useSettled(key, 200);
  const ex = L.explain;
  const text = {
    intro: ex.intro(sm(i)),
    preview: ex.preview(P2(ph.p), B(ph.Ff), B(ph.Fr)),
    braking: df === dr ? ex.brakingEq(P2(ph.p), B(ph.Ff)) : ex.braking(P2(ph.p), df, B(ph.Ff), dr, B(ph.Fr)),
    stopped: ex.stopped(B(F), B(ph.total), sm(ph.total / F)),
    released: ex.released,
    longPedal: ex.longPedal(fmt(ph.pedal / 10, 1, dec)),
  }[settled];
  const tone = { intro: '#22d3ee', preview: '#60a5fa', braking: '#fb923c', stopped: '#34d399', released: '#a78bfa', longPedal: '#fbbf24' }[settled];

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
            options={Object.keys(PRESETS).map((id) => ({ value: id, label: L.presets[id].name, sub: L.presets[id].sub }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 xl:flex">
          <Btn variant="primary" icon={Footprints} onClick={toggle} className="xl:min-w-[168px] min-h-[52px] text-[15px]">
            {sim.braking ? L.release : L.brake}
          </Btn>
          <Btn icon={RotateCcw} onClick={reset} disabled={!sim.used && sim.w === 1} className="min-h-[52px] text-[15px]">
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
        renderScene={(fitH) => <BrakeScene T={T} F={F} i={i} dm={dm} df={df} dr={dr} ph={ph} pNow={pNow} gap={gap} sim={sim} fitH={fitH} />}
        side={<BrakeSteps T={T} F={F} i={i} dm={dm} df={df} dr={dr} ph={ph} />}
      />

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.p} symbol="p" value={P2(pNow)} unit={T.MPa} accent="#ea580c" textColor="#fdba74" active={sim.braking} sub={L.pSub} />
        <Readout
          label={L.readouts.Ff}
          symbol={<Sym>{L.sym.Ff}</Sym>}
          value={B(pNow * ph.Sf)}
          unit={T.N}
          accent={FC.f2}
          textColor={FC.f2Text}
          active={sim.braking}
          sub={L.FSub(df, fmt(ph.Sf / 100, 2, dec))}
        />
        <Readout
          label={L.readouts.Fr}
          symbol={<Sym>{L.sym.Fr}</Sym>}
          value={B(pNow * ph.Sr)}
          unit={T.N}
          accent="#0891b2"
          textColor="#67e8f9"
          active={sim.braking}
          sub={L.FSub(dr, fmt(ph.Sr / 100, 2, dec))}
        />
        <Readout label={L.readouts.gain} symbol={<Sym>{`${L.sym.Ff} / F`}</Sym>} value={`×${sm(ph.Ff / F)}`} accent={FC.gain} textColor={FC.gainText} sub={L.gainSub(B(ph.total), sm(ph.total / F))} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-2">
          <RangeField id="hp-br-f" label={L.F} symbol="F" min={50} max={500} step={10} value={F} onChange={change(setF)} accent={FC.f1} display={`${F} ${T.N}`} hint={L.FHint(fmt(F / 9.8, 0, dec))} />
          <RangeField id="hp-br-i" label={L.i} symbol="i" min={2} max={6} step={0.5} value={i} onChange={change(setI)} accent="#0891b2" display={`${fmt(i, 1, dec)} : 1`} hint={L.iHint(B(ph.Frod))} />
          <RangeField id="hp-br-dm" label={L.dm} symbol="d₁" min={15} max={30} step={1} value={dm} onChange={change(setDm)} accent="#ea580c" display={`${dm} ${T.mm}`} hint={L.dmHint(fmt(ph.Sm / 100, 2, dec), fmt(ph.pedal / 10, 1, dec))} />
          <RangeField id="hp-br-df" label={L.df} symbol={<Sym>{L.sym.df}</Sym>} min={30} max={60} step={2} value={df} onChange={change(setDf)} accent={FC.f2} display={`${df} ${T.mm}`} />
          <RangeField id="hp-br-dr" label={L.dr} symbol={<Sym>{L.sym.dr}</Sym>} min={20} max={50} step={2} value={dr} onChange={change(setDr)} accent="#0891b2" display={`${dr} ${T.mm}`} />
        </Panel>
        <Panel className="lg:col-span-3">
          <DiameterGraph T={T} ph={ph} df={df} dr={dr} onPick={change((v) => setDf(clamp(Math.round(v / 2) * 2, 30, 60)))} />
        </Panel>
      </div>
    </div>
  );
}

/* ================================================================= scene */

function BrakeScene({ T, F, i, dm, df, dr, ph, pNow, gap, sim, fitH }) {
  const L = T.brakes;
  const dec = T.decimal;
  const share = ph.p > 0 ? pNow / ph.p : 0;
  const fluidMoving = Math.abs(pNow - (sim.braking ? ph.p : 0)) > 0.02 * Math.max(ph.p, 0.1);
  const col = pColor(pNow);

  return (
    <LabScene
      legend={[
        { color: FC.f1, label: L.legend.F, kind: 'arrow' },
        { color: '#0891b2', label: L.legend.rod, kind: 'arrow' },
        { color: FC.f2, label: L.legend.clamp, kind: 'arrow' },
        { color: '#7c2d12', label: L.legend.pad, kind: 'box' },
        { label: L.schemeChip, kind: 'note' },
      ]}
      legendBelow
      chips={
        <>
          <Chip icon={GaugeIcon} color="#ea580c">
            {L.colorChip}
            <span className="h-2.5 w-16 rounded-full" style={{ background: 'linear-gradient(90deg,#fde68a,#fb923c,#b91c1c)' }} aria-hidden="true" />
            {`0–${P_SCALE} ${T.MPa}`}
          </Chip>
        </>
      }
      height={(W, narrow) => fitH ?? (narrow ? Math.round((W / NARROW.DW) * NARROW.DH + 46) : 520)}
      ariaLabel={L.sceneLabel(B0(F, dec), fmt(pNow, 2, dec), B0(pNow * ph.Sf, dec), B0(pNow * ph.Sr, dec))}
    >
      {(W, H, narrow) => {
        const Lt = narrow ? NARROW : WIDE;
        const top = narrow ? 40 : 46;
        const s = Math.min(W / Lt.DW, (H - top - 6) / Lt.DH);
        const ox = (W - Lt.DW * s) / 2;
        const oy = top + (H - top - 6 - Lt.DH * s) / 2;
        const fs = Lt.fs;

        /* pedal geometry: φ from the vertical, + moves the pad towards the master cylinder */
        const kTravel = 6; // design units per cm of master-piston travel
        const xmNow = (ph.xm / 10) * (1 - gap); // cm
        const phi0 = (-10 * Math.PI) / 180;
        const phi = phi0 + Math.min((26 * Math.PI) / 180, (i * kTravel * xmNow) / Lt.LP);
        const pt = (d, a) => ({ x: Lt.P.x + d * Math.sin(a), y: Lt.P.y + d * Math.cos(a) });
        const pad = pt(Lt.LP, phi);
        const A = pt(Lt.LP / i, phi);
        const hm = 12 + (dm - 15) * 0.9;
        const pist = Lt.pist0 + kTravel * xmNow;
        const deg = (phi * 180) / Math.PI;
        const armDir = { x: Math.sin(phi), y: Math.cos(phi) };
        const pushDir = { x: Math.cos(phi), y: -Math.sin(phi) };

        /* force arrows of the pedal on one scale */
        const kA = 70 / (i * F);
        const lenRod = i * F * kA * share;
        const lenFoot = Math.max(12, F * kA) * share;
        const rodDir = { x: pist - A.x, y: Lt.yM - A.y };
        const rodLen = Math.hypot(rodDir.x, rodDir.y);
        const ru = { x: rodDir.x / rodLen, y: rodDir.y / rodLen };
        const Q = { x: pad.x + armDir.x * 30, y: pad.y + armDir.y * 30 };

        /* clamping arrows of the four wheels on one scale */
        const kU = 32 / Math.max(ph.Ff, ph.Fr, 1);

        const units = Lt.units.map((u) => {
          const front = u.axle === 'front';
          const d = front ? df : dr;
          const Fw = pNow * (front ? ph.Sf : ph.Sr);
          return { ...u, d, Fw, len: Fw * kU };
        });

        return (
          <g transform={`translate(${ox.toFixed(1)} ${oy.toFixed(1)}) scale(${s.toFixed(4)})`}>
            {/* the car from above (front up) */}
            <rect
              x={Lt.car.x0}
              y={Lt.car.y0}
              width={Lt.car.x1 - Lt.car.x0}
              height={Lt.car.y1 - Lt.car.y0}
              rx={60}
              fill="#f1f5f9"
              stroke="#cbd5e1"
              strokeWidth="2"
              strokeDasharray="7 6"
            />
            <text x={(Lt.car.x0 + Lt.car.x1) / 2} y={Lt.car.y0 + 22} textAnchor="middle" fontSize={fs - 1} fontWeight="700" fill="#94a3b8">
              {L.frontTag}
            </text>

            {/* brake lines: trunk, bus, branches — coloured by pressure */}
            <BrakeLines Lt={Lt} col={col} units={units} />
            <FlowDashes d={`${Lt.trunk} M${Lt.bus.x},${Lt.bus.y0} L${Lt.bus.x},${Lt.bus.y1}`} phase={sim.spin / 150 + performance.now() / 1000} active={fluidMoving} speed={50} reverse={!sim.braking} color="#ffffff" width={2} />

            {/* wheels */}
            {units.map((u) => (
              <WheelUnit
                key={u.id}
                u={u}
                gap={gap}
                spin={sim.spin}
                col={col}
                fs={fs}
                caption={L.unitCaption(u.axle === 'front' ? L.front : L.rear, u.d)}
                fLabel={u.axle === 'front' ? L.sym.Ff : L.sym.Fr}
                fValue={`${B0(u.Fw, dec)} ${T.N}`}
                pTag={`${fmt(pNow, 2, dec)} ${T.MPa}`}
                bus={Lt.bus.x}
              />
            ))}

            {/* the pedal: bracket, pivot, arm, pad, foot */}
            <g pointerEvents="none">
              <path d={`M${Lt.P.x - 26},${Lt.P.y - 16} L${Lt.P.x + 26},${Lt.P.y - 16}`} stroke="#475569" strokeWidth="3" />
              {[-20, -10, 0, 10, 20].map((dx) => (
                <line key={dx} x1={Lt.P.x + dx} y1={Lt.P.y - 16} x2={Lt.P.x + dx - 7} y2={Lt.P.y - 24} stroke="#94a3b8" strokeWidth="1.4" />
              ))}
              <line x1={Lt.P.x} y1={Lt.P.y - 16} x2={Lt.P.x} y2={Lt.P.y} stroke="#475569" strokeWidth="5" />
              {/* push rod to the master piston */}
              <line x1={A.x} y1={A.y} x2={pist} y2={Lt.yM} stroke="#64748b" strokeWidth="5" strokeLinecap="round" />
              <line x1={Lt.P.x} y1={Lt.P.y} x2={pad.x} y2={pad.y} stroke="#334155" strokeWidth="9" strokeLinecap="round" />
              <circle cx={Lt.P.x} cy={Lt.P.y} r={7} fill="#e2e8f0" stroke="#334155" strokeWidth="2.5" />
              <circle cx={A.x} cy={A.y} r={4.5} fill="#e2e8f0" stroke="#334155" strokeWidth="2" />
              <g transform={`translate(${pad.x.toFixed(1)} ${pad.y.toFixed(1)}) rotate(${(-deg).toFixed(2)}) scale(${narrow ? 0.78 : 1})`}>
                <rect x={-5} y={-20} width={10} height={40} rx={3} fill="#111827" />
                {[-12, -4, 4, 12].map((y) => (
                  <line key={y} x1={-5} x2={5} y1={y} y2={y} stroke="#475569" strokeWidth="1.2" />
                ))}
                <path d="M-6,-16 C-6,-24 -22,-26 -36,-21 L-64,-14 Q-73,-12 -73,-2 L-73,10 Q-73,17 -64,17 L-6,17 Z" fill="#1f2937" stroke="#0b1220" strokeWidth="1.2" />
                <line x1={-72} x2={-6} y1={14} y2={14} stroke="#64748b" strokeWidth="2" />
                <line x1={-58} y1={-14} x2={-96} y2={-70} stroke="#334155" strokeWidth="20" strokeLinecap="round" />
              </g>
              {/* lever arms: a = LP / i to the rod, LP to the pad */}
              <SvgSym x={Lt.P.x - 12} y={(Lt.P.y + A.y) / 2 + 4} text="a" color="#0891b2" fs={fs} anchor="end" />
              <SvgSym x={Lt.P.x - 14} y={Lt.P.y + Lt.LP * 0.66} text={L.leverTag(fmt(i, 1, dec))} color="#475569" fs={fs - 1} anchor="end" italic={false} weight={600} />
            </g>

            {/* the master cylinder with its reservoir */}
            <MasterCylinder Lt={Lt} hm={hm} pist={pist} col={col} fs={fs} label={L.masterTag(dm)} />
            <line x1={Lt.gauge.x} x2={Lt.gauge.x} y1={Lt.gauge.y + Lt.gauge.r} y2={Lt.yM - hm / 2 - 4} stroke="#64748b" strokeWidth="6" />
            <line x1={Lt.gauge.x} x2={Lt.gauge.x} y1={Lt.gauge.y + Lt.gauge.r} y2={Lt.yM - hm / 2} stroke={col} strokeWidth="2.6" />
            <Gauge
              x={Lt.gauge.x}
              y={Lt.gauge.y}
              r={Lt.gauge.r}
              value={pNow}
              max={pRangeMPa(ph.p)}
              unit={T.MPa}
              label="p"
              decimal={dec}
              fs={fs - 1}
              readout={`${fmt(pNow, 2, dec)} ${T.MPa}`}
            />

            {/* forces at the pedal */}
            {share > 0.02 && (
              <>
                <ForceArrow
                  x={Q.x - pushDir.x * (lenFoot + 6)}
                  y={Q.y - pushDir.y * (lenFoot + 6)}
                  dx={pushDir.x * lenFoot}
                  dy={pushDir.y * lenFoot}
                  color={FC.f1}
                  label="F"
                  value={`${B0(F * share, dec)} ${T.N}`}
                  fs={fs}
                  width={3}
                  head={10}
                  labelAt={{ x: Q.x - pushDir.x * (lenFoot + 10), y: Q.y + 22, anchor: 'start' }}
                />
                <ForceArrow
                  x={A.x + ru.y * 12}
                  y={A.y - ru.x * 12}
                  dx={ru.x * lenRod}
                  dy={ru.y * lenRod}
                  color="#0891b2"
                  label={L.sym.rod}
                  value={`${B0(i * F * share, dec)} ${T.N}`}
                  fs={fs}
                  width={3}
                  head={10}
                  labelAt={{ x: A.x + ru.y * 12 + ru.x * lenRod * 0.2, y: A.y - ru.x * 12 - 10, anchor: 'start' }}
                />
              </>
            )}
          </g>
        );
      }}
    </LabScene>
  );
}

const B0 = (v, dec) => big(v, 0, dec);
const pRangeMPa = (p) => [1, 2, 5, 10, 20].find((r) => r >= p * 1.25) ?? 20;

/** The pipes, drawn as a dark casing with the fluid inside. */
function BrakeLines({ Lt, col, units }) {
  const ds = [Lt.trunk, `M${Lt.bus.x},${Lt.bus.y0} L${Lt.bus.x},${Lt.bus.y1}`, ...units.map((u) => `M${Lt.bus.x},${u.y} L${u.x - u.side * 31},${u.y}`)];
  return (
    <g pointerEvents="none">
      {ds.map((d, j) => (
        <path key={`o${j}`} d={d} fill="none" stroke="#475569" strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {ds.map((d, j) => (
        <path key={`i${j}`} d={d} fill="none" stroke={col} strokeWidth="3.6" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      <circle cx={Lt.junction.x} cy={Lt.junction.y} r={6} fill="#475569" />
      <circle cx={Lt.junction.x} cy={Lt.junction.y} r={3} fill={col} />
    </g>
  );
}

function MasterCylinder({ Lt, hm, pist, col, fs, label }) {
  const { mX0, mX1, yM, res } = Lt;
  const t = 5;
  return (
    <g pointerEvents="none">
      {/* reservoir on top */}
      <rect x={res.x0} y={yM - hm / 2 - t - 30} width={res.x1 - res.x0} height={26} rx={4} fill="#f8fafc" stroke="#64748b" strokeWidth="1.4" />
      <rect x={res.x0 + 2} y={yM - hm / 2 - t - 19} width={res.x1 - res.x0 - 4} height={13} rx={2} fill="#fde68a" />
      <line x1={res.x0 + 2} x2={res.x1 - 2} y1={yM - hm / 2 - t - 19} y2={yM - hm / 2 - t - 19} stroke="#b45309" strokeWidth="1.4" />
      <rect x={(res.x0 + res.x1) / 2 - 3} y={yM - hm / 2 - t - 4} width={6} height={t + 1} fill="#fde68a" stroke="#64748b" strokeWidth="1" />
      {/* body */}
      <rect x={mX0} y={yM - hm / 2 - t} width={mX1 - mX0} height={hm + 2 * t} rx={5} fill="#cbd5e1" stroke="#334155" strokeWidth="1.6" />
      <rect x={mX0 + 4} y={yM - hm / 2} width={mX1 - mX0 - 8} height={hm} fill="#f8fafc" />
      <rect x={pist + 14} y={yM - hm / 2} width={Math.max(0, mX1 - 4 - pist - 14)} height={hm} fill={col} />
      <rect x={pist} y={yM - hm / 2 + 0.5} width={14} height={hm - 1} fill="#94a3b8" stroke="#334155" strokeWidth="1.2" />
      <line x1={pist + 4} x2={pist + 4} y1={yM - hm / 2 + 1} y2={yM + hm / 2 - 1} stroke="#1e293b" strokeWidth="1.5" />
      <text x={(mX0 + mX1) / 2} y={yM + hm / 2 + t + fs + 4} textAnchor="middle" fontSize={fs - 1} fontWeight="700" fill="#475569">
        {label}
      </text>
    </g>
  );
}

/**
 * One wheel from above, the caliper cut open: the disc (edge on, spinning),
 * the tyre outboard, two opposed pistons pushing the pads onto the disc.
 */
function WheelUnit({ u, gap, spin, col, fs, caption, fLabel, fValue, pTag, bus }) {
  const g = 3 * gap; // pad gap in design units (schematic)
  const off = spin % 12;
  const stripes = [];
  for (let y = -46 + off - 12; y < 46; y += 12) if (y > -46 && y < 44) stripes.push(y);
  const tread = [];
  for (let y = -52 + ((spin * 0.8) % 10) - 10; y < 52; y += 10) if (y > -50 && y < 50) tread.push(y);
  const sd = u.side;
  const side = (t) => (
    <g key={t}>
      <rect x={t > 0 ? 9 : -28} y={-14} width={19} height={28} fill={col} />
      <rect x={t > 0 ? 7 + g : -(17 + g)} y={-13} width={10} height={26} fill="#e2e8f0" stroke="#475569" strokeWidth="1.2" />
      <rect x={t > 0 ? 4 + g : -(7 + g)} y={-16} width={3} height={32} fill="#334155" />
      <rect x={t > 0 ? 4 + g : -(6 + g)} y={-16} width={2} height={32} fill="#7c2d12" />
    </g>
  );
  return (
    <g transform={`translate(${u.x} ${u.y})`} pointerEvents="none">
      {/* tyre and hub, outboard */}
      <g transform={`scale(${sd} 1)`}>
        <rect x={6} y={-6} width={36} height={12} fill="#94a3b8" />
        <rect x={40} y={-52} width={17} height={104} rx={7} fill="#1f2937" />
        {tread.map((y) => (
          <line key={y} x1={42} x2={55} y1={y} y2={y} stroke="#4b5563" strokeWidth="2" />
        ))}
      </g>
      {/* disc */}
      <rect x={-4} y={-46} width={8} height={92} rx={2} fill="#cbd5e1" stroke="#64748b" strokeWidth="1.2" />
      {stripes.map((y) => (
        <line key={y} x1={-3} x2={3} y1={y} y2={y} stroke="#94a3b8" strokeWidth="1.6" />
      ))}
      {/* caliper: bridge, two blocks with bores, pistons and pads */}
      <rect x={-31} y={-35} width={62} height={10} rx={3} fill="#475569" stroke="#1e293b" strokeWidth="1.2" />
      <line x1={-20} x2={20} y1={-30} y2={-30} stroke={col} strokeWidth="2.6" />
      <rect x={-31} y={-27} width={23} height={54} rx={3} fill="#475569" stroke="#1e293b" strokeWidth="1.2" />
      <rect x={8} y={-27} width={23} height={54} rx={3} fill="#475569" stroke="#1e293b" strokeWidth="1.2" />
      {side(-1)}
      {side(1)}
      {/* clamping force: both pads pushed onto the disc */}
      {u.len > 1 && (
        <>
          <ForceArrow x={-(9 + u.len)} y={40} dx={u.len} dy={0} color={FC.f2} width={2.6} head={8} />
          <ForceArrow x={9 + u.len} y={40} dx={-u.len} dy={0} color={FC.f2} width={2.6} head={8} />
        </>
      )}
      <SvgSym x={0} y={-44 - fs * 0.9} text={caption} color="#334155" fs={fs - 1} italic={false} weight={700} />
      <SvgSym x={0} y={58 + fs * 0.4} text={fLabel} value={u.Fw > 0.5 ? fValue : null} color={FC.f2} fs={fs} />
      {u.Fw > 0.5 && (
        <text x={(bus - u.x - sd * 31) / 2} y={-6} textAnchor="middle" fontSize={fs - 3} fontWeight="700" fill="#9a3412" stroke="#fbfcfe" strokeWidth="3" paintOrder="stroke">
          {pTag}
        </text>
      )}
    </g>
  );
}

/* ========================================================= steps panel */

function BrakeSteps({ T, F, i, dm, df, dr, ph }) {
  const L = T.brakes;
  const M = L.method;
  const S = L.sym;
  const dec = T.decimal;
  const B = (v) => big(v, 0, dec);
  const iS = fmt(i, Number.isInteger(i) ? 0 : 1, dec);
  return (
    <StepsPanel formula="p = F / S" title={M.title}>
      <Step n={1} title={M.s1}>
        <Eq sym={`${S.rod} = i · F`} nums={`= ${iS} · ${F} ${T.N} =`} result={`${B(ph.Frod)} ${T.N}`} resultColor="#67e8f9" />
      </Step>
      <Step n={2} title={M.s2}>
        <Eq sym="S₁ = π·d₁² / 4" nums={`= ${fmt(3.14, 2, dec)} · (${dm} ${T.mm})² / 4 = ${B(ph.Sm)} ${T.mm2} = ${fmt(ph.Sm / 100, 2, dec)} ${T.cm2}`} />
        <Eq sym={`p = ${S.rod} / S₁`} nums={`= ${B(ph.Frod)} ${T.N} / ${m2(ph.Sm / 100, dec)} ${T.m2} ≈`} result={`${fmt(ph.p, 2, dec)} ${T.MPa}`} resultColor="#fdba74" />
      </Step>
      <Step n={3} title={M.s3}>
        <p className="mt-0.5">{M.pascal}</p>
        <Eq sym={`${S.Ff} = p · ${S.Sf} = ${S.rod} · (${S.df} / d₁)²`} nums={`= ${B(ph.Frod)} · (${df} / ${dm})² =`} result={`${B(ph.Ff)} ${T.N}`} resultColor={FC.f2Text} />
        <Eq sym={`${S.Fr} = ${S.rod} · (${S.dr} / d₁)²`} nums={`= ${B(ph.Frod)} · (${dr} / ${dm})² =`} result={`${B(ph.Fr)} ${T.N}`} resultColor="#67e8f9" />
      </Step>
      <Step n={4} title={M.s4}>
        <p className="mt-0.5">{M.travel(fmt(PAD_TRAVEL, 0, dec), fmt(ph.xm, 1, dec), fmt(ph.pedal / 10, 1, dec))}</p>
        <Eq
          sym={M.workSym}
          nums={`= ${F} ${T.N} · ${fmt(ph.pedal / 1000, 3, dec)} ${T.m} = ${B(ph.total)} ${T.N} · ${fmt(PAD_TRAVEL / 1000, 3, dec)} ${T.m} =`}
          result={`${big(ph.work, 1, dec)} ${T.J}`}
          resultColor={FC.workText}
        />
      </Step>
    </StepsPanel>
  );
}

/* ================================================================ graph */

function DiameterGraph({ T, ph, df, dr, onPick }) {
  const L = T.brakes;
  const dec = T.decimal;
  const Fof = (d) => (ph.p * Math.PI * d * d) / 4 / 1000; // kN
  const yTop = Fof(60) * 1.05;
  const p10 = 10 ** Math.floor(Math.log10(yTop));
  const yMax = [1, 2, 2.5, 5, 10].map((m) => m * p10).find((v) => v >= yTop) ?? 10 * p10;
  const curve = [];
  for (let d = 0; d <= 60; d += 2) curve.push({ x: d, y: Fof(d) });
  return (
    <TimeGraph
      title={L.graph.title}
      series={[
        { id: 'curve', label: L.graph.curve(fmt(ph.p, 2, dec)), color: '#fb923c', points: curve, dot: false },
        { id: 'front', label: L.graph.front, color: '#60a5fa', points: [{ x: df, y: Fof(df) }] },
        { id: 'rear', label: L.graph.rear, color: '#22d3ee', points: [{ x: dr, y: Fof(dr) }] },
      ]}
      xMax={60}
      yMax={yMax}
      xLabel={L.graph.x}
      yLabel={L.graph.y}
      marker={df}
      decimal={dec}
      yDigits={Number.isInteger(yMax / 4) ? 0 : Number.isInteger((yMax / 4) * 10) ? 1 : 2}
      height={250}
      onScrub={onPick}
      note={L.graph.note}
    />
  );
}
