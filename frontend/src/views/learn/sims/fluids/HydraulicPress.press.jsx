import { useState } from 'react';
import { ArrowDownToLine, Car, Hand as HandIcon, Lightbulb, Package, RotateCcw, Truck } from 'lucide-react';

import { Btn, Explain, RangeField, Readout, Segmented, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { Grid, TimeGraph, makeView } from '../kit/scene';
import {
  CompareBars,
  DimLine,
  Eq,
  FC,
  ForceArrow,
  G,
  Gauge,
  Ground,
  GroupLabel,
  Hand,
  LOAD_SIZE,
  LabScene,
  Load,
  OIL,
  Panel,
  PressureArrows,
  STEEL,
  ScaleBar,
  ScaleChip,
  SceneRow,
  Step,
  StepsPanel,
  Sym,
  Tag,
  big,
  loadCom,
  m2,
  pickRange,
} from './HydraulicPress.parts';

/**
 * Tab 1 — the hydraulic press. A hand pushes the small piston (area S₁) with
 * F₁; the oil passes the pressure p = F₁/S₁ unchanged to the large piston
 * (area S₂) — Pascal's law — so the oil pushes it up with F₂ = p·S₂:
 *   F₂ / F₁ = S₂ / S₁ (gain in force).
 * The large piston rests on stops; while F₂ < mg the load stays, once F₂ > mg
 * it rises. The small piston is light, so the oil pressure is always
 * p = F_hand / S₁. Moving, the pistons keep the oil volume: h₁S₁ = h₂S₂.
 * At the end of the 20 cm stroke the hand holds the load still with
 * F₁ = mg·S₁/S₂ (then F₂ = mg). Released, the load pushes the oil back.
 * The press is drawn to scale (cylinder bores, piston travel); the loads are
 * drawn smaller than life, as the chip says.
 * Preset: S₁ = 2 cm², S₂ = 200 cm², F₁ = 100 N → p = 500 kPa, F₂ = 10 000 N
 * (gain ×100) > mg = 1000·9.8 = 9800 N: the car rises; F₁ min = 98 N;
 * after 20 cm of the small piston the car is 0.2 cm higher.
 */

const STROKE = 20; // cm, travel of the small piston
const V1 = 10; // cm/s, speed of the small piston (real time)
const TAU_F = 0.12; // s, how fast the hand's force builds up or eases off
export const LOADS = { crate: 250, car: 1000, truck: 4000 }; // kg
const LOAD_ICONS = { crate: Package, car: Car, truck: Truck };
const PRESETS = {
  lesson: { S1: 2, S2: 200, F1: 100, load: 'car' },
  weak: { S1: 2, S2: 200, F1: 60, load: 'car' },
  crate: { S1: 10, S2: 100, F1: 300, load: 'crate' },
  big: { S1: 1, S2: 1000, F1: 50, load: 'truck' },
};
const IDLE = { pressing: false, h1: 0, Fa: 0, dir: 0 };

/* drawing, in cm (y up, floor at 0) */
const XS = 14; // small cylinder axis
const XL = 70; // large cylinder axis
const YC0 = 2; // channel: inner bottom
const YC1 = 7; // channel: inner top
const WT = 1.2; // wall thickness
const YS_TOP = 47; // top of the small cylinder
const YP0 = 42; // small piston bottom at rest
const PT = 2.5; // small piston thickness
const ROD = 6; // rod above the small piston
const CAP = 0.9; // the plate the hand presses
const YL_TOP = 33; // top of the large cylinder
const Y_STOP = 16; // top of the stops the large piston rests on
const STOP_H = 1.5;
const STOP_W = 0.8;
const CLR = 0.15; // clearance between the large piston and the bore
const RAM_H = 22;
const PLAT_H = 2;
const BOX = { x0: -3, x1: 104, y0: -1.5, y1: 74 };
const PAD_W = { l: 12, r: 12, t: 14, b: 12 };
const PAD_N = { l: 8, r: 8, t: 40, b: 10 };

/** One step of the hand–oil–load system. */
function stepPress(p, dt, F1, gain, mg) {
  const Fmin = mg / gain;
  const atTop = p.h1 >= STROKE - 1e-9;
  let target = 0;
  if (p.pressing) target = atTop && F1 >= Fmin ? Fmin : F1;
  let Fa = target + (p.Fa - target) * Math.exp(-dt / TAU_F);
  if (Math.abs(Fa - target) < 0.02) Fa = target;
  const F2 = Fa * gain;
  let dir = 0;
  if (F2 > mg * (1 + 1e-6) && p.h1 < STROKE) dir = 1;
  else if (F2 < mg * (1 - 1e-6) && p.h1 > 0) dir = -1;
  const h1 = clamp(p.h1 + dir * V1 * dt, 0, STROKE);
  if (Fa === p.Fa && h1 === p.h1 && dir === p.dir) return p;
  return { ...p, Fa, h1, dir };
}

/** A number with no decimals when it is (nearly) whole, else one decimal. */
function smart(v, decimal) {
  return Math.abs(v - Math.round(v)) < 0.05 ? big(Math.round(v), 0, decimal) : big(v, 1, decimal);
}

/** The grid step (cm) the scene draws at this size — the same rule as kit Grid with minPx 26. */
function cellOf(W, H, narrow) {
  const pad = narrow ? PAD_N : PAD_W;
  const k = makeView(BOX, W, H, pad).k;
  const raw = 26 / k;
  const p = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p;
  return 10 * p;
}

function niceCeil(v) {
  const p = 10 ** Math.floor(Math.log10(Math.max(v, 1e-9)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v - 1e-9) return m * p;
  return 10 * p;
}

/* ==================================================================== sim */

export default function PressSim({ T }) {
  const L = T.press;
  const dec = T.decimal;
  const [preset, setPreset] = useState('lesson');
  const [S1, setS1] = useState(PRESETS.lesson.S1);
  const [S2, setS2] = useState(PRESETS.lesson.S2);
  const [F1, setF1] = useState(PRESETS.lesson.F1);
  const [load, setLoad] = useState(PRESETS.lesson.load);
  const [sim, setSim] = useState(IDLE);
  const [touched, setTouched] = useState(false);

  const m = LOADS[load];
  const mg = m * G;
  const gain = S2 / S1;
  const Fmin = mg / gain;
  const F2set = F1 * gain;
  const lifts = F2set > mg * (1 + 1e-6);
  const balanced = !lifts && F2set >= mg * (1 - 1e-6);

  useRafLoop(sim.pressing || sim.Fa > 1e-3 || sim.h1 > 1e-9, (dt) => {
    setSim((p) => stepPress(p, dt, F1, gain, mg));
  });

  const pick = (id) => {
    const ps = PRESETS[id];
    setPreset(id);
    setS1(ps.S1);
    setS2(ps.S2);
    setF1(ps.F1);
    setLoad(ps.load);
    setSim(IDLE);
    setTouched(true);
  };
  const change = (fn, resetSim = true) => (v) => {
    fn(v);
    setPreset(null);
    setTouched(true);
    if (resetSim) setSim(IDLE);
  };
  const toggle = () => {
    setTouched(true);
    setSim((p) => ({ ...p, pressing: !p.pressing }));
  };
  const reset = () => setSim(IDLE);

  /* ---- live values */
  const pNow = (sim.Fa / S1) * 10; // kPa (1 N/cm² = 10 kPa)
  const F2now = sim.Fa * gain;
  const atTop = sim.h1 >= STROKE - 1e-9;
  const holding = sim.pressing && atTop && F1 >= Fmin;
  const Fcalc = holding ? Fmin : F1; // the force in the calculation panel

  const S = (v) => smart(v, dec);
  const B = (v) => big(v, 0, dec);

  /* ---- explanation */
  let key;
  if (sim.pressing) {
    if (holding) key = 'hold';
    else if (sim.dir < 0) key = 'descend';
    else if (lifts) key = 'lifting';
    else if (balanced) key = 'balance';
    else key = 'weak';
  } else if (sim.h1 > 1e-6) key = 'release';
  else if (!touched) key = 'intro';
  else key = lifts ? 'readyLift' : balanced ? 'balance' : 'readyWeak';
  const settled = useSettled(key, 200);
  const ex = L.explain;
  const text = {
    intro: ex.intro,
    readyLift: ex.readyLift(B(F2set), B(mg), S(gain)),
    readyWeak: ex.readyWeak(B(F2set), B(mg), S(Fmin)),
    lifting: ex.lifting(B((F1 / S1) * 10), B(F2set), B(mg)),
    weak: ex.weak(B((F1 / S1) * 10), B(F2set), B(mg), S(Fmin)),
    balance: ex.balance(B(F2set)),
    hold: ex.hold(fmt(STROKE, 0, dec), fmt(STROKE / gain, 2, dec), S(Fmin)),
    descend: ex.descend,
    release: ex.release,
  }[settled];
  const tone = {
    intro: '#22d3ee',
    readyLift: '#60a5fa',
    readyWeak: '#fbbf24',
    lifting: '#60a5fa',
    weak: '#f87171',
    balance: '#a78bfa',
    hold: '#34d399',
    descend: '#fbbf24',
    release: '#fbbf24',
  }[settled];

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
          <Btn variant="primary" icon={sim.pressing ? HandIcon : ArrowDownToLine} onClick={toggle} className="xl:min-w-[168px] min-h-[52px] text-[15px]">
            {sim.pressing ? L.release : L.press}
          </Btn>
          <Btn icon={RotateCcw} onClick={reset} disabled={!sim.pressing && sim.h1 === 0 && sim.Fa === 0} className="min-h-[52px] text-[15px]">
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
        renderScene={(fitH) => <PressScene T={T} S1={S1} S2={S2} F1={F1} load={load} sim={sim} mg={mg} gain={gain} fitH={fitH} />}
        side={<PressSteps T={T} S1={S1} S2={S2} F={Fcalc} m={m} mg={mg} holding={holding} />}
      />

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.p} symbol="p" value={B(pNow)} unit={T.kPa} accent={FC.p} textColor={FC.pText} active={sim.pressing} sub={<Sym>{L.pSub}</Sym>} />
        <Readout
          label={L.readouts.F2}
          symbol="F₂"
          value={B(F2now)}
          unit={T.N}
          accent={FC.f2}
          textColor={FC.f2Text}
          active={sim.pressing}
          sub={L.F2Sub(fmt(F2now / 1000, 2, dec))}
        />
        <Readout label={L.readouts.gain} symbol="S₂/S₁" value={`×${S(gain)}`} accent={FC.gain} textColor={FC.gainText} sub={L.gainSub(B(S2), B(S1))} />
        <Readout label={L.readouts.load} symbol="mg" accent={FC.mg}>
          <CompareBars
            rows={[
              { label: 'F₂', value: F2set, color: '#60a5fa', text: `${B(F2set)} ${T.N}` },
              { label: 'mg', value: mg, color: '#f87171', text: `${B(mg)} ${T.N}` },
            ]}
          />
          <p className={`mt-2 text-xs font-semibold ${lifts ? 'text-emerald-300' : balanced ? 'text-violet-300' : 'text-amber-300'}`}>
            {lifts ? L.liftYes : balanced ? L.liftEq : L.liftNo(S(Fmin))}
          </p>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField
            id="hp-pr-s1"
            label={L.S1}
            symbol="S₁"
            min={1}
            max={20}
            step={1}
            value={S1}
            onChange={change(setS1)}
            accent={FC.f1}
            display={`${S1} ${T.cm2}`}
            hint={L.S1Hint(fmt(2 * Math.sqrt(S1 / Math.PI), 1, dec))}
          />
          <RangeField
            id="hp-pr-s2"
            label={L.S2}
            symbol="S₂"
            min={50}
            max={1000}
            step={10}
            value={S2}
            onChange={change(setS2)}
            accent={FC.f2}
            display={`${B(S2)} ${T.cm2}`}
            hint={L.S2Hint(fmt(2 * Math.sqrt(S2 / Math.PI), 1, dec))}
          />
          <RangeField
            id="hp-pr-f1"
            label={L.F1}
            symbol="F₁"
            min={0}
            max={300}
            step={10}
            value={F1}
            onChange={change(setF1, false)}
            accent={FC.f1}
            display={`${F1} ${T.N}`}
            hint={L.F1Hint(fmt(F1 / G, 1, dec))}
          />
          <div>
            <p className="mb-1.5 text-sm text-gray-300">{L.loadLabel}</p>
            <Segmented
              label={L.loadLabel}
              className="grid-cols-3"
              value={load}
              onChange={change(setLoad)}
              accent="#f87171"
              options={Object.keys(LOADS).map((id) => ({ value: id, label: T.loads[id], sub: `${B(LOADS[id])} ${T.kg}`, icon: LOAD_ICONS[id] }))}
            />
          </div>
        </Panel>
        <Panel className="lg:col-span-3">
          <ForceGraph T={T} F1={F1} gain={gain} mg={mg} onPick={change((v) => setF1(clamp(Math.round(v / 10) * 10, 0, 300)), false)} />
        </Panel>
      </div>
    </div>
  );
}

/* ================================================================= scene */

function PressScene({ T, S1, S2, F1, load, sim, mg, gain, fitH }) {
  const L = T.press;
  const dec = T.decimal;
  const pNow = (sim.Fa / S1) * 10;
  const F2now = sim.Fa * gain;
  const F2set = F1 * gain;
  const pRange = pickRange(Math.max((F1 / S1) * 10, (mg / S2) * 10));
  const rise = sim.h1 / gain;
  const riseEnd = STROKE / gain;
  const contact = sim.pressing || sim.Fa > 0.5;

  return (
    <LabScene
      defs={
        <linearGradient id="hp-ram" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#8b9bb0" />
          <stop offset="0.45" stopColor="#e5ebf2" />
          <stop offset="1" stopColor="#8b9bb0" />
        </linearGradient>
      }
      legend={[
        { color: FC.f1, label: L.legend.f1, kind: 'arrow' },
        { color: FC.f2, label: L.legend.f2, kind: 'arrow' },
        { color: FC.mg, label: L.legend.mg, kind: 'arrow' },
        { color: FC.p, label: L.legend.p, kind: 'arrows' },
        { color: OIL.fill, label: L.legend.oil, kind: 'box' },
        { label: L.drawnSmall, kind: 'note' },
      ]}
      legendBelow
      chips={(W, narrow, H) => {
        const Lref = narrow ? 52 : clamp(H * 0.17, 64, 92);
        const kF = Lref / Math.max(F2set, mg, 1);
        return (
          <>
            <ScaleChip>
              {L.cellChip(cellOf(W, H, narrow))}
              <span className="text-slate-300">·</span>
              <ScaleBar k={kF * 1000} text={(s) => `${fmt(s, Number.isInteger(s) ? 0 : 1, dec)} ${T.kN}`} />
            </ScaleChip>
          </>
        );
      }}
      height={(W, narrow) => fitH ?? (narrow ? Math.round(((W - 16) / (BOX.x1 - BOX.x0)) * (BOX.y1 - BOX.y0) + 52) : 540)}
      ariaLabel={L.sceneLabel(S1, big(S2, 0, dec), F1, big(pNow, 0, dec), big(F2now, 0, dec), fmt(sim.h1, 1, dec), fmt(rise, 2, dec))}
    >
      {(W, H, narrow) => {
        const pad = narrow ? PAD_N : PAD_W;
        const view = makeView(BOX, W, H, pad);
        const k = view.k;
        const { sx, sy } = view;
        const fs = narrow ? 10.5 : 12;
        const box = { w: W, h: H };
        const r1 = Math.sqrt(S1 / Math.PI);
        const r2 = Math.sqrt(S2 / Math.PI);
        const r1v = Math.max(r1, 3.2 / k);
        const wt = Math.max(WT, 3 / k);
        const yp = YP0 - sim.h1;
        const yr = Y_STOP + rise;
        const R = (x0, y0, x1, y1, props) => <rect x={sx(x0)} y={sy(y1)} width={Math.max(0, (x1 - x0) * k)} height={Math.max(0, (y1 - y0) * k)} {...props} />;
        const P = (x, y) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`;

        /* forces to one scale; F₁ is enlarged by a power of ten when tiny */
        const Lref = narrow ? 52 : clamp(H * 0.17, 64, 92);
        const kF = Lref / Math.max(F2set, mg, 1);
        let M = 1;
        while (F1 > 0 && F1 * kF * M < 24 && M < 1000) M *= 10;
        const lenF1 = sim.Fa * kF * M;
        const lenF2 = F2now * kF;
        const lenMg = mg * kF;

        /* pressure arrows: same length everywhere = same pressure */
        const lp = (narrow ? 0.72 : 1) * Math.min(30, (34 * pNow) / pRange);

        const capTop = yp + PT + ROD + CAP;
        const handY = sy(capTop) - (contact ? 0 : 7);
        const hs = narrow ? 0.72 : 1;
        const handTop = handY - 34 * hs;

        const loadW = LOAD_SIZE[load].w;
        const plw = Math.max(loadW + 6, 2 * r2 + 4);
        const ybLoad = yr + RAM_H + PLAT_H;
        const comY = sy(ybLoad + loadCom(load));
        const off = Math.min(13, r2 * k * 0.36);

        /* gauges */
        const rG = narrow ? clamp(3.4 * k, 14, 18) : clamp(4.2 * k, 21, 27);
        const gA = { x: sx(XS - r1v - wt) - 8 - rG, y: sy(17) };
        const gB = { x: Math.min(W - rG - 6, sx(XL + r2 + wt) + 10 + rG), y: sy(10.5) };

        /* magnifier on the right stop of the large piston */
        const rL = narrow ? 24 : 38;
        let Z = 0;
        for (const z of [50, 20, 10, 5, 2]) {
          if (riseEnd * k * z <= 0.55 * rL) {
            Z = z;
            break;
          }
        }
        const lensRight = sx(XL + r2 + wt) + rL + 12;
        const lens = Z && !narrow
          ? { x: lensRight + rL + 4 <= W ? lensRight : sx(XL - r2 - wt) - rL - 12, y: sy(27.5) }
          : null;

        const corridor = (sx(XS + r1v + wt) + sx(XL - r2 - wt)) / 2;
        const pill = { w: narrow ? 72 : 100, h: narrow ? 34 : 44, y: sy(narrow ? 31 : 26) };
        pill.x = sx(XS + r1v + wt) + (narrow ? 8 : 14) + pill.w / 2;

        return (
          <>
            <Grid view={view} W={W} H={H} minPx={26} />
            <Ground W={W} y={sy(0)} depth={H - sy(0)} />

            {/* feet and the metal body */}
            <g fill={STEEL.mid}>
              {R(XS - r1v - wt - 1.5, 0, XS + r1v + wt + 1.5, YC0 - wt)}
              {R(XL - r2 - wt - 1.5, 0, XL + r2 + wt + 1.5, YC0 - wt)}
            </g>
            <g fill={STEEL.body}>
              {R(XS - r1v - wt, YC0 - wt, XL + r2 + wt, YC1 + wt)}
              {R(XS - r1v - wt, YC0 - wt, XS + r1v + wt, YS_TOP)}
              {R(XL - r2 - wt, YC0 - wt, XL + r2 + wt, YL_TOP)}
            </g>

            {/* air above the small piston, then the oil */}
            {R(XS - r1v, yp + PT, XS + r1v, YS_TOP, { fill: '#f8fafc' })}
            <g fill={OIL.fill}>
              {R(XS - r1v, YC0, XL + r2, YC1)}
              {R(XS - r1v, YC0, XS + r1v, yp)}
              {R(XL - r2, YC0, XL + r2, YL_TOP)}
            </g>
            <text x={corridor} y={sy((YC0 + YC1) / 2) + fs * 0.36} textAnchor="middle" fontSize={fs - 1} fontStyle="italic" fontWeight="600" fill={OIL.dark}>
              {L.oilWord}
            </text>

            {/* outlines (the cylinder mouths stay open) */}
            <path
              d={`M${P(XS - r1v, YS_TOP)} L${P(XS - r1v - wt, YS_TOP)} L${P(XS - r1v - wt, YC0 - wt)} L${P(XL + r2 + wt, YC0 - wt)} L${P(XL + r2 + wt, YL_TOP)} L${P(XL + r2, YL_TOP)} M${P(XL - r2, YL_TOP)} L${P(XL - r2 - wt, YL_TOP)} L${P(XL - r2 - wt, YC1 + wt)} L${P(XS + r1v + wt, YC1 + wt)} L${P(XS + r1v + wt, YS_TOP)} L${P(XS + r1v, YS_TOP)}`}
              fill="none"
              stroke={STEEL.edge}
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path
              d={`M${P(XS - r1v, YS_TOP)} L${P(XS - r1v, YC0)} L${P(XL + r2, YC0)} L${P(XL + r2, YL_TOP)} M${P(XL - r2, YL_TOP)} L${P(XL - r2, YC1)} L${P(XS + r1v, YC1)} L${P(XS + r1v, YS_TOP)}`}
              fill="none"
              stroke={STEEL.dark}
              strokeWidth="1"
            />

            {/* the stops the large piston rests on */}
            <g fill={STEEL.dark}>
              {R(XL - r2, Y_STOP - STOP_H, XL - r2 + STOP_W, Y_STOP)}
              {R(XL + r2 - STOP_W, Y_STOP - STOP_H, XL + r2, Y_STOP)}
            </g>

            {/* pressure: equal arrows on every surface the oil touches */}
            <PressureArrows a={sx(XS - r1v) + 1} b={sx(XS + r1v) - 1} at={sy(yp)} dir="up" len={lp} spacing={16} />
            <PressureArrows a={sx(XL - r2 + STOP_W) + 3} b={sx(XL + r2 - STOP_W) - 3} at={sy(yr)} dir="up" len={lp} spacing={16} />
            <PressureArrows a={sy(Y_STOP - STOP_H - 0.6)} b={sy(YC1 + 0.4)} at={sx(XL - r2)} dir="left" len={lp * 0.8} spacing={22} opacity={0.6} />
            <PressureArrows a={sy(Y_STOP - STOP_H - 0.6)} b={sy(YC0 + 0.4)} at={sx(XL + r2)} dir="right" len={lp * 0.8} spacing={22} opacity={0.6} />
            <PressureArrows a={sx(XS + r1v) + 10} b={sx(XL - r2) - 10} at={sy(YC0)} dir="down" len={Math.min(lp, (YC1 - YC0) * k - 6) * 0.8} spacing={60} opacity={0.6} />

            {/* the small piston, its rod and the plate */}
            {R(XS - r1v + 0.04, yp, XS + r1v - 0.04, yp + PT, { fill: STEEL.mid, stroke: STEEL.edge, strokeWidth: 1.2 })}
            {R(XS - Math.max(r1v * 0.45, 1.6 / k), yp + PT, XS + Math.max(r1v * 0.45, 1.6 / k), yp + PT + ROD, { fill: STEEL.ram, stroke: STEEL.edge, strokeWidth: 1 })}
            {R(XS - Math.max(r1v + 0.7, 7 / k), yp + PT + ROD, XS + Math.max(r1v + 0.7, 7 / k), capTop, { fill: STEEL.dark, stroke: STEEL.edge, strokeWidth: 1, rx: 2 })}

            {/* the large piston, its platform and the load */}
            {R(XL - r2 + CLR, yr, XL + r2 - CLR, yr + RAM_H, { fill: 'url(#hp-ram)', stroke: STEEL.edge, strokeWidth: 1.4 })}
            {R(XL - plw / 2, yr + RAM_H, XL + plw / 2, ybLoad, { fill: '#475569', stroke: '#1e293b', strokeWidth: 1, rx: 2 })}
            <Load kind={load} cx={sx(XL)} yb={sy(ybLoad)} k={k} label={L.massTag(big(LOADS[load], 0, dec))} fs={fs - 1} />

            {/* manometers on both cylinders: always the same reading */}
            <line x1={gA.x + rG} x2={sx(XS - r1v - wt) + 1} y1={gA.y} y2={gA.y} stroke={STEEL.dark} strokeWidth="6" />
            <line x1={gA.x + rG} x2={sx(XS - r1v)} y1={gA.y} y2={gA.y} stroke={OIL.fill} strokeWidth="2.4" />
            <line x1={gB.x - rG} x2={sx(XL + r2 + wt) - 1} y1={gB.y} y2={gB.y} stroke={STEEL.dark} strokeWidth="6" />
            <line x1={gB.x - rG} x2={sx(XL + r2)} y1={gB.y} y2={gB.y} stroke={OIL.fill} strokeWidth="2.4" />
            <Gauge x={gA.x} y={gA.y} r={rG} value={pNow} max={pRange} unit={T.kPa} label="p₁" decimal={dec} fs={fs - 1} />
            <Gauge x={gB.x} y={gB.y} r={rG} value={pNow} max={pRange} unit={T.kPa} label="p₂" decimal={dec} fs={fs - 1} />

            {/* travel of the small piston */}
            {sim.h1 > 0.05 && (
              <>
                <line x1={sx(XS - r1v - wt) - 20} x2={sx(XS - r1v)} y1={sy(YP0)} y2={sy(YP0)} stroke={FC.f1} strokeWidth="1" strokeDasharray="3 3" />
                <DimLine p1={{ x: sx(XS - r1v - wt) - 10, y: sy(YP0) }} p2={{ x: sx(XS - r1v - wt) - 10, y: sy(yp) }} color={FC.f1} label={sim.h1 > 1.5 && !narrow ? L.h1Tag(fmt(sim.h1, 1, dec)) : null} fs={fs - 1} box={box} align="left" />
              </>
            )}
            {rise * k > 14 && (
              <DimLine p1={{ x: sx(XL + r2 + wt) + 8, y: sy(Y_STOP) }} p2={{ x: sx(XL + r2 + wt) + 8, y: sy(yr) }} color={FC.f2} label={L.h2Tag(fmt(rise, 2, dec))} fs={fs - 1} box={box} />
            )}

            {/* labels in the corridor between the cylinders */}
            <g pointerEvents="none">
              <rect x={pill.x - pill.w / 2} y={pill.y - pill.h / 2} width={pill.w} height={pill.h} rx={narrow ? 10 : 13} fill="#ecfdf5" stroke={FC.gain} strokeWidth="1.5" />
              <text x={pill.x} y={pill.y - (narrow ? 4 : 6)} textAnchor="middle" fontSize={fs - 2} fontWeight="600" fill="#047857">
                {L.gainTop}
              </text>
              <text x={pill.x} y={pill.y + (narrow ? 11 : 15)} textAnchor="middle" fontSize={narrow ? 14 : 19} fontWeight="800" fill="#065f46">
                ×{smart(gain, dec)}
              </text>
            </g>
            <Tag x={sx(XS + r1v + wt) + 6} y={sy(narrow ? 13 : 12)} text={L.s1Tag(S1)} color={FC.f1} anchor="start" fs={fs - 1} box={box} />
            <Tag x={sx(XL - r2 - wt) - 6} y={sy(narrow ? Y_STOP + 3.5 : YL_TOP - 2.5)} text={L.s2Tag(big(S2, 0, dec))} color={FC.f2} anchor="end" fs={fs - 1} box={box} />
            {!narrow && lenF2 > 4 && <Tag x={sx(XL - r2 - wt) - 6} y={sy(Y_STOP + 3.5)} text={L.f2Tag(big(F2now, 0, dec))} color="#fff" bg={FC.f2} border={FC.f2} anchor="end" fs={fs - 1} box={box} />}

            {/* forces */}
            <ForceArrow
              x={sx(XL) - off}
              y={sy(yr)}
              dx={0}
              dy={-lenF2}
              color={FC.f2}
              label="F₂"
              fs={fs}
              box={box}
              labelAt={{ x: sx(XL) - off - 6, y: sy(yr) - lenF2 + fs * 0.4, anchor: 'end' }}
            />
            <ForceArrow x={sx(XL) + off} y={comY} dx={0} dy={lenMg} color={FC.mg} label="mg" fs={fs} box={box} labelAt={{ x: sx(XL) + off + 7, y: comY + lenMg - 2, anchor: 'start' }} />
            <circle cx={sx(XL) + off} cy={comY} r={3.2} fill="#0f172a" stroke="#fff" strokeWidth="1.4" />

            <Hand x={sx(XS)} y={handY} s={hs} pressing={contact} />
            {lenF1 > 3 && (
              <>
                <ForceArrow
                  x={sx(XS)}
                  y={handTop - 4 - lenF1}
                  dx={0}
                  dy={lenF1}
                  color={FC.f1}
                  label="F₁"
                  value={`${big(sim.Fa, 0, dec)} ${T.N}`}
                  fs={fs}
                  box={box}
                  labelAt={{ x: sx(XS) + 9, y: handTop - 4 - lenF1 * 0.55, anchor: 'start' }}
                />
                {M > 1 && (
                  <text x={sx(XS) + 9} y={handTop - 4 - lenF1 * 0.55 + fs + 2} fontSize={fs - 2} fill="#9d174d" fontWeight="600" stroke="#fff" strokeWidth="3" paintOrder="stroke">
                    {L.magnified(M)}
                  </text>
                )}
              </>
            )}

            {/* magnifier: the large piston lifts off its stop */}
            {lens && <Lens lens={lens} rL={rL} Z={Z} k={k} sx={sx} sy={sy} r2={r2} wt={wt} rise={rise} riseEnd={riseEnd} fs={fs} L={L} dec={dec} box={box} />}
          </>
        );
      }}
    </LabScene>
  );
}

/** A round magnifier (×Z) on the right stop of the large piston. */
function Lens({ lens, rL, Z, k, sx, sy, r2, wt, rise, riseEnd, fs, L, dec, box }) {
  const kz = k * Z;
  const c0x = XL + r2 - CLR;
  const c0y = Y_STOP + riseEnd / 2;
  const LX = (x) => lens.x + (x - c0x) * kz;
  const LY = (y) => lens.y - (y - c0y) * kz;
  const big2 = 1e3;
  const rr = (x0, y0, x1, y1, props) => <rect x={LX(x0)} y={LY(y1)} width={Math.max(0, (x1 - x0) * kz)} height={Math.max(0, (y1 - y0) * kz)} {...props} />;
  const yr = Y_STOP + rise;
  const id = 'hp-lens-clip';
  const px = sx(XL + r2);
  const py = sy(Y_STOP);
  const ang = Math.atan2(py - lens.y, px - lens.x);
  return (
    <g pointerEvents="none">
      <line x1={px} y1={py} x2={lens.x + Math.cos(ang) * rL} y2={lens.y + Math.sin(ang) * rL} stroke="#0f172a" strokeWidth="1" strokeDasharray="3 3" />
      <circle cx={px} cy={py} r={3} fill="none" stroke="#0f172a" strokeWidth="1.2" />
      <clipPath id={id}>
        <circle cx={lens.x} cy={lens.y} r={rL} />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        <rect x={lens.x - rL} y={lens.y - rL} width={2 * rL} height={2 * rL} fill={OIL.fill} />
        {rr(XL + r2, -big2, XL + r2 + wt * 3, big2, { fill: STEEL.body })}
        <line x1={LX(XL + r2)} x2={LX(XL + r2)} y1={lens.y - rL} y2={lens.y + rL} stroke={STEEL.dark} strokeWidth="1.2" />
        {rr(XL + r2 - STOP_W, Y_STOP - STOP_H, XL + r2, Y_STOP, { fill: STEEL.dark })}
        {rr(XL - r2, yr, XL + r2 - CLR, yr + RAM_H, { fill: '#c7d1dd', stroke: STEEL.edge, strokeWidth: 1.4 })}
        {rise * kz > 6 && (
          <>
            <line x1={LX(XL + r2 - 0.55 * STOP_W)} x2={LX(XL + r2 - 0.55 * STOP_W)} y1={LY(Y_STOP) - 1} y2={LY(yr) + 1} stroke={FC.f2} strokeWidth="1.6" />
            <path d={`M${LX(XL + r2 - 0.55 * STOP_W)},${LY(yr) + 1} l-3,5 l6,0 Z`} fill={FC.f2} />
            <path d={`M${LX(XL + r2 - 0.55 * STOP_W)},${LY(Y_STOP) - 1} l-3,-5 l6,0 Z`} fill={FC.f2} />
          </>
        )}
      </g>
      <circle cx={lens.x} cy={lens.y} r={rL} fill="none" stroke="#0f172a" strokeWidth="2.5" />
      <line x1={lens.x + rL * 0.72} y1={lens.y + rL * 0.72} x2={lens.x + rL * 0.72 + 9} y2={lens.y + rL * 0.72 + 9} stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
      <Tag x={lens.x} y={lens.y - rL - 11} text={`×${Z}`} color="#0f172a" fs={fs - 2} box={box} />
      <Tag x={lens.x} y={lens.y + rL + 13} text={L.h2Tag(fmt(rise, 2, dec))} color={FC.f2} fs={fs - 1} box={box} />
    </g>
  );
}

/* ========================================================= steps panel */

function PressSteps({ T, S1, S2, F, m, mg, holding }) {
  const L = T.press;
  const M = L.method;
  const dec = T.decimal;
  const B = (v) => big(v, 0, dec);
  const Sm = (v) => smart(v, dec);
  const p = F / (S1 / 1e4); // Pa
  const F2 = p * (S2 / 1e4);
  const gain = S2 / S1;
  const lifts = F2 > mg * (1 + 1e-6);
  const eq = !lifts && F2 >= mg * (1 - 1e-6);
  return (
    <StepsPanel formula="F₂ / F₁ = S₂ / S₁" title={M.title}>
      <Step n={1} title={M.s1}>
        <Eq sym="p = F₁ / S₁" nums={`= ${Sm(F)} ${T.N} / ${m2(S1, dec)} ${T.m2} =`} result={`${B(p)} ${T.Pa} = ${B(p / 1000)} ${T.kPa}`} resultColor={FC.pText} />
        {holding && <p className="mt-0.5 text-gray-400">{M.holdNote}</p>}
      </Step>
      <Step n={2} title={M.s2}>
        <p className="mt-0.5">{M.pascal(B(p / 1000))}</p>
      </Step>
      <Step n={3} title={M.s3}>
        <Eq sym="F₂ = p · S₂" nums={`= ${B(p)} ${T.Pa} · ${m2(S2, dec)} ${T.m2} =`} result={`${B(F2)} ${T.N}`} resultColor={FC.f2Text} />
      </Step>
      <Step n={4} title={M.s4}>
        <Eq sym="F₂ / F₁ = S₂ / S₁" nums={`= ${B(S2)} / ${B(S1)} =`} result={T.times(Sm(gain))} resultColor={FC.gainText} />
      </Step>
      <Step n={5} title={M.s5}>
        <Eq sym="mg" nums={`= ${B(m)} ${T.kg} · ${fmt(G, 1, dec)} ${T.ms2} =`} result={`${B(mg)} ${T.N}`} resultColor={FC.mgText} />
        <p className={`mt-1 font-semibold ${lifts ? 'text-emerald-300' : eq ? 'text-violet-300' : 'text-amber-300'}`}>
          {lifts ? M.verdictLift(B(F2), B(mg)) : eq ? M.verdictEq(B(F2)) : M.verdictWeak(B(F2), B(mg))}
        </p>
        <p className="mt-0.5 text-gray-400">
          <Sym>{M.minF(Sm(mg / gain))}</Sym>
        </p>
      </Step>
    </StepsPanel>
  );
}

/* ================================================================ graph */

function ForceGraph({ T, F1, gain, mg, onPick }) {
  const L = T.press;
  const dec = T.decimal;
  const F2set = F1 * gain;
  const yMax = niceCeil(Math.max(mg * 1.6, F2set * 1.25, 1) / 1000);
  const xEnd = Math.min(300, (yMax * 1000) / gain);
  const Fmin = mg / gain;
  return (
    <TimeGraph
      title={L.graph.title}
      series={[
        { id: 'line', label: L.graph.line, color: '#60a5fa', points: [{ x: 0, y: 0 }, { x: xEnd, y: (xEnd * gain) / 1000 }], dot: false },
        { id: 'mg', label: L.graph.mg, color: '#f87171', points: [{ x: 0, y: mg / 1000 }, { x: 300, y: mg / 1000 }], dash: '6 5', dot: false },
        ...(Fmin <= 300 ? [{ id: 'min', label: L.graph.min, color: '#fbbf24', points: [{ x: Fmin, y: mg / 1000 }] }] : []),
        { id: 'now', label: L.graph.now, color: '#ffffff', points: [{ x: F1, y: F2set / 1000 }] },
      ]}
      xMax={300}
      yMax={yMax}
      xLabel={L.graph.x}
      yLabel={L.graph.y}
      marker={F1}
      decimal={dec}
      yDigits={Number.isInteger(yMax / 4) ? 0 : Number.isInteger((yMax / 4) * 10) ? 1 : 2}
      height={250}
      onScrub={onPick}
      note={L.graph.note}
    />
  );
}

